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
}

export const quoteResponseService = {
  getPublic: (id, token, options) => request(`/quotes/${encodeURIComponent(id)}/public?token=${encodeURIComponent(token)}`, { ...options, token: null }),
  respond: (id, body, token, options) => request(`/quotes/${encodeURIComponent(id)}/respond`, {
    ...options, method: 'POST', body: { ...body, token }, token: null,
  }),
}
