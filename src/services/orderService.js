import { request } from './apiClient'

/**
 * @typedef {object} Order
 * @property {string} reference   Customer-facing, e.g. MOT-K7P2QX. Never a database id.
 * @property {string} status
 * @property {string} total       Server-calculated, as a string.
 * @property {string} currency
 */

export const orderService = {
  /**
   * Places an order. The body carries products, quantities, options and contact
   * details — never a price. The idempotency key makes a repeated submission
   * return the original order rather than creating a second one.
   * @returns {Promise<Order>}
   */
  place: (body, idempotencyKey, options) => request('/orders', {
    ...options,
    method: 'POST',
    headers: idempotencyKey ? { 'idempotency-key': idempotencyKey } : undefined,
    body,
  }),

  /** @returns {Promise<Order[]>} */
  list: (options) => request('/orders', options),
  /** @returns {Promise<Order>} */
  get: (id, options) => request(`/orders/${encodeURIComponent(id)}`, options),
}

export const quoteResponseService = {
  /** Opens a quote owned by the signed-in customer. */
  getMine: (id, options) => request(`/quotes/${encodeURIComponent(id)}`, options),
  /** Opens a quote with a guest link token. */
  getPublic: (id, token, options) => request(`/quotes/${encodeURIComponent(id)}/public?token=${encodeURIComponent(token)}`, options),
  /** Accepts, declines, or asks for changes. The server validates expiry and supersession. */
  respond: (id, body, token, options) => request(`/quotes/${encodeURIComponent(id)}/respond${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
    ...options, method: 'POST', body,
  }),
}
