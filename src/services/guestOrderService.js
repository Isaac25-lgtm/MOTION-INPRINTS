import { request } from './apiClient'

export const trackingService = {
  track: (reference, token, options) =>
    request(`/track/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`, { ...options, token: null }),
  proofs: (reference, token, options) =>
    request(`/track/${encodeURIComponent(reference)}/proofs?token=${encodeURIComponent(token)}`, { ...options, token: null }),
  reorder: (reference, token, options) =>
    request(`/track/${encodeURIComponent(reference)}/reorder?token=${encodeURIComponent(token)}`, { ...options, token: null }),
  respondToProof: (proofId, body, options) =>
    request(`/proofs/${encodeURIComponent(proofId)}/respond`, { ...options, method: 'POST', body, token: null }),
}
