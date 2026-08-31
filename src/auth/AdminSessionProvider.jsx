import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setAuthTokenProvider } from '../services/apiClient'
import { adminSessionService, readStoredAdminToken, storeAdminToken } from '../services/adminSession'

const AdminSessionContext = createContext({ status: 'anonymous', administrator: null })

export function AdminSessionProvider({ children }) {
  const [state, setState] = useState({
    status: readStoredAdminToken() ? 'loading' : 'anonymous',
    administrator: null,
  })

  useEffect(() => {
    setAuthTokenProvider(async () => readStoredAdminToken())
    return () => setAuthTokenProvider(null)
  }, [])

  const restore = useCallback(async () => {
    const token = readStoredAdminToken()
    if (!token) {
      setState({ status: 'anonymous', administrator: null })
      return null
    }
    try {
      const session = await adminSessionService.current({ token })
      setState({ status: 'authenticated', administrator: session.administrator })
      return session
    } catch {
      storeAdminToken(null)
      setState({ status: 'anonymous', administrator: null })
      return null
    }
  }, [])

  useEffect(() => { restore() }, [restore])

  const signIn = useCallback(async ({ username, password }) => {
    const session = await adminSessionService.login({ username, password })
    storeAdminToken(session.token)
    setState({ status: 'authenticated', administrator: session.administrator })
    return session
  }, [])

  const signOut = useCallback(async () => {
    const token = readStoredAdminToken()
    try {
      if (token) await adminSessionService.logout({ token })
    } catch { /* local state is cleared regardless */ }
    storeAdminToken(null)
    setState({ status: 'anonymous', administrator: null })
  }, [])

  const value = useMemo(() => ({
    ...state,
    isAuthenticated: state.status === 'authenticated',
    isOwner: state.administrator?.role === 'owner',
    signIn,
    signOut,
    restore,
  }), [state, signIn, signOut, restore])

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export const useAdminSession = () => useContext(AdminSessionContext)
