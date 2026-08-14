import { request } from './apiClient'

/**
 * @typedef {object} PricedLine
 * @property {string} key
 * @property {string} productId
 * @property {boolean} available   False when the product was withdrawn or unpublished.
 * @property {boolean} purchasable False for quote-only configurations.
 * @property {boolean} [priceChanged]
 * @property {string|null} total   Server-calculated. Null when a quotation is required.
 * @property {{label: string, kind: string, amount: string}[]} [components]
 */

export const cartService = {
  /**
   * Reprices the whole cart server-side. The stored totals are sent only so the
   * server can flag disagreement; they are never used as the price.
   * @returns {Promise<{items: PricedLine[], subtotal: string|null, valid: boolean, currency: string}>}
   */
  validate: (lines, options) => request('/cart/validate', {
    ...options,
    method: 'POST',
    body: { items: lines.map(line => ({ key: line.key, productId: line.productId, quantity: line.quantity, selection: line.selection, total: line.total ?? null })) },
  }),
}

export const pricingService = {
  /**
   * Prices one configuration. Called whenever the product page's selection changes.
   * @returns {Promise<{total: string|null, unitPrice: string|null, quoteRequired: boolean, reasons: string[], components: object[], currency: string}>}
   */
  calculate: ({ slug, productId, quantity, selection }, options) => request('/pricing/calculate', {
    ...options,
    method: 'POST',
    body: { slug, productId, quantity, selection },
  }),
}
