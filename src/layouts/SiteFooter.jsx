import { Link } from 'react-router-dom'
import { Wordmark } from './Wordmark'
import { Icon } from '../components/ui/Icon'
import { useContactDetails } from '../content/SiteContentProvider'

const serviceLinks = [
  // Same order as the category taxonomy, which leads with Digital Solutions.
  { to: '/services/digital-solutions', label: 'Digital solutions' },
  { to: '/services/printing', label: 'Printing' },
  { to: '/services/signage', label: 'Signage' },
  { to: '/services/promotional-display', label: 'Promotional & display' },
  { to: '/services/apparel', label: 'Branded apparel' },
  { to: '/services/decor', label: 'Wall décor' },
]

const shopLinks = [
  { to: '/shop/signage', label: 'Signage' },
  { to: '/shop/printing', label: 'Print' },
  { to: '/shop/apparel', label: 'Apparel' },
  { to: '/shop/promotional-display', label: 'Promotional' },
  { to: '/shop/decor', label: 'Décor' },
]

const companyLinks = [
  { to: '/about', label: 'About Motion' },
  { to: '/work', label: 'Our work' },
  { to: '/custom-project', label: 'Start a custom project' },
  { to: '/quote', label: 'Request a quote' },
  { to: '/track-order', label: 'Track an order' },
  { to: '/contact', label: 'Contact' },
]

function Column({ title, links }) {
  return (
    <div className="footer__col">
      <p className="t-eyebrow">{title}</p>
      {links.map(link => <Link key={link.to} to={link.to}>{link.label}</Link>)}
    </div>
  )
}

export function SiteFooter() {
  const { phone, whatsapp, email, address, hours, social } = useContactDetails()
  const year = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__col">
            {/* The footer has room for the complete logo, strapline included. */}
            <Wordmark variant="lockup" />
            <p className="t-body-sm t-muted" style={{ maxWidth: '26rem' }}>
              Digital, design, print and brand production in Kampala — websites, e-commerce,
              digital marketing and business systems, alongside signage, commercial printing,
              promotional materials and branded apparel.
            </p>
            {/* Contact details render only once the owner has published them. */}
            {(phone || whatsapp || email || address) && (
              <div className="stack stack--sm" style={{ marginBlockStart: 'var(--space-2)' }}>
                {phone && <a href={`tel:${phone.replace(/\s/g, '')}`} className="cluster"><Icon name="phone" size={16} />{phone}</a>}
                {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`} className="cluster"><Icon name="whatsapp" size={16} />WhatsApp</a>}
                {email && <a href={`mailto:${email}`} className="cluster"><Icon name="mail" size={16} />{email}</a>}
                {address && <p className="t-body-sm t-muted cluster"><Icon name="pin" size={16} />{address}</p>}
              </div>
            )}
            {hours && (
              <div className="stack stack--sm" style={{ marginBlockStart: 'var(--space-2)' }}>
                <p className="t-eyebrow">Opening hours</p>
                {(Array.isArray(hours) ? hours : [hours]).map(line => <p className="t-body-sm t-muted" key={line}>{line}</p>)}
              </div>
            )}
          </div>

          <Column title="Services" links={serviceLinks} />
          <Column title="Shop" links={shopLinks} />
          <Column title="Company" links={companyLinks} />
        </div>

        <div className="footer__bottom">
          <p className="t-caption">© {year} Motion. All rights reserved.</p>
          {Array.isArray(social) && social.length > 0 && (
            <nav aria-label="Social" className="cluster">
              {social.map(account => (
                <a key={account.url || account.label} href={account.url} className="t-caption link" rel="noreferrer noopener" target="_blank">
                  {account.label}
                </a>
              ))}
            </nav>
          )}
          <nav aria-label="Legal" className="cluster">
            <Link to="/privacy" className="t-caption">Privacy</Link>
            <Link to="/terms" className="t-caption">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
