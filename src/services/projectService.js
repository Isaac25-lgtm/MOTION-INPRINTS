import { request } from './apiClient'

/**
 * @typedef {object} Project
 * @property {string} id
 * @property {string} title
 * @property {string} slug
 * @property {string|null} description
 * @property {string|null} client_name
 * @property {string|null} location
 * @property {string|null} completed_on  ISO date.
 * @property {string|null} category_name
 * @property {string|null} category_slug
 * @property {string|null} image
 * @property {{image: string|null, alt: string}[]} [gallery]
 */

const query = (params = {}) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, value) })
  const string = search.toString()
  return string ? `?${string}` : ''
}

export const projectService = {
  /** @returns {Promise<Project[]>} */
  list: (params, options) => request(`/projects${query(params)}`, options),
  /** @returns {Promise<Project>} */
  getBySlug: (slug, options) => request(`/projects/${encodeURIComponent(slug)}`, options),
}
