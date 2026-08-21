const valueOf = (value = '') => String(value ?? '').trim()

/* Normalises the API base URL so a bare origin works.
 *
 * The Render Blueprint wires this from the API service's RENDER_EXTERNAL_URL,
 * which is an origin with no path — `https://motion-api.onrender.com`. The
 * client appends resource paths (`/products`, `/me`), so it needs the `/api`
 * prefix too, and render.yaml has no string interpolation to add one.
 *
 * So it is added here when the value carries no path of its own. A URL that
 * already has one is left exactly as given, which keeps
 * `http://localhost:8787/api` and any custom mount point working untouched.
 */
function normaliseApiBaseUrl(value) {
  if (!value) return ''
  const trimmed = value.replace(/\/+$/, '')
  try {
    const url = new URL(trimmed)
    return url.pathname === '/' || url.pathname === '' ? `${url.origin}/api` : trimmed
  } catch {
    // Not absolute — a dev proxy path such as `/api`. Left for validation below.
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

  /* Supabase project origin. Public. Paired with the publishable key; together
     they identify the Auth project to the browser. The service_role key must
     never be given a VITE_ name. */
  supabaseUrl: valueOf(import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: valueOf(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY),

  /* Whether Google is offered alongside email. Google is enabled per-project in
     the Supabase dashboard, which the browser cannot detect, so it is declared
     here. Default is on. Set to "false" to hide the button rather than
     advertise a provider that will fail. */
  authGoogleEnabled: valueOf(import.meta.env.VITE_SUPABASE_GOOGLE) !== 'false',

  /* Public catalogue images. Derived from the Supabase URL so a separate
     storage variable is not required; override with VITE_STORAGE_PUBLIC_BASE_URL
     if the public bucket is ever mounted elsewhere. */
  storagePublicBaseUrl: valueOf(import.meta.env.VITE_STORAGE_PUBLIC_BASE_URL)
    || (valueOf(import.meta.env.VITE_SUPABASE_URL)
      ? `${valueOf(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')}/storage/v1/object/public/motion-public`
      : ''),
})

export function assertRuntimeConfig() {
  if (!env.apiBaseUrl) throw new Error('VITE_API_BASE_URL is required.')
  if (import.meta.env.PROD && env.apiBaseUrl.startsWith('/')) {
    throw new Error('Production VITE_API_BASE_URL must be an absolute secure API URL.')
  }

  /* Auth is all-or-nothing: both the URL and the publishable key, or neither.
     When they are absent the sign-in pages say accounts are switched off rather
     than rendering a form that cannot succeed. */
  const authPartial = Boolean(env.supabaseUrl) !== Boolean(env.supabasePublishableKey)
  if (authPartial) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set together.')
  }

  if (env.supabaseUrl) {
    let parsed
    try { parsed = new URL(env.supabaseUrl) } catch {
      throw new Error('VITE_SUPABASE_URL must be an absolute URL, for example https://<project-ref>.supabase.co')
    }
    if (import.meta.env.PROD && parsed.protocol !== 'https:') {
      throw new Error('VITE_SUPABASE_URL must use https in production.')
    }
    if (parsed.pathname !== '/' && parsed.pathname !== '') {
      throw new Error('VITE_SUPABASE_URL must be the project origin with no path, for example https://<project-ref>.supabase.co')
    }
  }

  /* Fail loudly if removed Neon variables are still set, rather than ignoring
     them and leaving someone to wonder why sign-in does nothing. */
  const obsolete = [
    'VITE_NEON_AUTH_URL',
    'VITE_NEON_AUTH_GOOGLE',
    'VITE_NEON_AUTH_VERIFICATION',
    'VITE_NEON_AUTH_PROJECT_ID',
    'VITE_NEON_AUTH_PUBLISHABLE_KEY',
  ].filter(name => valueOf(import.meta.env[name]))
  if (obsolete.length) {
    throw new Error(`${obsolete.join(' and ')} are obsolete. Motion now uses Supabase Auth. Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_SUPABASE_GOOGLE instead.`)
  }
}
