import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/Form'
import { Badge } from '../../components/ui/Cards'
import { formatAmount } from '../../components/ui/Price'
import { Async, EmptyState, ErrorState, LoadingState } from '../../components/ui/States'
import { Breadcrumbs } from '../../components/ui/Navigation'
import { useToast } from '../../components/ToastProvider'
import { useResource } from '../../hooks/useResource'
import { accountService } from '../../services/accountService'
import { useAuth } from '../../auth/AuthProvider'
import { OrderTimeline, ACTION_LABELS } from '../../features/account/OrderTimeline'

/* Customer portal (Prompts 9.1–9.4).

   Deliberately not a dashboard. No customer score, no engagement level, no
   loyalty index, no charts — those are the things Prompt 9.1 explicitly bans, and
   none of them would help someone waiting on a signage job. What a customer needs
   is: what is happening, what do I have to do, and what did I order last time. */

const ACTIVE_STATUSES = new Set([
  'new', 'awaiting_payment', 'artwork_required', 'artwork_received',
  'design_in_progress', 'awaiting_customer_approval', 'approved', 'in_production', 'ready',
])

export function AccountNav() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const links = [
    { to: '/account', label: 'Overview', end: true },
    { to: '/account/orders', label: 'Orders' },
    { to: '/account/quotes', label: 'Quotes' },
    { to: '/account/profile', label: 'Profile' },
  ]
  return (
    <nav className="account-nav" aria-label="Account">
      {links.map(link => (
        <NavLink key={link.to} to={link.to} end={link.end} className="account-nav__link">{link.label}</NavLink>
      ))}
      <button
        type="button"
        className="account-nav__link"
        style={{ marginInlineStart: 'auto', background: 'none' }}
        onClick={async () => { await signOut(); navigate('/') }}
      >
        Sign out
      </button>
    </nav>
  )
}

function OrderRow({ order }) {
  const action = order.action ? ACTION_LABELS[order.action] : null
  return (
    <li className="order-row">
      <Link to={`/account/orders/${order.id}`} className="order-row__link">
        <div className="stack stack--sm">
          <span className="t-meta">{order.reference || order.order_number}</span>
          <span className="t-h4">{order.statusLabel || order.status_code}</span>
        </div>
        <div className="cluster">
          {action && <Badge tone={action.tone}>{action.label}</Badge>}
          <span className="t-price">{formatAmount(order.total ?? order.total_amount, order.currency)}</span>
        </div>
      </Link>
    </li>
  )
}

/* ── Overview ─────────────────────────────────────────────────────────────── */

export function AccountOverviewPage() {
  const orders = useResource(({ signal }) => accountService.orders({ signal }), [])
  const quotes = useResource(({ signal }) => accountService.quotes({ signal }), [])

  const active = (orders.data || []).filter(order => ACTIVE_STATUSES.has(order.status_code))
  const recent = (orders.data || []).slice(0, 5)
  // A quote counts as needing attention only when the customer can actually act.
  const awaiting = (quotes.data || []).filter(row => row.quote_status === 'sent' && !row.customer_accepted_at)

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ label: 'Account' }]} />
        <h1 className="t-h1 page-head__title">Your account</h1>
      </div>
      <AccountNav />

      <div className="section stack stack--lg">
        {(awaiting.length > 0 || active.some(order => order.action)) && (
          <section className="stack" aria-labelledby="needs-you">
            <h2 className="t-h3" id="needs-you">Needs your attention</h2>
            <ul className="stack stack--sm">
              {awaiting.map(row => (
                <li key={row.request_id} className="attention-row">
                  <span>Quote {row.quote_number} is ready for your decision</span>
                  <Button to={`/account/quotes/${row.quote_id}`} variant="text" size="sm" arrow>Review</Button>
                </li>
              ))}
              {active.filter(order => order.action).map(order => (
                <li key={order.id} className="attention-row">
                  <span>{ACTION_LABELS[order.action]?.label || 'Action needed'} — order {order.order_number}</span>
                  <Button to={`/account/orders/${order.id}`} variant="text" size="sm" arrow>Open</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="stack" aria-labelledby="active-orders">
          <div className="section-head">
            <div className="section-head__text"><h2 className="t-h3" id="active-orders">Active orders</h2></div>
            <Button to="/account/orders" variant="text" arrow>All orders</Button>
          </div>
          <Async
            state={orders}
            empty={<EmptyState title="No orders yet" description="Your orders will appear here once you place one." action={<Button to="/shop" variant="secondary" size="sm">Browse products</Button>} />}
            errorTitle="Your orders could not be loaded"
          >
            {() => (active.length
              ? <ul className="stack stack--sm">{active.map(order => <OrderRow key={order.id} order={order} />)}</ul>
              : <p className="t-body-sm t-muted">Nothing in production at the moment.</p>)}
          </Async>
        </section>

        {recent.length > 0 && (
          <section className="stack" aria-labelledby="recent">
            <h2 className="t-h3" id="recent">Recent</h2>
            <ul className="stack stack--sm">{recent.map(order => <OrderRow key={order.id} order={order} />)}</ul>
          </section>
        )}
      </div>
    </div>
  )
}

/* ── Orders list ──────────────────────────────────────────────────────────── */

export function AccountOrdersPage() {
  const orders = useResource(({ signal }) => accountService.orders({ signal }), [])
  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/account', label: 'Account' }, { label: 'Orders' }]} />
        <h1 className="t-h1 page-head__title">Your orders</h1>
      </div>
      <AccountNav />
      <div className="section">
        <Async
          state={orders}
          empty={<EmptyState title="No orders yet" action={<Button to="/shop" variant="secondary" size="sm">Browse products</Button>} />}
          errorTitle="Your orders could not be loaded"
        >
          {(rows) => <ul className="stack stack--sm">{rows.map(order => <OrderRow key={order.id} order={order} />)}</ul>}
        </Async>
      </div>
    </div>
  )
}

/* ── Order detail, timeline and proof review ──────────────────────────────── */

export function AccountOrderDetailPage() {
  const { id } = useParams()
  const notify = useToast()
  const [busy, setBusy] = useState(null)
  const [comment, setComment] = useState('')
  const [showChanges, setShowChanges] = useState(false)
  const state = useResource(({ signal }) => accountService.order(id, { signal }), [id])
  const order = state.data

  const respond = async (action) => {
    setBusy(action)
    try {
      await accountService.respondToProof(order.activeProof.id, { action, comment: action === 'request_changes' ? comment : undefined })
      notify(action === 'approve' ? 'Proof approved — we will start production.' : 'Your changes have been sent to the studio.', 'success')
      setShowChanges(false); setComment(''); state.reload()
    } catch (error) {
      notify(error.message || 'That could not be completed.', 'error')
    } finally { setBusy(null) }
  }

  if (state.loading) return <div className="container section"><LoadingState label="Loading order" /></div>
  if (state.error) return <div className="container section"><ErrorState title="This order could not be opened" description={state.error.message} onRetry={state.reload} /></div>
  if (!order) return null

  const action = order.action ? ACTION_LABELS[order.action] : null

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/account', label: 'Account' }, { to: '/account/orders', label: 'Orders' }, { label: order.reference }]} />
        <h1 className="t-h1 page-head__title">Order {order.reference}</h1>
        <div className="cluster">
          <Badge tone={action?.tone}>{order.statusLabel}</Badge>
          {order.paymentStatus === 'paid' && <Badge tone="success">Paid</Badge>}
        </div>
        {order.statusDescription && <p className="t-body t-muted t-measure">{order.statusDescription}</p>}
      </div>

      <div className="section split">
        <div className="stack stack--lg">
          {/* The proof decision is the most consequential thing on this page, so
              it sits above the timeline rather than below the order detail. */}
          {order.activeProof && (
            <section className="proof-panel stack" aria-labelledby="proof">
              <p className="t-eyebrow t-eyebrow--accent">Proof v{order.activeProof.version} — your approval needed</p>
              <h2 className="t-h3" id="proof">Review before we print</h2>
              {order.activeProof.notes && <p className="t-body-sm">{order.activeProof.notes}</p>}
              <p className="t-caption">
                Approving confirms this exact version for production. We record which version
                you approved and when.
              </p>
              {showChanges ? (
                <div className="stack">
                  <Field as="textarea" label="What needs changing?" value={comment} onChange={(event) => setComment(event.target.value)} required />
                  <div className="cluster">
                    <Button variant="primary" disabled={busy !== null || comment.trim().length < 2} onClick={() => respond('request_changes')}>
                      {busy === 'request_changes' ? 'Sending…' : 'Send changes'}
                    </Button>
                    <Button variant="text" onClick={() => setShowChanges(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="cluster">
                  <Button variant="primary" disabled={busy !== null} onClick={() => respond('approve')}>
                    {busy === 'approve' ? 'Approving…' : 'Approve for production'}
                  </Button>
                  <Button variant="secondary" onClick={() => setShowChanges(true)}>Request changes</Button>
                </div>
              )}
            </section>
          )}

          <section className="stack" aria-labelledby="progress">
            <h2 className="t-h3" id="progress">Progress</h2>
            <OrderTimeline stages={order.timeline} />
          </section>

          {order.proofs.filter(proof => proof.respondedAt).length > 0 && (
            <section className="stack" aria-labelledby="proof-history">
              <h2 className="t-h3" id="proof-history">Proof history</h2>
              <ul className="stack stack--sm">
                {order.proofs.filter(proof => proof.respondedAt).map(proof => (
                  <li key={proof.id} className="cluster cluster--between">
                    <span className="t-body-sm">Version {proof.version}</span>
                    <Badge tone={proof.status === 'approved' ? 'success' : proof.superseded ? undefined : 'warning'}>
                      {proof.status === 'approved' ? 'Approved' : proof.status === 'changes_requested' ? 'Changes requested' : 'Superseded'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="stack split__sticky">
          <div className="summary">
            <p className="t-eyebrow">Items</p>
            {order.items.map(item => (
              <div key={item.id} className="stack stack--sm" style={{ paddingBlock: 'var(--space-2)' }}>
                <div className="summary__row">
                  <span>{item.title} × {item.quantity}</span>
                  <span>{formatAmount(item.lineTotal, order.currency)}</span>
                </div>
                {Object.keys(item.configuration).length > 0 && (
                  <p className="t-meta">{Object.entries(item.configuration).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
                )}
                {item.artworkStatus === 'awaiting_upload' && <Badge tone="warning">Artwork needed</Badge>}
              </div>
            ))}
            <div className="summary__row summary__row--total">
              <span>Total</span><span>{formatAmount(order.total, order.currency)}</span>
            </div>
            <p className="t-caption">
              {order.fulfilmentMethod === 'delivery' ? 'For delivery' : 'For collection'}
            </p>
          </div>
          <Button to={`/account/orders/${order.id}/reorder`} variant="secondary" block>Order this again</Button>
        </div>
      </div>
    </div>
  )
}

/* ── Reorder ──────────────────────────────────────────────────────────────── */

export function AccountReorderPage() {
  const { id } = useParams()
  const state = useResource(({ signal }) => accountService.reorder(id, { signal }), [id])

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/account', label: 'Account' }, { to: '/account/orders', label: 'Orders' }, { label: 'Order again' }]} />
        <h1 className="t-h1 page-head__title">Order this again</h1>
        <p className="t-body t-muted t-measure">
          Prices are today's, not what you paid before. Check each item before adding it.
        </p>
      </div>

      <div className="section">
        <Async state={state} errorTitle="This could not be prepared" empty={<EmptyState title="Nothing to reorder" />}>
          {(data) => (
            <ul className="stack">
              {data.items.map(item => (
                <li key={item.orderItemId} className="reorder-row">
                  <div className="stack stack--sm">
                    <span className="t-h4">{item.title}</span>
                    <span className="t-meta">Quantity {item.quantity}</span>
                    {item.message && <span className="t-caption">{item.message}</span>}
                  </div>
                  <div className="cluster">
                    {item.eligible ? (
                      <>
                        <span className="t-price">{formatAmount(item.currentPrice, item.currency)}</span>
                        <Button to={`/product/${item.slug}`} variant="secondary" size="sm">Configure and add</Button>
                      </>
                    ) : item.reason === 'custom_project' || item.reason === 'quote_required' ? (
                      <Button to="/custom-project" variant="secondary" size="sm">Request similar</Button>
                    ) : (
                      <Badge tone="warning">Not available</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Async>
      </div>
    </div>
  )
}

/* ── Profile ──────────────────────────────────────────────────────────────── */

/* Profile — onboarding and editing, which are two different jobs.
 *
 * A newly authenticated customer has an Auth identity but no Motion profile
 * row, and the route guard sends them here to create one. `GET /me` answers 403
 * `profile_required` for exactly that person. Treating it as a fetch failure —
 * which is what this page used to do — showed a dead error with a Retry button
 * that could only produce the same 403 again. That blocked every new customer.
 *
 * A missing profile is an expected onboarding state, not an error. The two are
 * now distinguished, and the form posts or patches accordingly.
 */
export function AccountProfilePage() {
  const notify = useToast()
  const { user, refreshProfile } = useAuth()
  const state = useResource(({ signal }) => accountService.profile({ signal }), [])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  /* 403 profile_required is the server saying "authenticated, but no profile
     yet". 404 is treated the same way for robustness. Anything else is a real
     failure and keeps the error state. */
  const missingProfile = state.error?.status === 403 || state.error?.status === 404
  const loadFailed = Boolean(state.error) && !missingProfile
  const creating = missingProfile && !state.data

  const blank = {
    /* Prefilled from the Auth identity when it carries a name — a Google
       sign-in usually does, an email sign-up carries whatever was typed. It is a
       convenience only: the field stays editable and nothing depends on it. */
    fullName: user?.name || '',
    phone: '',
    companyName: '',
  }

  const current = form || (state.data
    ? { fullName: state.data.full_name || '', phone: state.data.phone || '', companyName: state.data.company_name || '' }
    : (creating ? blank : null))

  const set = (name) => (event) => setForm({ ...current, [name]: event.target.value })

  const save = async (event) => {
    event.preventDefault()
    setSaving(true); setErrors({})
    try {
      /* The only difference between the two paths. Neither body carries a role,
         an auth id or an email — the server fixes the role to 'customer' on
         insert and never reads one from the request. */
      if (creating) {
        await accountService.createProfile(current)
        notify('Your profile is set up. Welcome to Motion.', 'success')
        /* Refresh the session's profile before reloading this page's copy, so
           the customer routes and the account nav become available immediately
           rather than after a manual reload. */
        await refreshProfile()
      } else {
        await accountService.updateProfile(current)
        notify('Your details have been saved.', 'success')
      }
      state.reload()
    } catch (error) {
      if (error.details) setErrors(Object.fromEntries(Object.entries(error.details).map(([key, value]) => [key, value[0]])))
      notify(error.message || (creating ? 'Your profile could not be created.' : 'Your details could not be saved.'), 'error')
    } finally { setSaving(false) }
  }

  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/account', label: 'Account' }, { label: 'Profile' }]} />
        <h1 className="t-h1 page-head__title">{creating ? 'Complete your profile' : 'Your details'}</h1>
        {creating && (
          <p className="t-body-lg t-muted t-measure">
            One step before your account is ready. We use this on quotes, orders and delivery.
          </p>
        )}
      </div>
      {/* The account nav links to orders and quotes, which a customer without a
          profile cannot reach yet. Hidden until there is one. */}
      {!creating && <AccountNav />}

      <div className="section container--narrow" style={{ paddingInline: 0 }}>
        {state.loading && <LoadingState label="Loading your details" />}
        {loadFailed && <ErrorState title="Your details could not be loaded" description={state.error.message} onRetry={state.reload} />}
        {current && (
          <form className="stack stack--lg" onSubmit={save} noValidate>
            <Field label="Full name" value={current.fullName} onChange={set('fullName')} error={errors.fullName} required autoComplete="name" />
            <Field label="Phone number" type="tel" value={current.phone} onChange={set('phone')} error={errors.phone} optional autoComplete="tel" />
            <Field label="Company or organisation" value={current.companyName} onChange={set('companyName')} error={errors.companyName} optional autoComplete="organization" />
            {/* Role, identifiers and account status are deliberately absent: they
                are not the customer's to change (Prompt 9.1). The server would
                ignore them anyway — the schema strips unknown keys and the role
                is a literal in the handler. */}
            <p className="t-caption">
              To change the email address you sign in with, or to close your account, contact us.
            </p>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving
                ? (creating ? 'Setting up…' : 'Saving…')
                : (creating ? 'Save and continue' : 'Save details')}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
