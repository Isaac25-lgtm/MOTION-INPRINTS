const valueOf = (value = '') => String(value ?? '').trim()

/* Browser configuration.
 *
 * Everything here ships in the bundle and is therefore public by definition. The
 * auth publishable key is designed for that; the project's SECRET key is
 * server-only and must never be given a VITE_ name — see ENVIRONMENT.md.
 */
export const env = Object.freeze({
  appName: valueOf(import.meta.env.VITE_APP_NAME) || 'Motion',
  appUrl: valueOf(import.meta.env.VITE_APP_URL),
  apiBaseUrl: valueOf(import.meta.env.VITE_API_BASE_URL),
  // Neon Auth, for email/password sign-in. Absent means accounts are switched
  // off and the interface says so rather than offering a form that cannot work.
  authBaseUrl: valueOf(import.meta.env.VITE_NEON_AUTH_URL),
  authProjectId: valueOf(import.meta.env.VITE_NEON_AUTH_PROJECT_ID),
  authPublishableKey: valueOf(import.meta.env.VITE_NEON_AUTH_PUBLISHABLE_KEY),
  // Public base URL for published media. Absent means storage is not connected,
  // and the interface says so rather than showing an empty library as if it
  // were a working one.
  storagePublicBaseUrl: valueOf(import.meta.env.VITE_STORAGE_PUBLIC_BASE_URL),
})

export function assertRuntimeConfig() {
  if (!env.apiBaseUrl) throw new Error('VITE_API_BASE_URL is required.')
  if (import.meta.env.PROD && env.apiBaseUrl.startsWith('/')) throw new Error('Production VITE_API_BASE_URL must be an absolute secure API URL.')
  // Partial auth configuration is worse than none: it produces a form that looks
  // usable and fails on submit. Refuse to start rather than ship that.
  const authValues = [env.authBaseUrl, env.authProjectId, env.authPublishableKey]
  if (authValues.some(Boolean) && !authValues.every(Boolean)) {
    throw new Error('Neon Auth needs VITE_NEON_AUTH_URL, VITE_NEON_AUTH_PROJECT_ID and VITE_NEON_AUTH_PUBLISHABLE_KEY together, or none of them.')
  }
}
