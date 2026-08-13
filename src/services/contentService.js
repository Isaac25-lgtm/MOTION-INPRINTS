import { request } from './apiClient'
export const contentService = { public: (options) => request('/content/public', options) }
