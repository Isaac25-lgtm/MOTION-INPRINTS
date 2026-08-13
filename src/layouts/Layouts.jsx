import { Link, Outlet } from 'react-router-dom'

function Shell({ label, children }) {
  return <div className="app-shell">
    <header className="site-header"><Link to="/" className="wordmark">Motion</Link><span>{label}</span></header>
    <main>{children ?? <Outlet />}</main>
  </div>
}
export function PublicLayout() { return <Shell label="Design • Print • Brand" /> }
export function CustomerLayout() { return <Shell label="Customer account" /> }
export function AdminLayout() { return <Shell label="Administration" /> }
