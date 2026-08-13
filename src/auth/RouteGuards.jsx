import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { LoadingState } from '../components/LoadingState'
function Guard({ children, admin }) {
  const { status, user } = useAuth(); const location = useLocation()
  if (status === 'loading') return <LoadingState />
  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />
  if (admin && user.role !== 'admin') return <Navigate to="/account" replace />
  return children
}
export const RequireAuth = ({ children }) => <Guard>{children}</Guard>
export const RequireAdmin = ({ children }) => <Guard admin>{children}</Guard>
