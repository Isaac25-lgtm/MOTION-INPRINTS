import { request } from './apiClient'

/**
 * @typedef {object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string|null} short_description
 * @property {string|null} description
 * @property {'fixed'|'configurable'|'quote_only'} pricing_type
 * @property {string|null} starting_price  Null whenever no verified price exists.
 * @property {string} currency
 * @property {boolean} quote_required
 * @property {string|null} category_name
 * @property {string|null} image  Null until object storage is provisioned.
 */

const query = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, value) })
  const string = search.toString()
  return string ? `?${string}` : ''
}

export const productService = {
  /** @returns {Promise<Product[]>} */
  list: (params, options) => request(`/products${query(params)}`, options),
  /** @returns {Promise<Product>} */
  getBySlug: (slug, options) => request(`/products/${encodeURIComponent(slug)}`, options),
  create: (body, options) => request('/admin/products', { ...options, method: 'POST', body }),
  update: (id, body, options) => request(`/admin/products/${encodeURIComponent(id)}`, { ...options, method: 'PATCH', body }),
}
