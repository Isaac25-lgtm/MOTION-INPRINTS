import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { ApiError } from './http.js'
import { add, isAmount, mulQuantity, mulRate, toAmount, toWire } from './money.js'
import { generateReference } from './references.js'

/* Quote lifecycle (Prompts 6.2, 6.3, 6.4).

   The rules that matter, and where each is enforced:

   - Only staff set prices                  → requireAdmin on every write path
   - An accepted quote is immutable         → database trigger (migration 0004)
   - One live quote per request             → partial unique index
   - A revision supersedes, never overwrites→ new row + supersedes_quote_id
   - Expired or superseded cannot be accepted → assertAcceptable, below
   - One order per accepted quote           → orders.quote_id UNIQUE */

export const QUOTE_STATUS = {
  submitted: 'submitted',
  under_review: 'under_review',
  prepared: 'prepared',
  sent: 'sent',
  accepted: 'accepted',
  changes_requested: 'changes_requested',
  declined: 'declined',
  expired: 'expired',
}

/** Totals a quote from its line items. Tax applies only when a rate is configured. */
export function totalQuote(items, { taxRateBp = null } = {}) {
  const lines = items.map(item => {
    const unit = toAmount(item.unitPrice)
    if (!isAmount(unit)) throw new ApiError(422, 'invalid_price', 'Every quote line needs a unit price.')
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new ApiError(422, 'invalid_quantity', 'Every quote line needs a whole quantity of one or more.')
    return { ...item, unitPrice: unit, lineTotal: mulQuantity(unit, item.quantity) }
  })
  const subtotal = add(...lines.map(line => line.lineTotal))
  // Null rate means Motion is not applying tax to this quote — the brief forbids
  // assuming a VAT treatment.
  const tax = taxRateBp === null || taxRateBp === undefined ? 0 : mulRate(subtotal, taxRateBp)
  return { lines, subtotal, tax, total: subtotal + tax }
}

const isExpired = (quote, now = new Date()) => {
  if (!quote.valid_until) return false
  // valid_until is a date; a quote is good until the end of that day.
  const end = new Date(`${String(quote.valid_until).slice(0, 10)}T23:59:59.999Z`)
  return now > end
}

/** Throws unless this exact quote can still be acted on by a customer. */
export function assertAcceptable(quote, now = new Date()) {
  if (!quote) throw new ApiError(404, 'not_found', 'Quote not found.')
  if (quote.superseded_at) throw new ApiError(409, 'quote_superseded', 'This quote has been replaced by a newer version.')
  if (quote.status_code === QUOTE_STATUS.declined) throw new ApiError(409, 'quote_declined', 'This quote was declined.')
  if (quote.customer_accepted_at) throw new ApiError(409, 'quote_already_accepted', 'This quote has already been accepted.')
  if (quote.status_code !== QUOTE_STATUS.sent && quote.status_code !== QUOTE_STATUS.changes_requested) {
    throw new ApiError(409, 'quote_not_open', 'This quote is not open for a decision yet.')
  }
  if (isExpired(quote, now)) throw new ApiError(409, 'quote_expired', 'This quote has expired. Ask us for a new one.')
}

/* Guest access token.

   The token is a bearer credential — anyone holding it can read the quote — so it
   is stored as a SHA-256 hash rather than in plaintext. A leaked database dump
   therefore yields no working links. The plaintext is returned exactly once, when
   the quote is created, for the link that gets sent out.

   Comparison is constant time, so a token cannot be recovered a character at a
   time by measuring how long a wrong guess takes. Hashing also makes both sides
   a fixed 64 characters, which removes the length-based early exit. */
export const createAccessToken = () => randomBytes(32).toString('base64url')

export const hashToken = (token) => createHash('sha256').update(String(token)).digest('hex')

export function tokenMatches(supplied, storedHash) {
  if (!supplied || !storedHash) return false
  const a = Buffer.from(hashToken(supplied))
  const b = Buffer.from(String(storedHash))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** A guest bearer link is usable only while it is active and unrevoked. */
export function quoteTokenAllowsAccess(quote, supplied, now = new Date()) {
  if (!quote?.access_token || !tokenMatches(supplied, quote.access_token)) return false
  if (quote.access_token_revoked_at) return false
  if (!quote.access_token_expires_at) return false
  return now < new Date(quote.access_token_expires_at)
}

/** Serialises a quote for a customer. Internal columns never cross this boundary. */
export function presentQuote(quote, items = [], changeRequests = []) {
  return {
    id: quote.id,
    reference: quote.quote_number,
    version: quote.version,
    status: quote.status_code,
    currency: quote.currency,
    subtotal: toWire(toAmount(quote.subtotal)),
    taxAmount: toWire(toAmount(quote.tax_amount)),
    taxRateBp: quote.tax_rate_bp ?? null,
    total: toWire(toAmount(quote.total_amount)),
    validUntil: quote.valid_until,
    expired: isExpired(quote),
    superseded: Boolean(quote.superseded_at),
    acceptedAt: quote.customer_accepted_at,
    acceptedTotal: toWire(toAmount(quote.accepted_total)),
    productionAssumptions: quote.production_assumptions,
    paymentTerms: quote.payment_terms,
    notes: quote.notes,
    sentAt: quote.sent_at,
    items: items.map(item => ({
      id: item.id,
      title: item.title,
      quantity: item.quantity,
      unitPrice: toWire(toAmount(item.unit_price)),
      lineTotal: toWire(toAmount(item.line_total)),
      configuration: item.configuration || {},
    })),
    changeRequests: changeRequests.map(entry => ({ message: entry.message, createdAt: entry.created_at })),
  }
}

/** Loads a quote with its items and change requests.
 *
 * `customer_id` lives on quote_requests, not on quotes, so it is joined in here.
 * Reading it off the quote row directly yields undefined, which silently fails
 * every ownership check — authenticated customers could never open their own quote. */
export async function loadQuote(db, quoteId) {
  const [quotes, items, changes] = await Promise.all([
    db.query(`SELECT q.*, r.customer_id, r.contact_name, r.contact_email, r.contact_phone, r.request_number
              FROM public.quotes q JOIN public.quote_requests r ON r.id = q.quote_request_id
              WHERE q.id=$1`, [quoteId]),
    db.query('SELECT * FROM public.quote_items WHERE quote_id=$1 ORDER BY id', [quoteId]),
    db.query('SELECT message, created_at FROM public.quote_change_requests WHERE quote_id=$1 ORDER BY created_at DESC', [quoteId]),
  ])
  if (!quotes[0]) throw new ApiError(404, 'not_found', 'Quote not found.')
  return { quote: quotes[0], items, changeRequests: changes }
}

/**
 * Creates a quote, or a superseding revision of one.
 * Staff-only — the caller is responsible for having established that.
 */
export async function createQuote(db, { quoteRequestId, items, taxRateBp, validUntil, notes, productionAssumptions, paymentTerms, authUserId, supersedes = null }) {
  if (!items?.length) throw new ApiError(422, 'empty_quote', 'A quote needs at least one line item.')
  const totals = totalQuote(items, { taxRateBp })
  const reference = await generateReference(db, 'quote', { table: 'quotes', column: 'quote_number' })

  const previous = supersedes ? (await db.query('SELECT id, quote_number, quote_request_id, version, customer_accepted_at FROM public.quotes WHERE id=$1', [supersedes]))[0] : null
  if (supersedes && !previous) throw new ApiError(404, 'not_found', 'The quote being revised was not found.')
  if (previous && previous.quote_request_id !== quoteRequestId) {
    throw new ApiError(409, 'quote_request_mismatch', 'A revision must belong to the same quote request as the quote it supersedes.')
  }
  // Revising an accepted quote would change what a customer already agreed to.
  if (previous?.customer_accepted_at) throw new ApiError(409, 'quote_already_accepted', 'An accepted quote cannot be revised. Create a new quote request instead.')

  const version = previous ? previous.version + 1 : 1
  const quoteId = randomUUID()

  /* Quote, items, history and supersession are one transaction. A quote row
     without its line items would be a priced document with nothing priced, so
     partial creation is not an acceptable outcome.

     Ids are generated here so the whole batch can be submitted without waiting
     for a database-assigned id between statements. */
  await db.transaction((tx) => {
    const queries = []
    if (previous) {
      queries.push(tx.query('UPDATE public.quotes SET superseded_at = now(), updated_at = now() WHERE id=$1 AND customer_accepted_at IS NULL', [previous.id]))
    }
    queries.push(tx.query(
      `INSERT INTO public.quotes(id, quote_number, quote_request_id, status_code, subtotal, tax_rate_bp, tax_amount, total_amount,
                                 valid_until, notes, production_assumptions, payment_terms, version, supersedes_quote_id,
                                 created_by_auth_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [quoteId, reference, quoteRequestId, QUOTE_STATUS.prepared, totals.subtotal, taxRateBp ?? null, totals.tax, totals.total,
        validUntil || null, notes || null, productionAssumptions || null, paymentTerms || null, version, previous?.id || null,
        authUserId || null],
    ))
    for (const line of totals.lines) {
      queries.push(tx.query(
        'INSERT INTO public.quote_items(id, quote_id, product_id, title, quantity, unit_price, line_total, configuration) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [randomUUID(), quoteId, line.productId || null, line.title, line.quantity, line.unitPrice, line.lineTotal, JSON.stringify(line.configuration || {})],
      ))
    }
    queries.push(tx.query(
      'INSERT INTO public.quote_status_history(quote_id, status_code, changed_by_auth_user_id, note) VALUES ($1,$2,$3,$4)',
      [quoteId, QUOTE_STATUS.prepared, authUserId || null, previous ? `Revision of ${previous.quote_number || previous.id}` : 'Quote prepared'],
    ))
    return queries
  })

  const [created] = await db.query('SELECT * FROM public.quotes WHERE id=$1', [quoteId])
  return created
}

/** Records acceptance. The accepted figures are frozen by the database trigger. */
export async function acceptQuote(db, quote, { authUserId = null } = {}) {
  assertAcceptable(quote)
  const rows = await db.query(
    `WITH accepted AS (
       UPDATE public.quotes
       SET status_code=$1, customer_accepted_at=now(), accepted_by_auth_user_id=$2, accepted_total=total_amount, updated_at=now()
       WHERE id=$3 AND customer_accepted_at IS NULL AND superseded_at IS NULL
         AND status_code IN ('sent', 'changes_requested')
       RETURNING *
     ), history AS (
       INSERT INTO public.quote_status_history(quote_id, status_code, changed_by_auth_user_id, note)
       SELECT id, $1, $2, 'Accepted by customer' FROM accepted
     )
     SELECT * FROM accepted`,
    [QUOTE_STATUS.accepted, authUserId, quote.id],
  )
  // A concurrent acceptance would have set customer_accepted_at first.
  if (!rows[0]) throw new ApiError(409, 'quote_already_accepted', 'This quote has already been accepted.')
  return rows[0]
}
