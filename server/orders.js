import { createHash, randomUUID } from 'node:crypto'
import { ApiError } from './http.js'
import { CURRENCY, add, isAmount, toAmount, toWire } from './money.js'
import { generateReference } from './references.js'
import { calculatePrice, loadPricingContext } from './pricing.js'
import { assertAcceptable } from './quotes.js'
import { createTrackingToken, hashTrackingToken } from './workflow.js'
import { upsertCustomerContact } from './contacts.js'

/* Order creation (Prompts 8.1, 8.3) and quote conversion (Prompt 6.4).

   The whole of checkout reduces to one rule: the browser describes what it wants,
   the server decides what that costs and whether it may be sold. Nothing the
   client sends about money is read, and `createOrder` recalculates every line from
   the database before writing anything. */

export const ORDER_STATUS = {
  new: 'new',
  awaiting_payment: 'awaiting_payment',
  artwork_required: 'artwork_required',
}

const fingerprint = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * Returns a previously stored response for this key, or null to proceed.
 *
 * The key is not reserved here. Reservation happens inside the same transaction
 * that writes the order, so there is no window in which an order exists without
 * its key recorded — which was how a retry could previously produce a second order.
 */
export async function checkIdempotency(db, { key, scope, request }) {
  if (!key) return null
  const digest = fingerprint(request)
  const existing = (await db.query('SELECT request_fingerprint, response FROM public.idempotency_keys WHERE key=$1 AND scope=$2', [key, scope]))[0]
  if (!existing) return null
  if (existing.request_fingerprint !== digest) {
    throw new ApiError(409, 'idempotency_conflict', 'This request key was already used with different details.')
  }
  // Same key, same body: replay rather than repeat.
  return existing.response ?? null
}

/** Translates a unique-violation on the key into a replay of the winning response. */
export async function resolveIdempotencyRace(db, { key, scope }) {
  const winner = (await db.query('SELECT response FROM public.idempotency_keys WHERE key=$1 AND scope=$2', [key, scope]))[0]
  if (winner?.response) return winner.response
  throw new ApiError(409, 'request_in_progress', 'This request is already being processed.')
}

export const fingerprintRequest = fingerprint

/**
 * Reprices a cart from the database. Returns priced lines and the subtotal, or
 * throws with the specific reason a line cannot be sold.
 */
export async function priceCart(db, items) {
  if (!items?.length) throw new ApiError(422, 'empty_cart', 'Your cart is empty.')
  const lines = []
  for (const item of items) {
    const context = await loadPricingContext(db, { productId: item.productId })
    const quote = calculatePrice({ ...context, selection: item.selection, quantity: item.quantity })
    if (quote.quoteRequired) {
      throw new ApiError(409, 'quote_required', `${context.product.name} has to be quoted rather than ordered directly.`, { productId: [context.product.slug] })
    }
    const designService = quote.selection.design === true || quote.selection.design_service === true
    const artworkStatus = designService
      ? 'not_required'
      : (context.product.artwork_requirement === 'required'
          || context.product.artwork_requirement === 'design_available'
          || item.artworkAction === 'upload_later')
        ? 'awaiting_upload'
        : 'not_required'
    lines.push({
      productId: context.product.id,
      title: context.product.name,
      quantity: quote.quantity,
      unitPrice: Number(quote.unitPrice),
      lineTotal: Number(quote.total),
      configuration: quote.selection,
      priceSnapshot: { components: quote.components, calculatedAt: new Date().toISOString() },
      artworkRequirement: context.product.artwork_requirement,
      designService,
      artworkStatus,
    })
  }
  return { lines, subtotal: add(...lines.map(line => line.lineTotal)) }
}

/**
 * Creates an order atomically.
 *
 * The order row, every item, the opening history entry and the idempotency record
 * are written in ONE transaction. If any statement fails the whole thing rolls
 * back, so the database can never hold an order missing its items, nor an order
 * whose idempotency key went unrecorded.
 *
 * Identifiers are generated here rather than by the database so the order row,
 * items, history and idempotency record can be submitted as one batch.
 */
export async function createOrder(db, {
  items, contact, fulfilment, deliveryAmount = 0, taxAmount = 0, notes = null,
  contactId = null, upsertContact = false, actorId = null, quoteId = null, status = null,
  idempotency = null,
}) {
  const priced = quoteId ? null : await priceCart(db, items)
  const lines = priced ? priced.lines : items
  const subtotal = priced ? priced.subtotal : add(...lines.map(line => line.lineTotal))

  const delivery = toAmount(deliveryAmount) || 0
  const tax = toAmount(taxAmount) || 0
  if (!isAmount(delivery) || !isAmount(tax)) throw new ApiError(422, 'invalid_amount', 'Delivery and tax must be non-negative amounts.')

  const total = subtotal + delivery + tax

  if (fulfilment.method === 'delivery' && !fulfilment.address?.trim()) {
    throw new ApiError(422, 'delivery_address_required', 'A delivery address is required.', { deliveryAddress: ['Enter where the order should go.'] })
  }

  // Artwork expectations decide the opening status when none is forced.
  const needsArtwork = lines.some(line => line.artworkStatus === 'awaiting_upload')
  const openingStatus = status || (needsArtwork ? ORDER_STATUS.artwork_required : ORDER_STATUS.awaiting_payment)

  const reference = await generateReference(db, 'order', { table: 'orders', column: 'order_number' })
  const orderId = randomUUID()
  /* Guest tracking needs a credential the order number cannot supply. The
     plaintext is returned once, with the confirmation; only its hash is stored,
     so references stay short and unguessable access stays separate (Prompt 9.2). */
  const trackingToken = createTrackingToken()

  // The response is known before anything is written, so it can be stored inside
  // the same transaction as the order it describes.
  const persistedLines = lines.map(line => ({ ...line, id: line.id || randomUUID() }))
  const result = presentOrder({
    id: orderId, order_number: reference, status_code: openingStatus, currency: CURRENCY,
    subtotal, tax_amount: tax, delivery_amount: delivery, total_amount: total,
    fulfilment_method: fulfilment.method, contact_name: contact.name,
    created_at: new Date().toISOString(), quote_id: quoteId,
  }, persistedLines)
  // Returned once so the confirmation page can offer a tracking link.
  result.trackingToken = trackingToken

  try {
    await db.transaction((tx) => {
      const contactWrite = upsertContact
        ? upsertCustomerContact(tx, {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
        })
        : null
      const insertOrder = (resolvedContactId) => tx.query(
          `INSERT INTO public.orders(id, order_number, contact_id, quote_id, contact_name, contact_email, contact_phone, company_name,
                                     status_code, subtotal, total_amount, tax_amount, delivery_amount, currency,
                                     fulfilment_method, delivery_address, delivery_notes, notes, placed_by_auth_user_id, tracking_token)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
          [orderId, reference, resolvedContactId, quoteId, contact.name, contact.email, contact.phone || null, contact.company || null,
            openingStatus, subtotal, total, tax, delivery, CURRENCY,
            fulfilment.method, fulfilment.address || null, fulfilment.notes || null, notes, actorId,
            hashTrackingToken(trackingToken)],
        )
      const orderWrite = contactWrite ? contactWrite.then(insertOrder) : Promise.resolve(insertOrder(contactId))
      const queries = contactWrite ? [contactWrite, orderWrite] : [orderWrite]
      queries.push(
        orderWrite.then(() => tx.query(
          'INSERT INTO public.order_status_history(order_id, status_code, changed_by_auth_user_id, note) VALUES ($1,$2,$3,$4)',
          [orderId, openingStatus, actorId, quoteId ? 'Created from accepted quote' : 'Order placed'],
        )),
      )

      // Items belong to the same transaction as the order they complete.
      for (const line of persistedLines) {
        queries.push(orderWrite.then(() => tx.query(
          `INSERT INTO public.order_items(id, order_id, product_id, title, quantity, unit_price, line_total, configuration,
                                           design_service_required, artwork_status, price_snapshot)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [line.id, orderId, line.productId || null, line.title, line.quantity, line.unitPrice, line.lineTotal,
            JSON.stringify(line.configuration || {}), Boolean(line.designService),
            line.artworkStatus || (line.artworkRequirement === 'required' && !line.designService ? 'awaiting_upload' : 'not_required'),
            JSON.stringify(line.priceSnapshot || {})],
        )))
      }

      // Reserving the key here means a concurrent duplicate hits the primary key
      // and rolls back, rather than racing an already-created order.
      if (idempotency?.key) {
        queries.push(orderWrite.then(() => tx.query(
          'INSERT INTO public.idempotency_keys(key, scope, request_fingerprint, response) VALUES ($1,$2,$3,$4)',
          [idempotency.key, idempotency.scope, fingerprint(idempotency.request), JSON.stringify(result)],
        )))
      }

      return queries
    })
  } catch (error) {
    // A duplicate key means another request won; its order is the real one.
    if (idempotency?.key && /duplicate key|unique constraint/i.test(error.message || '')) {
      return resolveIdempotencyRace(db, idempotency)
    }
    throw error
  }

  return result
}

/**
 * Converts an accepted quote into an order (Prompt 6.4).
 * `orders.quote_id` is UNIQUE, so a second conversion is impossible at the
 * database level even if two requests arrive simultaneously.
 */
export async function convertQuoteToOrder(db, { quote, items, contactId = null, actorId = null, fulfilment = { method: 'collection' }, contact }) {
  if (!quote.customer_accepted_at) {
    // Not accepted yet: say why precisely rather than a generic refusal.
    assertAcceptable(quote)
    throw new ApiError(409, 'quote_not_accepted', 'This quote has not been accepted yet.')
  }
  if (quote.superseded_at) throw new ApiError(409, 'quote_superseded', 'This quote was replaced before it was converted.')

  const existing = (await db.query('SELECT id, order_number FROM public.orders WHERE quote_id=$1', [quote.id]))[0]
  if (existing) throw new ApiError(409, 'already_converted', 'An order already exists for this quote.', { orderNumber: [existing.order_number] })

  // Acceptance does not freeze time. A quote accepted before its validity date but
  // converted long afterwards would bill an obsolete price, so the window is
  // re-checked at conversion.
  if (quote.valid_until) {
    const end = new Date(`${String(quote.valid_until).slice(0, 10)}T23:59:59.999Z`)
    if (new Date() > end) throw new ApiError(409, 'quote_expired', 'This quote expired before it was converted. Ask us for a current one.')
  }

  if (!items?.length) throw new ApiError(422, 'empty_quote', 'This quote has no line items to convert.')

  const lines = items.map(item => ({
    productId: item.product_id,
    title: item.title,
    quantity: item.quantity,
    unitPrice: toAmount(item.unit_price),
    lineTotal: toAmount(item.line_total),
    configuration: item.configuration || {},
    priceSnapshot: { source: 'quote', quoteId: quote.id, version: quote.version },
    artworkRequirement: 'optional',
    designService: false,
  }))

  /* The order must bill exactly what was accepted. If the lines plus tax do not
     reconcile with accepted_total, something has diverged and the safe outcome is
     to refuse rather than to charge a figure nobody agreed to. */
  const accepted = toAmount(quote.accepted_total ?? quote.total_amount)
  const tax = toAmount(quote.tax_amount) || 0
  const reconstructed = add(...lines.map(line => line.lineTotal)) + tax
  if (accepted !== null && reconstructed !== accepted) {
    throw new ApiError(409, 'quote_total_mismatch',
      'This quote does not reconcile with the amount that was accepted, so it has not been converted.',
      { acceptedTotal: [toWire(accepted)], calculated: [toWire(reconstructed)] })
  }

  return createOrder(db, {
    items: lines,
    contact,
    fulfilment,
    // The accepted figures carry over exactly; nothing is recalculated.
    taxAmount: tax,
    contactId,
    actorId,
    quoteId: quote.id,
    status: ORDER_STATUS.awaiting_payment,
    notes: `Converted from quote ${quote.quote_number} (version ${quote.version}).`,
  })
}

export function presentOrder(order, lines = []) {
  return {
    id: order.id,
    reference: order.order_number,
    status: order.status_code,
    currency: order.currency,
    subtotal: toWire(toAmount(order.subtotal)),
    taxAmount: toWire(toAmount(order.tax_amount)),
    deliveryAmount: toWire(toAmount(order.delivery_amount)),
    total: toWire(toAmount(order.total_amount)),
    fulfilmentMethod: order.fulfilment_method,
    contactName: order.contact_name,
    createdAt: order.created_at,
    quoteId: order.quote_id || null,
    items: lines.map(line => ({
      id: line.id,
      title: line.title,
      quantity: line.quantity,
      unitPrice: toWire(line.unitPrice),
      lineTotal: toWire(line.lineTotal),
      configuration: line.configuration,
      designServiceRequired: Boolean(line.designService),
      artworkStatus: line.artworkStatus || (line.artworkRequirement === 'required' && !line.designService ? 'awaiting_upload' : 'not_required'),
    })),
  }
}
