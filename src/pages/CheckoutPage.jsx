import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field, ChoiceGroup } from '../components/ui/Form'
import { formatAmount } from '../components/ui/Price'
import { Breadcrumbs } from '../components/ui/Navigation'
import { EmptyState, LoadingState } from '../components/ui/States'
import { useToast } from '../components/ToastProvider'
import { useCart } from '../features/cart/CartProvider'
import { orderService } from '../services/orderService'
import { useAuth } from '../auth/AuthProvider'
import { ArtworkUploader } from '../features/artwork/ArtworkUploader'

/* Checkout (Prompt 8.1).

   Guest-first: no account is required, and none is asked for. The figures shown
   are the ones the server returned from revalidation, and the submitted request
   carries no money at all — the server prices the order again before writing it. */

const fulfilmentOptions = [
  { value: 'collection', label: 'Collection — pick up from Motion' },
  { value: 'delivery', label: 'Delivery' },
]

export function CheckoutPage() {
  const navigate = useNavigate()
  const notify = useToast()
  const { lines, revalidate, validation, clear } = useCart()
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', method: 'collection', address: '', deliveryNotes: '', notes: '' })
  const [artworkActions, setArtworkActions] = useState({})
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  // A stable key per attempt, so a double-click or a retry after a timeout cannot
  // produce two orders.
  const idempotencyKey = useMemo(() => `checkout-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`, [lines.length])

  useEffect(() => { revalidate() }, [revalidate])

  const priced = validation.data
  const blocking = (priced?.items || []).filter(item => !item.available || !item.purchasable)
  const set = (name) => (event) => setForm(current => ({ ...current, [name]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setErrors({})
    setSubmitting(true)
    try {
      const order = await orderService.place({
        items: lines.map(line => {
          const item = (priced?.items || []).find(candidate => candidate.key === line.key)
          const artworkAction = item?.designServiceRequired || item?.artworkRequirement === 'none'
            ? 'not_required'
            : item?.artworkRequirement === 'optional'
              ? (artworkActions[line.key] || 'upload_later')
              : 'upload_later'
          return { productId: line.productId, quantity: line.quantity, selection: line.selection, artworkAction }
        }),
        contact: { name: form.name, email: form.email, phone: form.phone, company: form.company || undefined },
        fulfilment: { method: form.method, address: form.address || undefined, notes: form.deliveryNotes || undefined },
        notes: form.notes || undefined,
      }, idempotencyKey)
      clear()
      navigate(`/order-confirmed/${order.reference}`, { state: { order } })
    } catch (error) {
      if (error.details) {
        setErrors(Object.fromEntries(Object.entries(error.details).map(([key, value]) => [key.split('.').pop(), value[0]])))
      }
      notify(error.message || 'Your order could not be placed.', 'error')
      // A failed attempt releases its key server-side, so retrying is safe.
    } finally {
      setSubmitting(false)
    }
  }

  if (!lines.length) {
    return (
      <div className="container">
        <div className="page-head">
          <Breadcrumbs trail={[{ to: '/cart', label: 'Cart' }, { label: 'Checkout' }]} />
          <h1 className="t-h1 page-head__title">Nothing to check out</h1>
        </div>
        <div className="section section--flush-top">
          <EmptyState title="Your cart is empty" action={<Button to="/shop" variant="primary" size="sm">Shop products</Button>} />
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/cart', label: 'Cart' }, { label: 'Checkout' }]} />
        <h1 className="t-h1 page-head__title">Checkout</h1>
        <p className="t-body t-muted t-measure">
          No account needed. We will confirm your order and payment arrangements directly.
        </p>
      </div>

      <form className="section section--flush-top split" onSubmit={submit} noValidate>
        <div className="stack stack--lg">
          <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="t-h3" style={{ padding: 0, marginBlockEnd: 'var(--space-4)' }}>Your details</legend>
            <Field label="Full name" value={form.name} onChange={set('name')} error={errors.name} required autoComplete="name" />
            <Field label="Phone number" type="tel" value={form.phone} onChange={set('phone')} error={errors.phone} hint="So we can reach you about production and delivery." required autoComplete="tel" />
            <Field label="Email" type="email" value={form.email} onChange={set('email')} error={errors.email} required autoComplete="email" />
            <Field label="Company or organisation" value={form.company} onChange={set('company')} error={errors.company} optional autoComplete="organization" />
          </fieldset>

          <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="t-h3" style={{ padding: 0, marginBlockEnd: 'var(--space-4)' }}>How would you like it?</legend>
            <ChoiceGroup
              legend="Collection or delivery"
              name="fulfilment"
              value={form.method}
              onChange={(value) => setForm(current => ({ ...current, method: value }))}
              options={fulfilmentOptions}
              columns={1}
            />
            {form.method === 'delivery' && (
              <>
                <Field as="textarea" label="Delivery address" value={form.address} onChange={set('address')} error={errors.address} required hint="Street, building and area, plus any landmark that helps." />
                <Field label="Delivery notes" value={form.deliveryNotes} onChange={set('deliveryNotes')} optional />
                {/* No delivery charge is shown because no delivery pricing rule
                    exists yet. Inventing one here would be a fake number. */}
                <p className="t-caption">Delivery cost depends on the location and load. We will confirm it with you before dispatch.</p>
              </>
            )}
          </fieldset>

          <Field as="textarea" label="Anything else we should know?" value={form.notes} onChange={set('notes')} optional />

          {(priced?.items || []).some(item => item.artworkRequirement === 'optional' && !item.designServiceRequired) && (
            <fieldset className="stack" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="t-h3" style={{ padding: 0, marginBlockEnd: 'var(--space-4)' }}>Artwork</legend>
              {(priced?.items || []).filter(item => item.artworkRequirement === 'optional' && !item.designServiceRequired).map(item => (
                <ChoiceGroup
                  key={item.key}
                  legend={item.name}
                  name={`artwork-${item.key}`}
                  value={artworkActions[item.key] || 'upload_later'}
                  onChange={(value) => setArtworkActions(current => ({ ...current, [item.key]: value }))}
                  options={[
                    { value: 'upload_later', label: 'I will provide artwork after ordering' },
                    { value: 'not_required', label: 'No artwork is needed for this item' },
                  ]}
                  columns={1}
                />
              ))}
            </fieldset>
          )}
        </div>

        <div className="split__sticky stack">
          <div className="summary">
            <p className="t-eyebrow">Your order</p>
            {validation.loading && <LoadingState label="Confirming prices" />}
            {(priced?.items || []).map(item => (
              <div className="summary__row" key={item.key}>
                <span>
                  {item.name} × {item.quantity}
                  {item.designServiceRequired
                    ? <small className="t-meta" style={{ display: 'block' }}>Motion design service selected</small>
                    : item.artworkRequirement === 'required'
                      ? <small className="t-meta" style={{ display: 'block' }}>Artwork required after ordering</small>
                      : null}
                </span>
                <span>{item.total ? formatAmount(item.total, item.currency) : '—'}</span>
              </div>
            ))}
            <div className="summary__row summary__row--total">
              <span>Subtotal</span>
              <span>{priced?.subtotal ? formatAmount(priced.subtotal, priced.currency) : '—'}</span>
            </div>
            {form.method === 'delivery' && (
              <div className="summary__row"><span>Delivery</span><span>Confirmed separately</span></div>
            )}

            <Button type="submit" variant="primary" block disabled={submitting || blocking.length > 0 || validation.loading}>
              {submitting ? 'Placing order…' : 'Place order'}
            </Button>

            {blocking.length > 0 && (
              <p className="t-caption" role="alert" style={{ color: 'var(--state-error)' }}>
                Some items need attention. <Link to="/cart" className="link">Review your cart</Link>.
              </p>
            )}
            <p className="t-caption">
              Placing an order does not take payment. We confirm the final amount, including
              any delivery, before anything is charged.
            </p>
          </div>
        </div>
      </form>
    </div>
  )
}

/* Confirmation (Prompt 8.3). States what is known and nothing more — no invented
   delivery date, and no claim that a message was sent. */
export function OrderConfirmedPage() {
  const { user } = useAuth()
  const { state } = window.history
  const order = state?.usr?.order || null
  const reference = window.location.pathname.split('/').pop()

  return (
    <div className="container">
      <div className="page-head">
        <p className="t-eyebrow t-eyebrow--accent">Order received</p>
        <h1 className="t-h1 page-head__title">Thank you — we have your order</h1>
        <p className="t-body-lg t-muted t-measure">
          Your reference is <strong>{order?.reference || reference}</strong>. Keep it for any
          correspondence about this job.
        </p>
      </div>

      <div className="section section--flush-top split">
        <div className="stack stack--lg">
          <dl className="detail-list">
            <div className="detail-list__row"><dt>Reference</dt><dd>{order?.reference || reference}</dd></div>
            {order?.total && <div className="detail-list__row"><dt>Order total</dt><dd>{formatAmount(order.total, order.currency)}</dd></div>}
            {order?.fulfilmentMethod && <div className="detail-list__row"><dt>Fulfilment</dt><dd>{order.fulfilmentMethod === 'delivery' ? 'Delivery' : 'Collection'}</dd></div>}
            <div className="detail-list__row"><dt>Payment</dt><dd>Not yet paid — we will confirm arrangements with you.</dd></div>
          </dl>

          <div className="prose">
            <h2 className="t-h3">What happens next</h2>
            <p>
              We will review the order and contact you to confirm specifications, the final
              amount including any delivery, and the production schedule.
            </p>
            {order?.items?.some(item => item.designServiceRequired) && (
              <p>You have asked us to prepare artwork. We will share a proof for your approval before production.</p>
            )}
          </div>

          {order?.items?.filter(item => item.artworkStatus === 'awaiting_upload').map(item => (
            <section className="stack rule" style={{ paddingBlockStart: 'var(--space-5)' }} key={item.id}>
              <div>
                <p className="t-eyebrow">Artwork for</p>
                <h2 className="t-h3">{item.title}</h2>
              </div>
              {user
                ? <ArtworkUploader orderItemId={item.id} />
                : <p className="t-body-sm t-muted">You chose to provide artwork later. Sign in after account access is enabled, or contact Motion with order reference <strong>{order.reference}</strong>, to send the files privately.</p>}
            </section>
          ))}

          <div className="cluster">
            <Button to="/shop" variant="secondary">Continue shopping</Button>
            <Button to="/contact" variant="text" arrow>Contact us about this order</Button>
          </div>
        </div>

        {order?.items?.length > 0 && (
          <div className="summary">
            <p className="t-eyebrow">Items</p>
            {order.items.map((item, index) => (
              <div className="summary__row" key={index}>
                <span>{item.title} × {item.quantity}</span>
                <span>{formatAmount(item.lineTotal, order.currency)}</span>
              </div>
            ))}
            <div className="summary__row summary__row--total">
              <span>Total</span>
              <span>{formatAmount(order.total, order.currency)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
