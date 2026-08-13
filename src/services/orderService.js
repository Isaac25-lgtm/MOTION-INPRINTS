import { request } from './apiClient'
export const orderService = { listMine: (options) => request('/orders', options), getMine: (id, options) => request(`/orders/${encodeURIComponent(id)}`, options), changeStatus: (id, body, options) => request(`/admin/orders/${encodeURIComponent(id)}/status`, { ...options, method: 'PATCH', body }) }
