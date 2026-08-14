import { request } from './apiClient'
export const quoteService = {
  listMine: (options) => request('/quotes', options),
  getMine: (id, options) => request(`/quotes/${encodeURIComponent(id)}`, options),
  submit: (body, options) => request('/quote-requests', { ...options, method: 'POST', body }),
}
