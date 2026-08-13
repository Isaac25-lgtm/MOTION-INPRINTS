import { request } from './apiClient'
export const categoryService = { list: (options) => request('/categories', options) }
