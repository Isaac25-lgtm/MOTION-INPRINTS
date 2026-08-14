import { ApiError } from './http.js'
import { toWire } from './money.js'
import { calculatePrice, loadPricingContext } from './pricing.js'

/* Reorder (Prompt 9.4).

   A reorder is a *proposal*, not a repeat charge. Historical configuration is
   read, then every part of it is re-validated against today's catalogue and
   re-priced at today's rates. The customer sees the current price and accepts it
   before anything reaches the cart.

   Nothing is silently substituted. If a material or finish no longer exists, the
   line is returned as needing attention with the specific option named — guessing
   a replacement would mean producing something the customer did not ask for. */

/**
 * Evaluates each line of a past order for repeat ordering.
 * @returns {Promise<{items: object[], reorderable: boolean, requiresQuote: boolean}>}
 */
export async function evaluateReorder(db, orderId) {
  const items = await db.query(
    `SELECT oi.id, oi.product_id, oi.title, oi.quantity, oi.configuration, oi.design_service_required,
            p.slug, p.status AS product_status, p.name AS current_name
     FROM public.order_items oi
     LEFT JOIN public.products p ON p.id = oi.product_id
     WHERE oi.order_id = $1 ORDER BY oi.id`, [orderId])

  if (!items.length) throw new ApiError(404, 'not_found', 'That order has no items to reorder.')

  const evaluated = []
  for (const item of items) {
    // A quotation line has no product to re-price; it becomes "request similar".
    if (!item.product_id) {
      evaluated.push({
        orderItemId: item.id, title: item.title, quantity: item.quantity,
        eligible: false, reason: 'custom_project',
        message: 'This was a quoted project. We can prepare a fresh quote for similar work.',
      })
      continue
    }

    if (item.product_status !== 'published') {
      evaluated.push({
        orderItemId: item.id, title: item.title, quantity: item.quantity,
        eligible: false, reason: 'discontinued',
        message: `${item.title} is no longer available to order directly.`,
      })
      continue
    }

    try {
      const context = await loadPricingContext(db, { productId: item.product_id })
      const selection = item.configuration || {}
      // Re-priced from today's rules; the historical price is never carried over.
      const quote = calculatePrice({ ...context, selection, quantity: item.quantity })

      evaluated.push({
        orderItemId: item.id,
        productId: context.product.id,
        slug: context.product.slug,
        title: context.product.name,
        quantity: item.quantity,
        selection: quote.selection,
        eligible: !quote.quoteRequired,
        requiresQuote: quote.quoteRequired,
        reason: quote.quoteRequired ? 'quote_required' : null,
        message: quote.quoteRequired ? (quote.reasons[0] || 'This configuration is quoted individually.') : null,
        currentPrice: quote.total,
        currentUnitPrice: quote.unitPrice,
        currency: quote.currency,
        designServiceRequired: item.design_service_required,
      })
    } catch (error) {
      // A saved option that no longer exists names itself, so the customer knows
      // exactly what to choose again rather than being told "something changed".
      evaluated.push({
        orderItemId: item.id, title: item.title, quantity: item.quantity,
        eligible: false,
        reason: error.code === 'invalid_option' || error.code === 'missing_option' ? 'configuration_changed' : 'unavailable',
        message: error.status === 404
          ? `${item.title} is no longer available.`
          : `${item.title} needs some choices made again: ${error.message}`,
        invalidOptions: error.details || null,
      })
    }
  }

  return {
    items: evaluated,
    reorderable: evaluated.some(item => item.eligible),
    requiresQuote: evaluated.some(item => item.reason === 'quote_required' || item.reason === 'custom_project'),
  }
}

/** Compares a past line's price with today's, so a change can be stated plainly. */
export function priceComparison(previousTotal, currentTotal) {
  const before = Number(previousTotal)
  const now = Number(currentTotal)
  if (!Number.isFinite(before) || !Number.isFinite(now)) return { changed: false }
  return {
    changed: before !== now,
    direction: now > before ? 'increased' : now < before ? 'decreased' : 'same',
    previous: toWire(Math.round(before)),
    current: toWire(Math.round(now)),
  }
}
