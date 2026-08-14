import { Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { Wordmark } from './Wordmark'

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

/* Customer and admin areas share the public header so navigation stays continuous,
   and add their own section heading. */
function AreaShell({ label }) {
  useRouteChange()
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <div className="container">
          <p className="t-eyebrow" style={{ paddingBlockStart: 'var(--space-6)' }}>{label}</p>
        </div>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  )
}

export function CustomerLayout() { return <AreaShell label="Customer account" /> }

export function AdminLayout() {
  useRouteChange()
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="header">
        <div className="container header__inner">
          <Wordmark showTagline={false} />
          <p className="t-eyebrow" style={{ marginInlineStart: 'var(--space-5)' }}>Administration</p>
        </div>
      </header>
      <main id="main" tabIndex={-1}><Outlet /></main>
    </div>
  )
}
