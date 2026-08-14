import { request } from './apiClient'

/**
 * @typedef {{ term: string, products: object[], services: object[], projects: object[] }} SearchResults
 */
export const searchService = {
  /** @returns {Promise<SearchResults>} */
  query: (term, options) => request(`/search?q=${encodeURIComponent(term)}`, options),
}
