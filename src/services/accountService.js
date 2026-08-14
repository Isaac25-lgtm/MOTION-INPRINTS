import { request } from './apiClient'

/**
 * Customer portal data (Prompts 9.1–9.4).
 *
 * Every one of these resolves the customer from the verified session on the
 * server. No call passes a customer id — a browser-supplied identity is never
 * accepted as proof of anything.
 */
export const accountService = {
  /** @returns {Promise<{id: string, full_name: string, phone: string|null, company_name: string|null}>} */
  profile: (options) => request('/me', options),
  updateProfile: (body, options) => request('/me', { ...options, method: 'PATCH', body }),

  orders: (options) => request('/orders', options),
  /** Full order view: items, timeline, proofs, payment state. */
  order: (id, options) => request(`/orders/${encodeURIComponent(id)}`, options),

  quotes: (options) => request('/quotes', options),

  /** Evaluates a past order for repeat ordering at today's prices. */
  reorder: (id, options) => request(`/orders/${encodeURIComponent(id)}/reorder`, options),

  proofs: (orderId, options) => request(`/orders/${encodeURIComponent(orderId)}/proofs`, options),
  /** Records approval or a change request against one exact proof version. */
  respondToProof: (proofId, body, options) => request(`/proofs/${encodeURIComponent(proofId)}/respond`, { ...options, method: 'POST', body }),
}

/** Guest tracking. The reference identifies the order; the token authorises it. */
export const trackingService = {
  track: (reference, token, options) =>
    request(`/track/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`, options),
}
