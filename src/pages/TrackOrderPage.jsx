import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { Badge } from '../components/ui/Cards'
import { Breadcrumbs } from '../components/ui/Navigation'
import { ErrorState, LoadingState } from '../components/ui/States'
import { formatAmount } from '../components/ui/Price'
import { OrderTimeline } from '../features/account/OrderTimeline'
import { useToast } from '../components/ToastProvider'
import { useResource } from '../hooks/useResource'
import { trackingService } from '../services/guestOrderService'
import { useCart } from '../features/cart/CartProvider'

export function TrackOrderPage() {
  const [params, setParams] = useSearchParams()
  const reference = params.get('reference') || ''
  const token = params.get('token') || ''
  const notify = useToast()
  const { add } = useCart()

  const [form, setForm] = useState({ reference, token })
  const [busy, setBusy] = useState(null)
  const [comment, setComment] = useState('')
  const enabled = Boolean(reference && token)
  const state = useResource(({ signal }) => trackingService.track(reference, token, { signal }), [reference, token], { enabled })
  const reorder = useResource(
    ({ signal }) => trackingService.reorder(reference, token, { signal }),
    [reference, token],
    { enabled: enabled && Boolean(state.data) },
  )

  const submit = (event) => {
    event.preventDefault()
    setParams({ reference: form.reference.trim(), token: form.token.trim() })
  }

  const order = state.data

  const respond = async (action) => {
    if (!order?.activeProof) return
    setBusy(action)
    try {
      await trackingService.respondToProof(order.activeProof.id, {
        action,
        comment: action === 'request_changes' ? comment : undefined,
        token,
        reference,
      })
      notify(action === 'approve' ? 'Proof approved.' : 'Your requested changes have been sent.', 'success')
      setComment('')
      state.reload()
    } catch (error) {
      notify(error.message || 'That could not be completed.', 'error')
    } finally {
      setBusy(null)
    }
  }

  const addReorder = () => {
    const items = reorder.data?.items?.filter((item) => item.eligible) || []
    items.forEach((item) => add(
      { id: item.productId, slug: item.slug, name: item.title },
      item.selection || {},
      item.quantity,
    ))
    if (items.length) notify('Eligible items were added to your cart at today’s prices.', 'success')
  }

  return (
    <div className="container container--narrow">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Track an order' }]} />
        <h1 className="t-h1 page-head__title">Track your order</h1>
        <p className="t-body-lg t-muted t-measure">
          Enter the reference and tracking code from your order confirmation. Both are
          needed — the reference on its own will not open an order.
        </p>
      </div>

      <form className="section section--flush-top stack" onSubmit={submit} noValidate>
        <Field
          label="Order reference"
          value={form.reference}
          onChange={(event) => setForm({ ...form, reference: event.target.value })}
          hint="Looks like MOT-K7P2QX."
          autoComplete="off"
          required
        />
        <Field
          label="Tracking code"
          value={form.token}
          onChange={(event) => setForm({ ...form, token: event.target.value })}
          hint="The long code shown with your confirmation."
          autoComplete="off"
          required
        />
        <div className="cluster">
          <Button type="submit" variant="primary" disabled={!form.reference.trim() || !form.token.trim()}>
            Find my order
          </Button>
          <Button to="/contact" variant="text" arrow>Lost your code?</Button>
        </div>
      </form>

      <div className="section section--flush-top" aria-live="polite">
        {state.loading && <LoadingState label="Looking up your order" />}

        {state.error && (
          <ErrorState
            title="We could not find that order"
            description="Check the reference and tracking code, or contact us and we will look it up for you."
          />
        )}

        {order && (
          <article className="stack stack--lg">
            <header className="stack">
              <p className="t-eyebrow">Order {order.reference}</p>
              <h2 className="t-h2">{order.statusLabel}</h2>
              {order.statusDescription && <p className="t-body t-muted t-measure">{order.statusDescription}</p>}
              <div className="cluster">
                <Badge tone={order.status === 'ready' ? 'success' : 'accent'}>
                  {order.fulfilmentMethod === 'delivery' ? 'For delivery' : 'For collection'}
                </Badge>
                {order.paymentStatus === 'paid' && <Badge tone="success">Paid</Badge>}
                {order.total && <Badge>{formatAmount(order.total, order.currency)}</Badge>}
              </div>
            </header>

            {order.items?.length > 0 && (
              <section className="stack" aria-labelledby="tracked-items">
                <h3 className="t-h3" id="tracked-items">What is on this order</h3>
                <ul className="detail-list">
                  {order.items.map((item, index) => (
                    <li className="detail-list__row" key={item.id || index} style={{ gridTemplateColumns: '1fr auto' }}>
                      <span>{item.title}</span>
                      <span className="t-meta">× {item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="stack" aria-labelledby="tracked-progress">
              <h3 className="t-h3" id="tracked-progress">Progress</h3>
              <OrderTimeline stages={order.timeline} />
            </section>

            {order.activeProof && (
              <section className="proof-panel stack" aria-labelledby="tracked-proof">
                <p className="t-eyebrow">Proof v{order.activeProof.version}</p>
                <h3 className="t-h3" id="tracked-proof">A proof is waiting for your review</h3>
                {order.activeProof.notes && <p className="t-body-sm">{order.activeProof.notes}</p>}
                <Field as="textarea" label="If you need changes, tell us what to change" value={comment} onChange={(event) => setComment(event.target.value)} optional />
                <div className="cluster">
                  <Button type="button" variant="primary" disabled={busy} onClick={() => respond('approve')}>
                    {busy === 'approve' ? 'Approving…' : 'Approve this proof'}
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy || comment.trim().length < 2} onClick={() => respond('request_changes')}>
                    {busy === 'request_changes' ? 'Sending…' : 'Request changes'}
                  </Button>
                </div>
              </section>
            )}

            {reorder.data?.items?.some((item) => item.eligible) && (
              <section className="stack">
                <h3 className="t-h3">Order this again</h3>
                <p className="t-body-sm t-muted">Eligible items are re-priced at today’s rates before they go in the cart.</p>
                <Button type="button" variant="secondary" onClick={addReorder}>Add eligible items to cart</Button>
              </section>
            )}

            <p className="t-caption">
              Need to change something on this order? <Link className="link" to="/contact">Contact us</Link> with the reference above.
            </p>
          </article>
        )}
      </div>
    </div>
  )
}
