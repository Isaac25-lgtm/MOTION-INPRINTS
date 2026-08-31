import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { Wordmark } from './Wordmark'
import { Button } from '../components/ui/Button'
import { useAdminSession } from '../auth/AdminSessionProvider'

/* Route changes reset scroll and move focus to the main landmark, so keyboard and
   screen-reader users are not left at the previous page's position. */
function useRouteChange() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.getElementById('main')?.focus({ preventScroll: true })
  }, [pathname])
}

function Shell({ children, chrome = true }) {
  useRouteChange()
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {chrome && <SiteHeader />}
      <main id="main" tabIndex={-1}>{children ?? <Outlet />}</main>
      {chrome && <SiteFooter />}
    </div>
  )
}

export function PublicLayout() { return <Shell /> }

export function AdminLayout() {
  useRouteChange()
  const { signOut, administrator } = useAdminSession()
  const navigate = useNavigate()
  const leave = async () => {
    await signOut()
    navigate('/manager', { replace: true })
  }
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="header">
        <div className="container header__inner">
          <Wordmark showTagline={false} />
          <p className="t-eyebrow" style={{ marginInlineStart: 'var(--space-5)' }}>Administration</p>
          <div className="header__actions" style={{ marginInlineStart: 'auto' }}>
            {administrator?.username && <span className="t-meta">{administrator.username}</span>}
            <Button type="button" variant="text" size="sm" onClick={leave}>Sign out</Button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}><Outlet /></main>
    </div>
  )
}
