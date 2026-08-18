import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authClient, isConfigured, isGoogleEnabled } from './authClient'
import { accountService } from '../services/accountService'
import { setAuthTokenProvider } from '../services/apiClient'

/* Session state.
 *
 * The durable credential is an HTTP-only cookie owned by Neon Auth, which this
 * code cannot read and does not try to. Nothing is persisted here. What the API
 * client needs is a short-lived JWT, fetched on demand by `authClient.token()`
 * and cached in memory for a minute so a burst of requests does not mint one
 * each. An earlier version kept a long-lived refresh token in localStorage; that
 * is gone.
 *
 * The role in this context comes from the server profile, never from the token
 * and never from anything the browser can set. It decides what to *render*;
 * `requireAdmin` on the server decides what is *allowed*. Only the second is
 * security.
 */

const AuthContext = createContext({ status: 'anonymous', user: null })

/* Tokens are short-lived by design. Caching for 60s keeps a page of parallel
   requests down to one mint, while staying far inside the token's lifetime. */
const TOKEN_TTL_MS = 60_000

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    // 'unconfigured' is a real state, distinct from 'anonymous': it means this
    // installation cannot sign anyone in, and the UI should say so rather than
    // present a form that will always fail.
    status: isConfigured() ? 'loading' : 'unconfigured',
    user: null,
    profile: null,
  })

  /* Registered once. The API client pulls a token at call time, so a sign-in or
     sign-out later in the session is picked up with no re-wiring. */
  useEffect(() => {
    let cached = { token: null, at: 0 }
    setAuthTokenProvider(async () => {
      const now = Date.now()
      if (cached.token && now - cached.at < TOKEN_TTL_MS) return cached.token
      const token = await authClient.token()
      cached = { token, at: now }
      return token
    })
    return () => setAuthTokenProvider(null)
  }, [])

  const loadProfile = useCallback(async (user) => {
    try {
      const profile = await accountService.profile()
      setState({ status: 'authenticated', user: user || { id: profile.auth_user_id }, profile })
    } catch (error) {
      /* Authenticated but with no Motion profile yet — a first sign-in. The
         route guard sends them to /account/profile to complete it. */
      if (error.status === 403 || error.status === 404) {
        setState({ status: 'authenticated', user: user || null, profile: null })
      } else throw error
    }
  }, [])

  /* Restores an existing session on load. This is also what completes a Google
     sign-in: the provider redirects back to our origin with the session cookie
     already set, so there is no code to exchange here — the session simply
     exists, and this picks it up. */
  const restore = useCallback(async () => {
    const session = await authClient.getSession()
    if (!session) { setState({ status: 'anonymous', user: null, profile: null }); return null }
    await loadProfile(session.user)
    return session
  }, [loadProfile])

  useEffect(() => {
    if (!isConfigured()) return undefined
    let active = true
    restore().catch(() => { if (active) setState({ status: 'anonymous', user: null, profile: null }) })
    return () => { active = false }
  }, [restore])

  const signIn = useCallback(async (credentials) => {
    await authClient.signIn(credentials)
    await restore()
  }, [restore])

  /* Returns the verification state rather than assuming a session exists. With
     email verification enabled — as it is on this project — sign-up creates the
     account but no session, and the page must say so instead of redirecting to
     an account area the user cannot reach yet. */
  const signUp = useCallback(async (credentials) => {
    const result = await authClient.signUp(credentials)
    if (!result.verificationRequired) await restore()
    return result
  }, [restore])

  const signInWithGoogle = useCallback((options) => authClient.signInWithGoogle(options), [])

  const signOut = useCallback(async () => {
    await authClient.signOut()
    setState({ status: 'anonymous', user: null, profile: null })
  }, [])

  const value = useMemo(() => ({
    ...state,
    // Convenience flags for rendering only.
    isAuthenticated: state.status === 'authenticated',
    isOwner: state.profile?.role === 'owner',
    isAdmin: state.profile?.role === 'owner',
    configured: isConfigured(),
    googleEnabled: isGoogleEnabled(),
    signIn, signUp, signInWithGoogle, signOut,
    refreshProfile: () => loadProfile(state.user),
  }), [state, signIn, signUp, signInWithGoogle, signOut, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
