import { request } from './apiClient'

/* Admin operations (Category 10).
 *
 * Every one of these hits an endpoint guarded by `requireAdmin` on the server.
 * The admin UI existing at all is not authorization — hiding a menu item never
 * was — so these will 403 for a customer regardless of what the browser renders.
 */

const query = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, value) })
  const string = search.toString()
  return string ? `?${string}` : ''
}

export const adminService = {
  /** Live operational counts and the genuine action queue. */
  dashboard: (options) => request('/admin/dashboard', options),
  /** Server-computed report; no aggregation happens in the browser. */
  reports: (params, options) => request(`/admin/reports${query(params)}`, options),

  orders: (params, options) => request(`/admin/orders${query(params)}`, options),
  order: (id, options) => request(`/admin/orders/${encodeURIComponent(id)}`, options),
  /** Transition is validated server-side against the workflow. */
  setOrderStatus: (id, body, options) => request(`/admin/orders/${encodeURIComponent(id)}/status`, { ...options, method: 'PATCH', body }),
  setInternalNotes: (id, notes, options) => request(`/admin/orders/${encodeURIComponent(id)}/notes`, { ...options, method: 'PATCH', body: { notes } }),
  uploadProof: (orderId, body, options) => request(`/admin/orders/${encodeURIComponent(orderId)}/proofs`, { ...options, method: 'POST', body }),

  quotes: (params, options) => request(`/admin/quotes${query(params)}`, options),
  prepareQuote: (body, options) => request('/admin/quotes', { ...options, method: 'POST', body }),
  sendQuote: (id, options) => request(`/admin/quotes/${encodeURIComponent(id)}/send`, { ...options, method: 'POST' }),
  convertQuote: (id, options) => request(`/admin/quotes/${encodeURIComponent(id)}/convert`, { ...options, method: 'POST' }),

  customers: (params, options) => request(`/admin/customers${query(params)}`, options),
  customer: (id, options) => request(`/admin/customers/${encodeURIComponent(id)}`, options),

  products: (params, options) => request(`/admin/products${query(params)}`, options),
  createProduct: (body, options) => request('/admin/products', { ...options, method: 'POST', body }),
  updateProduct: (id, body, options) => request(`/admin/products/${encodeURIComponent(id)}`, { ...options, method: 'PATCH', body }),
  archiveProduct: (id, options) => request(`/admin/products/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' }),

  categories: (options) => request('/admin/categories', options),
  createCategory: (body, options) => request('/admin/categories', { ...options, method: 'POST', body }),
  updateCategory: (id, body, options) => request(`/admin/categories/${encodeURIComponent(id)}`, { ...options, method: 'PATCH', body }),

  projects: (params, options) => request(`/admin/projects${query(params)}`, options),
  createProject: (body, options) => request('/admin/projects', { ...options, method: 'POST', body }),
  updateProject: (id, body, options) => request(`/admin/projects/${encodeURIComponent(id)}`, { ...options, method: 'PATCH', body }),

  updateContent: (section, body, options) => request(`/admin/content/${encodeURIComponent(section)}`, { ...options, method: 'PATCH', body }),

  /** Who changed what, for the operational record. */
  audit: (params, options) => request(`/admin/audit${query(params)}`, options),
}
