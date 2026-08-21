import { env } from '../config/env'

/* Supabase Auth — browser client.
 *
 * How the session is held:
 *
 *   supabase-js keeps the session (access + refresh tokens) in its own storage
 *   under the project URL. The Motion API is a different origin and never sees
 *   that storage. `token()` reads `session.access_token` and `apiClient` sends
 *   it as a bearer token; `server/auth.js` asks Supabase Auth `getUser(token)`
 *   to resolve it. The service_role key is not present in this file.
 *
 *   The SDK is loaded on demand. Imported statically it would sit on the
 *   critical path for every visitor, including the majority who browse and
 *   order as guests. As a dynamic import it becomes its own chunk.
 *
 * Two behaviours worth knowing:
 *
 *   1. Email confirmation is expected. Sign-up succeeds but returns no session
 *      until the emailed link is followed. `AuthError.code` carries
 *      `email_not_verified` so the interface can say so precisely.
 *   2. Redirects after Google or an emailed link only honour same-site internal
 *      paths. A value taken from a query parameter that pointed off-site would
 *      make this an open redirect.
 */

export const isConfigured = () => Boolean(env.supabaseUrl && env.supabasePublishableKey)

/** True only when Google is both enabled for the project and auth is configured. */
export const isGoogleEnabled = () => isConfigured() && env.authGoogleEnabled

export class AuthError extends Error {
  constructor(message, { code, status } = {}) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
  }
}

let clientPromise = null

async function getClient() {
  if (!isConfigured()) return null
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js')
      .then(({ createClient }) => createClient(env.supabaseUrl, env.supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }))
      .catch((error) => { clientPromise = null; throw error })
  }
  return clientPromise
}

async function requireClient() {
  const client = await getClient()
  if (!client) {
    throw new AuthError(
      'Sign-in is not available yet — this installation has no authentication project configured.',
      { code: 'auth_not_configured' },
    )
  }
  return client
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new AuthError(
      'Sign-in is not available yet — this installation has no authentication project configured.',
      { code: 'auth_not_configured' },
    )
  }
}

const origin = () => (typeof window === 'undefined' ? '' : window.location.origin)

/* Only same-site internal paths. A protocol-relative URL (`//evil.test`) or a
   full URL would turn a reset/Google return into an open redirect. */
export function safeInternalPath(value, fallback = '/') {
  if (typeof value !== 'string' || !value || value.length > 512) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  if (value.includes('://') || /[\r\n]/.test(value)) return fallback
  return value
}

const looksLikeJwt = (value) =>
  typeof value === 'string' && value.startsWith('eyJ') && value.split('.').length === 3

/* Pulls an access token out of a Supabase session result — and refuses
   anything that is not a JWT. A refresh token or opaque id must never be sent
   as `Authorization: Bearer`. */
export function extractJwt(result) {
  const candidates = [
    typeof result === 'string' ? result : null,
    result?.data?.session?.access_token,
    result?.session?.access_token,
    result?.data?.access_token,
    result?.access_token,
  ]
  return candidates.find(looksLikeJwt) || null
}

function presentUser(user) {
  if (!user) return null
  const meta = user.user_metadata || {}
  return {
    id: user.id,
    email: user.email || '',
    name: meta.full_name || meta.name || '',
    emailConfirmed: Boolean(user.email_confirmed_at),
  }
}

function unwrap(result) {
  const { data, error } = result || {}
  if (!error) return data

  const code = error.code || error.status
  const status = error.status
  const message = String(error.message || '')

  const opaque = new Set(['invalid_credentials', 'invalid_grant', 'user_not_found', 'INVALID_EMAIL_OR_PASSWORD'])
  if (opaque.has(code) || /invalid login credentials/i.test(message)) {
    throw new AuthError('That email address and password do not match.', { code: 'invalid_credentials', status })
  }

  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    throw new AuthError('Please confirm your email address first. We sent you a link when you signed up.', { code: 'email_not_verified', status })
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    throw new AuthError('That email address is already registered. Try signing in, or reset your password.', { code: 'email_in_use', status })
  }
  if (code === 'weak_password' || /password/i.test(message) && /least|short|weak/i.test(message)) {
    throw new AuthError('That password is too short.', { code: 'weak_password', status })
  }
  if (status === 429 || code === 'over_request_rate_limit') {
    throw new AuthError('Too many attempts. Please wait a moment and try again.', { code: 'rate_limited', status })
  }

  throw new AuthError(error.message || 'Authentication failed. Please try again.', { code, status })
}

async function call(fn) {
  assertConfigured()
  try {
    return unwrap(await fn(await requireClient()))
  } catch (caught) {
    if (caught instanceof AuthError) throw caught
    throw new AuthError('Could not reach the sign-in service. Check your connection and try again.', { code: 'network_error' })
  }
}

function presentSession(data) {
  const user = data?.user || data?.session?.user
  if (!user) return null
  return { user: presentUser(user), session: data.session || null }
}

export const authClient = {
  isConfigured,
  isGoogleEnabled,
  safeInternalPath,

  /** Creates the account. Returns `{ verificationRequired }` — with confirmation
   *  enabled no session exists yet, and the caller must say so rather than
   *  pretending the user is signed in. */
  async signUp({ email, password, name }) {
    const data = await call((c) => c.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name || email },
        emailRedirectTo: `${origin()}/sign-in?verified=1`,
      },
    }))
    return { verificationRequired: !data?.session, user: presentUser(data?.user) }
  },

  async signIn({ email, password }) {
    const data = await call((c) => c.auth.signInWithPassword({ email, password }))
    return { user: presentUser(data?.user || data?.session?.user) }
  },

  /** Google. Redirects away from the page, so nothing after this runs. */
  async signInWithGoogle({ next = '/account' } = {}) {
    if (!isGoogleEnabled()) {
      throw new AuthError('Google sign-in is not enabled for this installation.', { code: 'google_not_enabled' })
    }
    const destination = safeInternalPath(next, '/account')
    return call((c) => c.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin()}${destination}`,
      },
    }))
  },

  /** Restores a session on load, including the return from Google or an emailed link. */
  async getSession() {
    const client = await getClient()
    if (!client) return null
    try {
      const { data } = await client.auth.getSession()
      return presentSession(data)
    } catch { return null }
  },

  /** Short-lived access token for our own API. Never persisted by us. */
  async token() {
    const client = await getClient()
    if (!client) return null
    try {
      const { data } = await client.auth.getSession()
      return extractJwt(data)
    } catch {
      return null
    }
  },

  async signOut() {
    const client = await getClient().catch(() => null)
    if (!client) return
    try { await client.auth.signOut() } catch { /* the session is gone locally regardless */ }
  },

  onAuthStateChange(handler) {
    let unsubscribe = () => {}
    getClient().then((client) => {
      if (!client) return
      const { data } = client.auth.onAuthStateChange((event, session) => {
        handler(event, session)
      })
      unsubscribe = () => data?.subscription?.unsubscribe?.()
    }).catch(() => {})
    return () => unsubscribe()
  },

  /** Response is identical whether or not the account exists.
   *
   *  `next` is where the visitor goes after the new password is saved. Staff
   *  pass '/manager' so an owner returns to the staff flow rather than the
   *  customer account area.
   *
   *  This is also how a Google-only identity gains a password: the reset acts
   *  on the EXISTING user rather than creating a second account, so the person
   *  ends up with one identity and two ways to sign in. Confirmed Google and
   *  email/password identities that share an email are linked automatically;
   *  this app does not use Supabase manual identity linking. */
  async requestPasswordReset({ email, next = null }) {
    const client = await requireClient()
    const after = next ? `?next=${encodeURIComponent(safeInternalPath(next, '/sign-in'))}` : ''
    try {
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin()}/reset-password${after}`,
      })
    } catch { /* deliberately swallowed — see below */ }
  },

  async resetPassword({ password }) {
    return call((c) => c.auth.updateUser({ password }))
  },

  async changePassword({ password }) {
    return call((c) => c.auth.updateUser({ password }))
  },

  /* `next` is where the emailed link returns to. It defaults to the customer
     sign-in page, but staff must come back to /manager. */
  async resendVerification({ email, next = '/sign-in?verified=1' }) {
    const client = await requireClient()
    const destination = safeInternalPath(next, '/sign-in?verified=1')
    try {
      await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${origin()}${destination}` },
      })
    } catch { /* never reveals whether the address exists, is already confirmed, or is staff */ }
  },
}
