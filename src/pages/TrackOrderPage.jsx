import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { Badge } from '../components/ui/Cards'
import { Breadcrumbs } from '../components/ui/Navigation'
import { ErrorState, LoadingState } from '../components/ui/States'
import { OrderTimeline } from '../features/account/OrderTimeline'
import { useResource } from '../hooks/useResource'
import { trackingService } from '../services/accountService'

/* Guest order tracking (Prompt 9.2).

   Two credentials are required: the reference identifies the order, the token
   authorises seeing it. A reference alone is never enough, and a wrong token
   returns the same "not found" as an unknown reference — so this page cannot be
   used to discover which references exist.

   The response is deliberately thin. Whoever holds the link sees progress, not
   the customer's address, contact details or order value. */

export function TrackOrderPage() {
  const [params, setParams] = useSearchParams()
  const reference = params.get('reference') || ''
  const token = params.get('token') || ''

  const [form, setForm] = useState({ reference, token })
  const enabled = Boolean(reference && token)
  const state = useResource(({ signal }) => trackingService.track(reference, token, { signal }), [reference, token], { enabled })

  const submit = (event) => {
    event.preventDefault()
    // Put the lookup in the URL so a found order can be bookmarked or re-shared.
    setParams({ reference: form.reference.trim(), token: form.token.trim() })
  }

  const order = state.data

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
              </div>
            </header>

            {order.items?.length > 0 && (
              <section className="stack" aria-labelledby="tracked-items">
                <h3 className="t-h3" id="tracked-items">What is on this order</h3>
                <ul className="detail-list">
                  {order.items.map((item, index) => (
                    <li className="detail-list__row" key={index} style={{ gridTemplateColumns: '1fr auto' }}>
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

            <p className="t-caption">
              Need to change something on this order? Contact us with the reference above.
            </p>
          </article>
        )}
      </div>
    </div>
  )
}
