import { request } from './apiClient'
export const productService = { list: (options) => request('/products', options), getBySlug: (slug, options) => request(`/products/${encodeURIComponent(slug)}`, options), create: (body, options) => request('/admin/products', { ...options, method: 'POST', body }) }
