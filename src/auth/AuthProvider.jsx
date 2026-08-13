import { createContext, useContext, useMemo, useState } from 'react'
const AuthContext = createContext({ status: 'anonymous', user: null })
export function AuthProvider({ children }) {
  // Session retrieval is intentionally server/API-mediated until Neon Auth is configured.
  const [state] = useState({ status: 'anonymous', user: null })
  const value = useMemo(() => state, [state])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
