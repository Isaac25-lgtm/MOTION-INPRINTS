const valueOf = (value = '') => String(value ?? '').trim()

function normaliseApiBaseUrl(value) {
  if (!value) return ''
  const trimmed = value.replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    return url.pathname === '/' || url.pathname === '' ? `${url.origin}/api` : trimmed
  } catch {
    return trimmed
  }
}

/* Browser configuration.
 *
 * Everything here ships in the bundle and is therefore public by definition.
 * Nothing secret may be given a VITE_ name — see ENVIRONMENT.md.
 */
export const env = Object.freeze({
  appName: valueOf(import.meta.env.VITE_APP_NAME) || 'Motion',
  appUrl: valueOf(import.meta.env.VITE_APP_URL),
  apiBaseUrl: normaliseApiBaseUrl(valueOf(import.meta.env.VITE_API_BASE_URL)),
  storagePublicBaseUrl: valueOf(import.meta.env.VITE_STORAGE_PUBLIC_BASE_URL),
})

export function assertRuntimeConfig() {
  if (!env.apiBaseUrl) throw new Error('VITE_API_BASE_URL is required.')
  if (import.meta.env.PROD && env.apiBaseUrl.startsWith('/')) {
    throw new Error('Production VITE_API_BASE_URL must be an absolute secure API URL.')
  }

  const obsolete = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_GOOGLE',
    'VITE_NEON_AUTH_URL',
    'VITE_NEON_AUTH_GOOGLE',
    'VITE_NEON_AUTH_VERIFICATION',
    'VITE_NEON_AUTH_PROJECT_ID',
    'VITE_NEON_AUTH_PUBLISHABLE_KEY',
  ].filter((name) => valueOf(import.meta.env[name]))
  if (obsolete.length) {
    throw new Error(`${obsolete.join(' and ')} are obsolete. Motion uses Neon PostgreSQL and server-owned administrator sessions.`)
  }
}
