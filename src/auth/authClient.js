import { env } from '../config/env'

/* Neon Auth — Managed Better Auth.
 *
 * This replaces an earlier integration written against Stack Auth: project id
 * and publishable key headers (`x-stack-*`) and `/api/v1/auth/...` endpoints.
 * Neon Auth is Better Auth now; none of that exists. The base URL alone
 * identifies the instance.
 *
 * How the session is held, and why there is no token in localStorage:
 *
 *   The SDK authenticates against the Neon Auth origin, which sets an HTTP-only
 *   `__Secure-neonauth.session_token` cookie. Script cannot read it, so an XSS
 *   cannot exfiltrate the durable credential. The previous implementation kept a
 *   long-lived refresh token in localStorage precisely where a script could read
 *   it; that is gone, and nothing here writes to storage.
 *
 *   Because the cookie belongs to the Neon Auth origin rather than ours, every
 *   call must be credentialed. `createAuthClient` handles that internally.
 *
 * How our own API is authorised:
 *
 *   The cookie is for Neon Auth, not for us. `token()` exchanges the session for
 *   a short-lived EdDSA JWT which `apiClient` sends as a bearer token, and
 *   `server/auth.js` verifies against the JWKS. The JWT is never stored — it is
 *   fetched per request batch and cached in memory only.
 *
 * Two behaviours worth knowing, both verified against the live project:
 *
 *   1. Email verification is enabled. Sign-up succeeds but returns no session,
 *      and the first sign-in fails with EMAIL_NOT_VERIFIED until the emailed
 *      link is followed. `AuthError.code` carries that through so the interface
 *      can say so precisely.
 *   2. Only origins registered in the Neon console may call the API. An
 *      unregistered origin fails with INVALID_ORIGIN before any credential is
 *      checked — see ENVIRONMENT.md.
 */

export const isConfigured = () => Boolean(env.authBaseUrl)

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

/* The SDK is loaded on demand, not at module scope.
 *
 * Imported statically it added ~330KB (~82KB gzipped) to the entry chunk, which
 * every visitor pays for on first paint — including the majority who browse the
 * catalogue and order as guests without ever signing in. Bandwidth is not free
 * for the audience this site is built for.
 *
 * As a dynamic import it becomes its own chunk: the page renders, then the
 * session resolves. The bytes are the same for someone who signs in; they are
 * simply no longer on the critical path. Resolved once and reused. */
let clientPromise = null

async function getClient() {
  if (!isConfigured()) return null
  if (!clientPromise) {
    clientPromise = import('@neondatabase/neon-js/auth')
      .then(({ createAuthClient }) => createAuthClient(env.authBaseUrl))
      .catch(error => { clientPromise = null; throw error })
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

/* Every SDK call resolves to `{ data, error }` rather than throwing. This turns
   the error half into a thrown AuthError so call sites use ordinary try/catch,
   and rewrites the messages that would otherwise leak account existence. */
function unwrap(result) {
  const { data, error } = result || {}
  if (!error) return data

  const code = error.code || error.status
  const status = error.status

  /* Sign-in must not distinguish "no such account" from "wrong password", or the
     form becomes an oracle for which email addresses are registered. */
  const opaque = new Set(['INVALID_EMAIL_OR_PASSWORD', 'USER_NOT_FOUND', 'INVALID_PASSWORD', 'INVALID_EMAIL'])
  if (opaque.has(code)) {
    throw new AuthError('That email address and password do not match.', { code: 'invalid_credentials', status })
  }

  if (code === 'EMAIL_NOT_VERIFIED') {
    throw new AuthError('Please confirm your email address first. We sent you a link when you signed up.', { code: 'email_not_verified', status })
  }
  if (code === 'USER_ALREADY_EXISTS' || code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
    /* Sign-up cannot be made fully opaque — the account either gets created or
       it does not — but it says nothing about passwords or provider. */
    throw new AuthError('That email address is already registered. Try signing in, or reset your password.', { code: 'email_in_use', status })
  }
  if (code === 'INVALID_ORIGIN') {
    throw new AuthError('This site’s address is not authorised for sign-in. Add it to the Neon Auth trusted origins.', { code: 'invalid_origin', status })
  }
  if (code === 'PASSWORD_TOO_SHORT') {
    throw new AuthError('That password is too short.', { code: 'weak_password', status })
  }
  if (status === 429) {
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
    // A network failure must not read as a rejected credential.
    throw new AuthError('Could not reach the sign-in service. Check your connection and try again.', { code: 'network_error' })
  }
}

/* Where the browser should land after following an emailed link or returning
   from Google. Always our own origin — never a value taken from a query
   parameter, which would make this an open redirect. */
const origin = () => (typeof window === 'undefined' ? '' : window.location.origin)

export const authClient = {
  isConfigured,
  isGoogleEnabled,

  /** Creates the account. Returns `{ verificationRequired }` — with verification
   *  enabled no session exists yet, and the caller must say so rather than
   *  pretending the user is signed in. */
  async signUp({ email, password, name }) {
    const data = await call(c => c.signUp.email({
      email,
      password,
      name: name || email,
      callbackURL: `${origin()}/sign-in?verified=1`,
    }))
    return { verificationRequired: !data?.token, user: data?.user || null }
  },

  async signIn({ email, password }) {
    const data = await call(c => c.signIn.email({ email, password }))
    return { user: data?.user || null }
  },

  /** Google. Redirects away from the page, so nothing after this runs. */
  async signInWithGoogle({ next = '/account' } = {}) {
    if (!isGoogleEnabled()) {
      throw new AuthError('Google sign-in is not enabled for this installation.', { code: 'google_not_enabled' })
    }
    return call(c => c.signIn.social({
      provider: 'google',
      callbackURL: `${origin()}${next}`,
      errorCallbackURL: `${origin()}/sign-in?error=oauth`,
    }))
  },

  /** Restores a session on load. Returns null when there is nothing to restore. */
  async getSession() {
    const client = await getClient()
    if (!client) return null
    try {
      const { data } = await client.getSession()
      return data?.user ? { user: data.user, session: data.session || null } : null
    } catch { return null }
  },

  /** Short-lived JWT for our own API. Never persisted. */
  async token() {
    const client = await getClient()
    if (!client) return null
    try {
      const { data } = await client.token()
      return data?.token || null
    } catch { return null }
  },

  async signOut() {
    const client = await getClient().catch(() => null)
    if (!client) return
    try { await client.signOut() } catch { /* the session is gone locally regardless */ }
  },

  /** Response is identical whether or not the account exists. */
  async requestPasswordReset({ email }) {
    const client = await requireClient()
    try {
      await client.requestPasswordReset({ email, redirectTo: `${origin()}/reset-password` })
    } catch { /* deliberately swallowed — see below */ }
    /* No error is surfaced. Reporting failure here would reveal which addresses
       are registered, which is the whole thing this flow must not do. */
  },

  async resetPassword({ token, password }) {
    return call(c => c.resetPassword({ newPassword: password, token }))
  },

  async changePassword({ currentPassword, password }) {
    return call(c => c.changePassword({ currentPassword, newPassword: password, revokeOtherSessions: true }))
  },

  async resendVerification({ email }) {
    const client = await requireClient()
    try {
      await client.sendVerificationEmail({ email, callbackURL: `${origin()}/sign-in?verified=1` })
    } catch { /* same reasoning as password reset */ }
  },
}
