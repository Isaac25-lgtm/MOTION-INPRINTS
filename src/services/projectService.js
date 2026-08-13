import { request } from './apiClient'
export const projectService = { list: (options) => request('/projects', options), getBySlug: (slug, options) => request(`/projects/${encodeURIComponent(slug)}`, options) }
