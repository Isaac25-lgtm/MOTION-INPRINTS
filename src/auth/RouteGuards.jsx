import { Navigate, useLocation } from 'react-router-dom'
import { useAdminSession } from './AdminSessionProvider'
import { LoadingState } from '../components/LoadingState'

/* Route guards decide what to *render*. They are not security.
 *
 * Every management endpoint is independently guarded on the server by
 * `requireAdmin`, which reads a hashed administrator session. Editing anything
 * in the browser changes what this component draws and nothing about what the
 * API will return.
 */
export function RequireOwner({ children }) {
  const { status, isOwner } = useAdminSession()
  const location = useLocation()

  if (status === 'loading') return <div className="container section"><LoadingState label="Checking your session" /></div>
  if (status !== 'authenticated' || !isOwner) {
    return <Navigate to="/manager" replace state={{ from: location.pathname }} />
  }
  return children
}

export const RequireAdmin = RequireOwner
