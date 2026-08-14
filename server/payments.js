import { ApiError } from './http.js'
import { CURRENCY, toAmount, toWire } from './money.js'

/* Provider-neutral payment layer (Prompt 8.4).

   No provider is chosen yet, so this file defines the contract and the rules that
   hold whichever provider is selected. Prompt 8.5 implements a real one against
   this interface.

   The rule that shapes everything here: a browser can never mark an order paid.
   `markSuccessful` is reachable only from `verifyAndSettle`, which requires a
   server-side confirmation carrying an amount and currency that match the payment
   record. A redirect back from a provider is a hint to go and check, nothing more. */

export const PAYMENT_STATUS = {
  pending: 'pending',
  processing: 'processing',
  successful: 'successful',
  failed: 'failed',
  cancelled: 'cancelled',
  expired: 'expired',
  refunded: 'refunded',
}

/** States from which a payment can still change. A settled payment is final. */
const OPEN_STATES = new Set([PAYMENT_STATUS.pending, PAYMENT_STATUS.processing])

/**
 * The interface a provider adapter implements.
 * @typedef {object} PaymentProvider
 * @property {string} name
 * @property {(input: {payment: object, order: object, returnUrl: string}) => Promise<{reference: string, redirectUrl?: string, instructions?: string}>} initiate
 * @property {(reference: string) => Promise<{status: string, amount: string, currency: string, providerStatus?: string, reason?: string}>} verify
 * @property {(request: Request, secret: string) => Promise<{eventId: string, reference: string, status: string, amount: string, currency: string}>} parseWebhook
 * @property {(input: {payment: object, amount: string}) => Promise<{reference: string}>} [refund]
 */

/** Adapter used until a provider is selected. Fails loudly rather than pretending. */
export function createUnconfiguredProvider() {
  const unavailable = async () => {
    throw new ApiError(503, 'payment_provider_not_configured', 'Online payment is not available yet. We will confirm payment arrangements with you directly.')
  }
  return { name: 'unconfigured', initiate: unavailable, verify: unavailable, parseWebhook: unavailable }
}

/** Opens a payment attempt against an order. Amount comes from the order, never the request. */
export async function initiatePayment(db, provider, { order, returnUrl }) {
  const amount = toAmount(order.total_amount)
  if (!amount || amount <= 0) throw new ApiError(422, 'nothing_to_pay', 'This order has no outstanding amount.')

  const already = (await db.query(
    'SELECT id, status FROM public.payments WHERE order_id=$1 AND status = $2 LIMIT 1', [order.id, PAYMENT_STATUS.successful]))[0]
  if (already) throw new ApiError(409, 'already_paid', 'This order has already been paid.')

  const [payment] = await db.query(
    'INSERT INTO public.payments(order_id, amount, currency, provider, status) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [order.id, amount, order.currency || CURRENCY, provider.name, PAYMENT_STATUS.pending],
  )

  const initiated = await provider.initiate({ payment, order, returnUrl })

  const [updated] = await db.query(
    'UPDATE public.payments SET provider_reference=$1, status=$2, updated_at=now() WHERE id=$3 RETURNING *',
    [initiated.reference, PAYMENT_STATUS.processing, payment.id],
  )

  return {
    paymentId: updated.id,
    status: updated.status,
    amount: toWire(amount),
    currency: updated.currency,
    redirectUrl: initiated.redirectUrl || null,
    instructions: initiated.instructions || null,
  }
}

/**
 * The only path to a successful payment.
 *
 * Verification must independently confirm, against the provider, that the
 * transaction exists, belongs to this payment, and matches on amount and
 * currency. Any mismatch is recorded and rejected — it is either an error or an
 * attack, and both deserve the same treatment.
 */
export async function verifyAndSettle(db, provider, { payment, confirmation = null }) {
  if (!OPEN_STATES.has(payment.status)) {
    // Already settled: replaying a webhook must be inert, not an error.
    return { payment, changed: false, reason: 'already_settled' }
  }

  const result = confirmation || await provider.verify(payment.provider_reference)

  const expectedAmount = toAmount(payment.amount)
  const reportedAmount = toAmount(result.amount)

  if (reportedAmount === null || reportedAmount !== expectedAmount) {
    const [failed] = await db.query(
      `UPDATE public.payments SET status=$1, failure_reason=$2, provider_status=$3, updated_at=now()
       WHERE id=$4 AND status = ANY($5) RETURNING *`,
      [PAYMENT_STATUS.failed, 'amount_mismatch', result.providerStatus || null, payment.id,
        [PAYMENT_STATUS.pending, PAYMENT_STATUS.processing]],
    )
    if (!failed) {
      const [current] = await db.query('SELECT * FROM public.payments WHERE id=$1', [payment.id])
      return { payment: current || payment, changed: false, reason: 'already_settled' }
    }
    throw new ApiError(409, 'payment_amount_mismatch', 'The payment amount does not match the order.', { paymentId: [failed.id] })
  }

  if ((result.currency || CURRENCY) !== payment.currency) {
    const [failed] = await db.query(
      `UPDATE public.payments SET status=$1, failure_reason=$2, updated_at=now()
       WHERE id=$3 AND status = ANY($4) RETURNING *`,
      [PAYMENT_STATUS.failed, 'currency_mismatch', payment.id,
        [PAYMENT_STATUS.pending, PAYMENT_STATUS.processing]])
    if (!failed) {
      const [current] = await db.query('SELECT * FROM public.payments WHERE id=$1', [payment.id])
      return { payment: current || payment, changed: false, reason: 'already_settled' }
    }
    throw new ApiError(409, 'payment_currency_mismatch', 'The payment currency does not match the order.')
  }

  const status = normaliseStatus(result.status)

  /* One data-modifying CTE settles the payment, conditionally advances the order
     and records history atomically. Only the request that changes the open
     payment writes history, so concurrent confirmations are inert. */
  const openStates = [PAYMENT_STATUS.pending, PAYMENT_STATUS.processing]
  let updated
  if (status === PAYMENT_STATUS.successful) {
    ;[updated] = await db.query(
      `WITH settled AS (
         UPDATE public.payments
         SET status=$1, provider_status=$2, verified_at=now(), failure_reason=NULL, updated_at=now()
         WHERE id=$3 AND status = ANY($4)
         RETURNING *
       ), advanced AS (
         UPDATE public.orders o SET status_code='new', updated_at=now()
         FROM settled s
         WHERE o.id=s.order_id AND o.status_code='awaiting_payment'
         RETURNING o.id, o.status_code
       ), history AS (
         INSERT INTO public.order_status_history(order_id, status_code, note)
         SELECT s.order_id, COALESCE(a.status_code, o.status_code),
                CASE WHEN a.id IS NULL THEN $5 || '; order status retained' ELSE $5 END
         FROM settled s
         JOIN public.orders o ON o.id=s.order_id
         LEFT JOIN advanced a ON a.id=o.id
       )
       SELECT * FROM settled`,
      [status, result.providerStatus || null, payment.id, openStates, `Payment confirmed (${payment.provider})`])
  } else {
    ;[updated] = await db.query(
      `UPDATE public.payments SET status=$1, provider_status=$2, verified_at=now(), failure_reason=$3, updated_at=now()
       WHERE id=$4 AND status = ANY($5) RETURNING *`,
      [status, result.providerStatus || null, result.reason || 'declined', payment.id, openStates],
    )
  }

  if (!updated) {
    const [current] = await db.query('SELECT * FROM public.payments WHERE id=$1', [payment.id])
    return { payment: current || payment, changed: false, reason: 'already_settled' }
  }
  return { payment: updated, changed: true }
}

/** Maps a provider's vocabulary onto the application's. Unknown means failed. */
export function normaliseStatus(raw) {
  const value = String(raw || '').toLowerCase()
  if (['successful', 'success', 'succeeded', 'completed', 'paid'].includes(value)) return PAYMENT_STATUS.successful
  if (['processing', 'pending_confirmation', 'authorized', 'ongoing'].includes(value)) return PAYMENT_STATUS.processing
  if (['pending', 'created', 'initiated'].includes(value)) return PAYMENT_STATUS.pending
  if (['cancelled', 'canceled', 'aborted'].includes(value)) return PAYMENT_STATUS.cancelled
  if (['expired', 'timeout', 'timed_out'].includes(value)) return PAYMENT_STATUS.expired
  if (['refunded', 'reversed'].includes(value)) return PAYMENT_STATUS.refunded
  return PAYMENT_STATUS.failed
}

/**
 * Records a webhook delivery before it is processed. Returns false when this
 * event has already been seen, which makes repeat deliveries inert (Prompt 8.5).
 */
export async function recordWebhookEvent(db, { provider, eventId, payload }) {
  if (!eventId) throw new ApiError(400, 'missing_event_id', 'The webhook carried no event identifier.')
  try {
    await db.query('INSERT INTO public.payment_events(provider, event_id, payload) VALUES ($1,$2,$3)',
      [provider, eventId, JSON.stringify(scrub(payload))])
    return true
  } catch (error) {
    /* Only a unique violation means "seen before". Treating every database error
       as a duplicate would silently drop real payment notifications whenever the
       connection dropped — so anything else is re-thrown for the provider to retry. */
    const isDuplicate = error.code === '23505' || /duplicate key|unique constraint/i.test(error.message || '')
    if (!isDuplicate) throw new ApiError(503, 'webhook_not_recorded', 'The webhook could not be recorded. Please retry.')
    return false
  }
}

/* Diagnostic payloads are stored, but never anything that could authenticate a
   request or identify a card. */
const SECRET_KEYS = /secret|signature|token|authorization|password|card|cvv|cvc|pan|expiry|pin/i
export function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, SECRET_KEYS.test(key) ? '[redacted]' : scrub(entry)]))
}
