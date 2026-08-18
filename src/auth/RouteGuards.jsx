import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { LoadingState } from '../components/LoadingState'

/* Route guards decide what to *render*. They are not security.
 *
 * Every protected endpoint is independently guarded on the server by
 * `requireAuth` / `requireCustomer` / `requireAdmin`, which read a verified JWT
 * and the role stored in the database. Editing anything in the browser changes
 * what this component draws and nothing about what the API will return.
 *
 * The role is read from the server-issued profile, never from the token payload
 * and never from anything the client can set.
 */
function Guard({ children, owner }) {
  const { status, profile } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <div className="container section"><LoadingState label="Checking your session" /></div>

  // No authentication project configured: say so rather than bouncing the
  // visitor to the homepage with no explanation.
  if (status === 'unconfigured') return <Navigate to={owner ? '/manager' : '/sign-in'} replace />

  if (status !== 'authenticated') {
    const destination = owner ? '/manager' : '/sign-in'
    return <Navigate to={destination} replace state={{ from: location.pathname }} />
  }

  // Signed in but with no Motion profile yet — first sign-in completes it there.
  // The profile route is exempt, or this would redirect to itself forever.
  /* Signed in with no Motion profile yet — first sign-in completes it there.
     Skipped for management routes: an owner is provisioned by the staff
     bootstrap and must never be sent through customer onboarding. */
  if (!owner && !profile && location.pathname !== '/account/profile') return <Navigate to="/account/profile" replace />

  /* A customer who reaches a management route is sent to their own account, not
     to the staff sign-in page: telling them a staff area exists is information
     they have no use for. */
  if (owner && profile.role !== 'owner') return <Navigate to="/account" replace />

  return children
}

export const RequireAuth = ({ children }) => <Guard>{children}</Guard>
export const RequireOwner = ({ children }) => <Guard owner>{children}</Guard>
/* Retained for existing call sites; a strict alias for RequireOwner. */
export const RequireAdmin = RequireOwner
