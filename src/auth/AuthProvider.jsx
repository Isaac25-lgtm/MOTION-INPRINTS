import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { authClient, isConfigured } from './authClient'
import { accountService } from '../services/accountService'
import { setAuthTokenProvider } from '../services/apiClient'

/* Session state.
 *
 * The access token lives in memory here and is handed to the API client, so
 * every request carries it without any component needing to know it exists. The
 * refresh token is the only thing persisted.
 *
 * The role shown in this context is read from the server profile, never from the
 * token or from anything the browser can set. It decides what to *render*;
 * `requireAdmin` on the server decides what is *allowed*. Those are different
 * jobs, and only the second one is security.
 */

const AuthContext = createContext({ status: 'anonymous', user: null })

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    // 'unconfigured' is a real state, distinct from 'anonymous': it means this
    // installation cannot sign anyone in, and the UI should say so rather than
    // present a form that will always fail.
    status: isConfigured() ? 'loading' : 'unconfigured',
    user: null,
    profile: null,
  })
  const tokenRef = useRef(null)

  // The API client pulls the token at call time, so a refresh mid-session is
  // picked up without re-wiring anything.
  useEffect(() => { setAuthTokenProvider(() => tokenRef.current) }, [])

  const loadProfile = useCallback(async () => {
    try {
      const profile = await accountService.profile()
      setState({ status: 'authenticated', user: { id: profile.auth_user_id }, profile })
    } catch (error) {
      // Authenticated but with no Motion profile yet — a first sign-in.
      if (error.status === 403) setState(current => ({ ...current, status: 'authenticated', profile: null }))
      else throw error
    }
  }, [])

  useEffect(() => {
    if (!isConfigured()) return
    let active = true
    authClient.restore()
      .then(async (session) => {
        if (!active) return
        if (!session) { setState({ status: 'anonymous', user: null, profile: null }); return }
        tokenRef.current = session.accessToken
        await loadProfile()
      })
      .catch(() => { if (active) setState({ status: 'anonymous', user: null, profile: null }) })
    return () => { active = false }
  }, [loadProfile])

  const signIn = useCallback(async (credentials) => {
    const session = await authClient.signIn(credentials)
    tokenRef.current = session.accessToken
    await loadProfile()
  }, [loadProfile])

  const signUp = useCallback(async (credentials) => {
    const session = await authClient.signUp(credentials)
    tokenRef.current = session.accessToken
    await loadProfile()
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await authClient.signOut(tokenRef.current)
    tokenRef.current = null
    setState({ status: 'anonymous', user: null, profile: null })
  }, [])

  const value = useMemo(() => ({
    ...state,
    // Convenience flags for rendering only.
    isAuthenticated: state.status === 'authenticated',
    isAdmin: state.profile?.role === 'admin',
    configured: isConfigured(),
    signIn, signUp, signOut,
    refreshProfile: loadProfile,
  }), [state, signIn, signUp, signOut, loadProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
