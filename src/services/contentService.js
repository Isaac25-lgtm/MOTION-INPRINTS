import { request } from './apiClient'

/**
 * @typedef {{ section: string, entry_key: string, value: Record<string, unknown> }} ContentEntry
 */
export const contentService = {
  /** Published CMS entries only. @returns {Promise<ContentEntry[]>} */
  public: (options) => request('/content/public', options),
  update: (section, body, options) => request(`/admin/content/${encodeURIComponent(section)}`, { ...options, method: 'PATCH', body }),
}
