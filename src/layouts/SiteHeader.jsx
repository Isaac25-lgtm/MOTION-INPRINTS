import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Wordmark } from './Wordmark'
import { SearchPanel } from './SearchPanel'
import { Drawer } from '../components/ui/Overlay'
import { IconButton } from '../components/ui/Button'
import { Icon } from '../components/ui/Icon'
import { useSiteContent, useContactDetails } from '../content/SiteContentProvider'

export const primaryNav = [
  { to: '/shop', label: 'Shop' },
  { to: '/services', label: 'Services' },
  { to: '/work', label: 'Our Work' },
  { to: '/services/digital-solutions', label: 'Digital Solutions' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
]

/* Announcement renders only when the owner has published one. */
function Announcement() {
  const { field } = useSiteContent()
  const message = field('announcement', 'default', 'message')
  const href = field('announcement', 'default', 'href')
  if (!message) return null
  return (
    <div className="announcement">
      <div className="container announcement__inner">
        <p>{message}{href && <> <Link to={href}>Read more</Link></>}</p>
      </div>
    </div>
  )
}

/* Mobile navigation is composed rather than stacked: primary sections set large
   with travelling arrows, then account, cart and direct contact beneath a rule. */
function MobileNav({ open, onClose, cartCount }) {
  const { phone, whatsapp } = useContactDetails()
  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="end">
      <nav className="mobile-nav" aria-label="Main">
        <div className="mobile-nav__primary">
          {primaryNav.map(item => (
            <Link key={item.to} to={item.to} onClick={onClose}>
              {item.label}
              <Icon name="arrowRight" size={20} className="arrow" />
            </Link>
          ))}
        </div>
        <div className="mobile-nav__secondary">
          <Link to="/account" onClick={onClose}>Account</Link>
          <Link to="/cart" onClick={onClose}>Cart{cartCount ? ` (${cartCount})` : ''}</Link>
          <Link to="/track-order" onClick={onClose}>Track an order</Link>
          <Link to="/custom-project" onClick={onClose}>Start a custom project</Link>
        </div>
        {(phone || whatsapp) && (
          <div className="mobile-nav__secondary rule" style={{ paddingBlockStart: 'var(--space-5)' }}>
            {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`} className="cluster"><Icon name="whatsapp" size={18} /> WhatsApp</a>}
            {phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className="cluster"><Icon name="phone" size={18} /> {phone}</a>}
          </div>
        )}
      </nav>
    </Drawer>
  )
}

export function SiteHeader({ cartCount = 0 }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      <Announcement />
      <header className="header">
        <div className="container header__inner">
          <Wordmark />
          <nav className="header__nav t-nav" aria-label="Main">
            {primaryNav.map(item => (
              <NavLink key={item.to} to={item.to} className="nav-item" end={item.to === '/services'}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header__actions">
            <IconButton icon="search" label="Search" onClick={() => setSearchOpen(true)} />
            <IconButton icon="account" label="Account" to="/account" />
            <IconButton icon="cart" label={`Cart${cartCount ? `, ${cartCount} items` : ', empty'}`} to="/cart" className="cart-indicator">
              {cartCount > 0 && <span className="cart-indicator__count" aria-hidden="true">{cartCount}</span>}
            </IconButton>
            <IconButton icon="menu" label="Open menu" className="header__menu" onClick={() => setMenuOpen(true)} />
          </div>
        </div>
      </header>
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} cartCount={cartCount} />
      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
