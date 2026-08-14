import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Frame } from '../components/ui/Media'
import { formatAmount } from '../components/ui/Price'
import { EmptyState, ErrorState } from '../components/ui/States'
import { Breadcrumbs } from '../components/ui/Navigation'
import { QuantityControl } from '../components/ui/Form'
import { useCart } from '../features/cart/CartProvider'

/* Cart (Prompt 5.4).

   Every figure here comes from the revalidation response, never from what was
   stored when the item was added. Opening the cart is therefore also the moment
   a withdrawn product or a changed price is discovered and reported. */

function ConfigurationSummary({ selection }) {
  const entries = Object.entries(selection || {}).filter(([, value]) => value !== '' && value !== null && value !== false)
  if (!entries.length) return null
  return (
    <div className="cart-line__config">
      {entries.map(([key, value]) => (
        <span key={key} className="t-meta">
          {key.replace(/_/g, ' ')}: {value === true ? 'yes' : String(value)}
        </span>
      ))}
    </div>
  )
}

function Line({ line, priced, onQuantity, onRemove }) {
  const unavailable = priced && !priced.available
  const notPurchasable = priced && priced.available && !priced.purchasable

  return (
    <li className={['cart-line', (unavailable || notPurchasable) && 'cart-line--invalid'].filter(Boolean).join(' ')}>
      <Link to={`/product/${line.slug}`} aria-hidden="true" tabIndex={-1}>
        <Frame src={line.image} alt="" ratio="square" zoom={false} label="Image pending" />
      </Link>

      <div className="cart-line__body">
        <Link to={`/product/${line.slug}`} className="t-h4">{line.name}</Link>
        <ConfigurationSummary selection={line.selection} />

        {unavailable && <p className="cart-line__notice" role="alert">{priced.reason}</p>}
        {notPurchasable && (
          <p className="cart-line__notice" role="alert">
            This configuration is priced per job.{' '}
            <Link to={`/custom-project?product=${encodeURIComponent(line.slug)}`} className="link">Request a quote</Link>
          </p>
        )}
        {priced?.priceChanged && (
          <p className="cart-line__notice" role="status">
            The price for this item has changed since you added it. The amount shown is current.
          </p>
        )}

        <div className="cart-line__actions">
          <QuantityControl value={line.quantity} onChange={(value) => onQuantity(line.key, value)} label="Quantity" />
          <button type="button" className="btn btn--text" onClick={() => onRemove(line.key)}>Remove</button>
        </div>
      </div>

      <div className="stack stack--sm" style={{ justifyItems: 'end' }}>
        {priced?.total ? <p className="t-price">{formatAmount(priced.total, priced.currency)}</p> : <p className="t-price t-price--quote">—</p>}
        {priced?.unitPrice && line.quantity > 1 && <p className="t-meta">{formatAmount(priced.unitPrice, priced.currency)} each</p>}
      </div>
    </li>
  )
}

export function CartPage() {
  const { lines, setQuantity, remove, revalidate, validation } = useCart()

  // Reprice whenever the contents change, so the page can never show a stale total.
  useEffect(() => { revalidate() }, [revalidate])

  const priced = validation.data
  const byKey = new Map((priced?.items || []).map(item => [item.key, item]))
  const blocking = (priced?.items || []).filter(item => !item.available || !item.purchasable)

  if (!lines.length) {
    return (
      <div className="container">
        <div className="page-head">
          <Breadcrumbs trail={[{ label: 'Cart' }]} />
          <h1 className="t-h1 page-head__title">Your cart is empty</h1>
        </div>
        <div className="section section--flush-top">
          <EmptyState
            title="Nothing here yet"
            description="Browse the catalogue, or tell us about a job that needs quoting."
            action={<div className="cluster"><Button to="/shop" variant="primary" size="sm">Shop products</Button><Button to="/custom-project" variant="secondary" size="sm">Start a custom project</Button></div>}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Cart' }]} />
        <h1 className="t-h1 page-head__title">Your cart</h1>
      </div>

      <div className="section section--flush-top split">
        <div>
          {validation.error && (
            <ErrorState title="Prices could not be confirmed" description={validation.error.message} onRetry={revalidate} />
          )}
          <ul>
            {lines.map(line => (
              <Line
                key={line.key}
                line={line}
                priced={byKey.get(line.key)}
                onQuantity={setQuantity}
                onRemove={remove}
              />
            ))}
          </ul>
        </div>

        <div className="split__sticky stack">
          <div className="summary">
            <p className="t-eyebrow">Order summary</p>
            <div className="summary__row">
              <span>Items</span>
              <span>{lines.length}</span>
            </div>
            <div className="summary__row summary__row--total">
              <span>Subtotal</span>
              <span aria-live="polite">
                {validation.loading ? '…' : priced?.subtotal ? formatAmount(priced.subtotal, priced.currency) : '—'}
              </span>
            </div>
            {/* Delivery is decided at checkout; inventing a figure here would be a
                fake number on the most sensitive page of the site. */}
            <p className="t-caption">Delivery or collection is chosen at checkout.</p>

            <Button
              to="/checkout"
              variant="primary"
              block
              aria-disabled={blocking.length > 0 || validation.loading || undefined}
              onClick={(event) => { if (blocking.length > 0) event.preventDefault() }}
            >
              Continue to checkout
            </Button>

            {blocking.length > 0 && (
              <p className="t-caption" role="alert" style={{ color: 'var(--state-error)' }}>
                Resolve the highlighted {blocking.length === 1 ? 'item' : 'items'} before checking out.
              </p>
            )}
          </div>
          <Button to="/shop" variant="text" arrow>Continue shopping</Button>
        </div>
      </div>
    </div>
  )
}
