import { request } from './apiClient'

const STORAGE_KEY = 'motion.admin.session'

export function readStoredAdminToken() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

export function storeAdminToken(token) {
  try {
    if (token) sessionStorage.setItem(STORAGE_KEY, token)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch { /* private mode */ }
}

export const adminSessionService = {
  login: (body, options) => request('/admin/session', { ...options, method: 'POST', body, token: null }),
  current: (options) => request('/admin/session', options),
  logout: (options) => request('/admin/session', { ...options, method: 'DELETE' }),
}

