import { request } from './apiClient'
export const authService = { me: (options) => request('/me', options), createProfile: (body, options) => request('/me', { ...options, method: 'POST', body }), updateProfile: (body, options) => request('/me', { ...options, method: 'PATCH', body }) }
