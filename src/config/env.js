const valueOf = (value = '') => String(value ?? '').trim()
export const env = Object.freeze({
  appName: valueOf(import.meta.env.VITE_APP_NAME) || 'Motion',
  appUrl: valueOf(import.meta.env.VITE_APP_URL),
  apiBaseUrl: valueOf(import.meta.env.VITE_API_BASE_URL),
  neonAuthUrl: valueOf(import.meta.env.VITE_NEON_AUTH_URL),
})
export function assertRuntimeConfig() {
  if (!env.apiBaseUrl) throw new Error('VITE_API_BASE_URL is required.')
  if (import.meta.env.PROD && env.apiBaseUrl.startsWith('/')) throw new Error('Production VITE_API_BASE_URL must be an absolute secure API URL.')
}
