import { request } from './apiClient'

/**
 * @typedef {object} Category
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string|null} parent_id
 * @property {string|null} description
 * @property {number} sort_order
 */

export const categoryService = {
  /** @returns {Promise<Category[]>} */
  list: (options) => request('/categories', options),
  /** @returns {Promise<Category>} */
  getBySlug: (slug, options) => request(`/categories/${encodeURIComponent(slug)}`, options),
}

export const serviceService = {
  /** @returns {Promise<Category[]>} */
  list: (options) => request('/services', options),
  /** @returns {Promise<Category>} */
  getBySlug: (slug, options) => request(`/services/${encodeURIComponent(slug)}`, options),
}
