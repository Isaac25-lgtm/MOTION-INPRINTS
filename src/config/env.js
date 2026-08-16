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

  /* Neon Auth (Managed Better Auth) base URL — the only auth value the browser
     needs, and deliberately public.
   *
   * The previous integration additionally demanded a project id and a
   * publishable key and spoke the Stack Auth REST protocol. Neon Auth is now
   * Better Auth: the base URL alone identifies the instance, the session lives
   * in an HTTP-only cookie the SDK manages, and there is no publishable key to
   * hold. Those two variables are gone rather than left blank, so nobody tries
   * to populate them. */
  authBaseUrl: valueOf(import.meta.env.VITE_NEON_AUTH_URL),

  /* Whether Google is offered alongside email. Google is enabled per-project in
     the Neon console, which the browser cannot detect, so it is declared here.
     Default is on, matching the current project configuration. Set to "false" to
     hide the button rather than advertise a provider that will fail. */
  authGoogleEnabled: valueOf(import.meta.env.VITE_NEON_AUTH_GOOGLE) !== 'false',

  // Public base URL for published media. Absent means storage is not connected,
  // and the interface says so rather than showing an empty library as if it
  // were a working one.
  storagePublicBaseUrl: valueOf(import.meta.env.VITE_STORAGE_PUBLIC_BASE_URL),
})

export function assertRuntimeConfig() {
  if (!env.apiBaseUrl) throw new Error('VITE_API_BASE_URL is required.')
  if (import.meta.env.PROD && env.apiBaseUrl.startsWith('/')) {
    throw new Error('Production VITE_API_BASE_URL must be an absolute secure API URL.')
  }

  /* Auth is all-or-nothing, but "all" is now a single value. When it is absent
     the sign-in pages say accounts are switched off rather than rendering a form
     that cannot succeed. */
  if (env.authBaseUrl) {
    let parsed
    try { parsed = new URL(env.authBaseUrl) } catch {
      throw new Error('VITE_NEON_AUTH_URL must be an absolute URL, for example https://<endpoint>.neonauth.<region>.aws.neon.tech/neondb/auth')
    }
    if (import.meta.env.PROD && parsed.protocol !== 'https:') {
      throw new Error('VITE_NEON_AUTH_URL must use https in production.')
    }
    /* Catches the obsolete Stack-style value being pasted in. The Better Auth
       base URL ends in the database path, not a bare origin. */
    if (parsed.pathname === '/' || parsed.pathname === '') {
      throw new Error('VITE_NEON_AUTH_URL looks incomplete: it should include the auth path, for example https://<endpoint>.neonauth.<region>.aws.neon.tech/neondb/auth')
    }
  }

  /* Fail loudly if the removed Stack variables are still set, rather than
     ignoring them and leaving someone to wonder why their key does nothing. */
  const obsolete = ['VITE_NEON_AUTH_PROJECT_ID', 'VITE_NEON_AUTH_PUBLISHABLE_KEY']
    .filter(name => valueOf(import.meta.env[name]))
  if (obsolete.length) {
    throw new Error(`${obsolete.join(' and ')} are obsolete. Neon Auth now uses Better Auth, which needs only VITE_NEON_AUTH_URL. Remove them from your environment.`)
  }
}
