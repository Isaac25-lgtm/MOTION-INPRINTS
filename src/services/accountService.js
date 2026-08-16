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

  /* First profile after sign-up. Distinct from updateProfile because the server
     routes them differently: POST inserts with the role fixed to 'customer',
     PATCH touches only name, phone and company. Neither accepts a role, and the
     browser has no way to ask for one.

     This existed on authService and was never wired to anything, so a newly
     authenticated user reached /account/profile, GET /me answered
     profile_required, and the page rendered an error they could not clear. */
  createProfile: (body, options) => request('/me', { ...options, method: 'POST', body }),
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
