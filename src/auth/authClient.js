import { env } from '../config/env'

/* Email and password authentication against Neon Auth.
 *
 * Neon Auth issues a JWT; `server/auth.js` verifies it against the project's
 * JWKS and reads `sub`. Nothing in the application cares *how* the token was
 * obtained, which is why email/password works without a single server change and
 * why Google sign-in is simply absent rather than removed.
 *
 * Two rules this file exists to keep:
 *
 *   1. No secret is ever held here. The publishable client key is designed to be
 *      public; the project's secret key is server-only and must never appear in
 *      a VITE_ variable.
 *   2. If Neon Auth is not configured, every call fails with a clear message.
 *      A login form that appears to work but cannot is worse than none.
 */

const REFRESH_KEY = 'motion.auth.refresh'

export class AuthError extends Error {
  constructor(message, { code, status } = {}) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.status = status
  }
}

export const isConfigured = () => Boolean(env.authBaseUrl && env.authProjectId && env.authPublishableKey)

function assertConfigured() {
  if (!isConfigured()) {
    throw new AuthError(
      'Sign-in is not available yet — this installation has no authentication project configured.',
      { code: 'auth_not_configured' },
    )
  }
}

/** Neon Auth speaks the Stack Auth REST protocol; these headers identify the project. */
function headers(extra = {}) {
  return {
    'content-type': 'application/json',
    'x-stack-access-type': 'client',
    'x-stack-project-id': env.authProjectId,
    'x-stack-publishable-client-key': env.authPublishableKey,
    ...extra,
  }
}

async function call(path, { method = 'POST', body, accessToken } = {}) {
  assertConfigured()
  const response = await fetch(`${env.authBaseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: headers(accessToken ? { 'x-stack-access-token': accessToken } : {}),
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    // Sign-in failures are reported without saying which half was wrong, so the
    // endpoint cannot be used to discover which email addresses exist.
    const message = response.status === 401 || response.status === 400
      ? 'That email address and password do not match.'
      : (payload?.error || payload?.message || 'Authentication failed. Please try again.')
    throw new AuthError(message, { code: payload?.code, status: response.status })
  }
  return payload
}

/* The refresh token is the durable credential; the access token is short-lived
   and kept in memory only, so it never sits in storage a script could read. */
const storeRefresh = (token) => {
  try { token ? window.localStorage.setItem(REFRESH_KEY, token) : window.localStorage.removeItem(REFRESH_KEY) } catch { /* private mode */ }
}
const readRefresh = () => {
  try { return window.localStorage.getItem(REFRESH_KEY) } catch { return null }
}

export const authClient = {
  isConfigured,

  async signUp({ email, password }) {
    const result = await call('/api/v1/auth/password/sign-up', { body: { email, password, verification_callback_url: `${window.location.origin}/sign-in` } })
    storeRefresh(result.refresh_token)
    return { accessToken: result.access_token }
  },

  async signIn({ email, password }) {
    const result = await call('/api/v1/auth/password/sign-in', { body: { email, password } })
    storeRefresh(result.refresh_token)
    return { accessToken: result.access_token }
  },

  /** Restores a session on page load. Returns null when there is nothing to restore. */
  async restore() {
    const refreshToken = readRefresh()
    if (!refreshToken || !isConfigured()) return null
    try {
      const result = await call('/api/v1/auth/sessions/current/refresh', { headers: { 'x-stack-refresh-token': refreshToken } })
      return { accessToken: result.access_token }
    } catch {
      // A refresh token that no longer works is cleared rather than retried.
      storeRefresh(null)
      return null
    }
  },

  /** Always clears local state, even if the network call fails. */
  async signOut(accessToken) {
    try { if (accessToken) await call('/api/v1/auth/sessions/current', { method: 'DELETE', accessToken }) } catch { /* the session is gone locally regardless */ }
    storeRefresh(null)
  },

  /** Sends a reset link. The response is identical whether or not the account exists. */
  async requestPasswordReset({ email }) {
    await call('/api/v1/auth/password/send-reset-code', { body: { email, callback_url: `${window.location.origin}/reset-password` } })
  },

  async resetPassword({ code, password }) {
    await call('/api/v1/auth/password/reset', { body: { code, password } })
  },
}
