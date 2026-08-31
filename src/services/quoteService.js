import { request } from './apiClient'
export const quoteService = {
  submit: (body, options) => request('/quote-requests', { ...options, method: 'POST', body }),
}
