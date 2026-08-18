import { useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Form'
import { Badge } from '../../components/ui/Cards'
import { formatAmount } from '../../components/ui/Price'
import { Async, EmptyState, ErrorState, LoadingState } from '../../components/ui/States'
import { FilterBar } from '../../components/ui/Navigation'
import { useToast } from '../../components/ToastProvider'
import { useResource } from '../../hooks/useResource'
import { adminService } from '../../services/adminService'

/* Admin (Category 10).

   An operations screen, not a dashboard poster. Counts are real database counts;
   where Motion has no activity they show zero rather than a seeded figure. There
   are no KPI tiles, gauges, growth arrows or "business score" — every number here
   corresponds to a queue somebody has to work through. */

export function AdminNav() {
  const links = [
    { to: '/manager/dashboard', label: 'Dashboard', end: true },
    { to: '/manager/orders', label: 'Orders' },
    { to: '/manager/quotes', label: 'Quotes' },
    { to: '/manager/products', label: 'Products' },
    { to: '/manager/categories', label: 'Categories' },
    { to: '/manager/customers', label: 'Customers' },
    { to: '/manager/projects', label: 'Work' },
    { to: '/manager/content', label: 'Content' },
    { to: '/manager/reports', label: 'Reports' },
  ]
  return (
    <nav className="admin-nav" aria-label="Administration">
      {links.map(link => <NavLink key={link.to} to={link.to} end={link.end} className="admin-nav__link">{link.label}</NavLink>)}
    </nav>
  )
}

function AdminShell({ title, description, actions, children }) {
  return (
    <div className="container container--wide">
      <div className="page-head">
        <h1 className="t-h2 page-head__title">{title}</h1>
        {description && <p className="t-body-sm t-muted t-measure">{description}</p>}
        {actions && <div className="cluster">{actions}</div>}
      </div>
      <AdminNav />
      <div className="section section--tight">{children}</div>
    </div>
  )
}

/* ── Dashboard (10.1) ─────────────────────────────────────────────────────── */

const QUEUE_LABELS = {
  new: 'New orders',
  awaitingPayment: 'Awaiting payment',
  artworkRequired: 'Artwork missing',
  awaitingApproval: 'Awaiting customer approval',
  inProduction: 'In production',
  ready: 'Ready',
  newQuoteRequests: 'New quote requests',
  quotesAwaitingCustomer: 'Quotes with customers',
}

export function AdminDashboardPage() {
  const state = useResource(({ signal }) => adminService.dashboard({ signal }), [])

  return (
    <AdminShell title="Today at Motion" description="Every figure here is a queue of real records, not a metric.">
      <Async state={state} errorTitle="The dashboard could not be loaded">
        {(data) => (
          <div className="stack stack--lg">
            {/* Counts as a plain bordered index. A count of zero is meaningful and
                is shown, not hidden behind a decorative tile. */}
            <dl className="queue-grid">
              {Object.entries(QUEUE_LABELS).map(([key, label]) => (
                <div className="queue-grid__item" key={key}>
                  <dt className="t-caption">{label}</dt>
                  <dd className="t-h2">{data.counts[key] ?? 0}</dd>
                </div>
              ))}
            </dl>

            <section className="stack" aria-labelledby="attention">
              <h2 className="t-h3" id="attention">Needs attention</h2>
              {data.needsAttention.length === 0 ? (
                <p className="t-body-sm t-muted">Nothing is waiting on Motion right now.</p>
              ) : (
                <ul className="stack stack--sm">
                  {data.needsAttention.map(row => (
                    <li key={row.id} className="attention-row">
                      <div className="stack stack--sm">
                        <Link to={`/manager/orders/${row.id}`} className="t-h4">{row.reference}</Link>
                        <span className="t-meta">{row.customer} · {row.reason}</span>
                      </div>
                      <span className="t-price">{formatAmount(row.total, row.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="stack" aria-labelledby="activity">
              <h2 className="t-h3" id="activity">Recent orders</h2>
              {data.recentActivity.length === 0
                ? <p className="t-body-sm t-muted">No orders yet.</p>
                : (
                  <ul className="stack stack--sm">
                    {data.recentActivity.map(row => (
                      <li key={row.id} className="attention-row">
                        <Link to={`/manager/orders/${row.id}`}>{row.reference}</Link>
                        <span className="t-meta">{row.who} · {row.detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
            </section>
          </div>
        )}
      </Async>
    </AdminShell>
  )
}

/* ── Orders and production (10.3) ─────────────────────────────────────────── */

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'awaiting_payment', label: 'Awaiting payment' },
  { value: 'artwork_required', label: 'Artwork' },
  { value: 'design_in_progress', label: 'Design' },
  { value: 'awaiting_customer_approval', label: 'Approval' },
  { value: 'in_production', label: 'Production' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
]

export function AdminOrdersPage() {
  const [status, setStatus] = useState(null)
  const [term, setTerm] = useState('')
  const state = useResource(({ signal }) => adminService.orders({ status, q: term || undefined, limit: 50 }, { signal }), [status, term])

  return (
    <AdminShell title="Orders" description="Production queue and order history.">
      <div className="stack stack--lg">
        <div className="stack">
          <Field label="Search" hint="Reference, customer name or phone." value={term} onChange={(event) => setTerm(event.target.value)} />
          <FilterBar options={STATUS_FILTERS} value={status} onChange={setStatus} label="Filter by status" />
        </div>
        <Async
          state={state}
          errorTitle="Orders could not be loaded"
          empty={<EmptyState title="No orders match" description="Try a different status or search term." />}
        >
          {(rows) => (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th scope="col">Reference</th><th scope="col">Customer</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col">Placed</th></tr>
                </thead>
                <tbody>
                  {rows.map(order => (
                    <tr key={order.id}>
                      <td><Link to={`/manager/orders/${order.id}`}>{order.order_number}</Link></td>
                      <td>{order.contact_name}</td>
                      <td><Badge>{order.status_code.replace(/_/g, ' ')}</Badge></td>
                      <td>{formatAmount(order.total_amount, order.currency)}</td>
                      <td className="t-meta">{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </div>
    </AdminShell>
  )
}

export function AdminOrderDetailPage() {
  const { id } = useParams()
  const notify = useToast()
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState(null)
  const [proofNotes, setProofNotes] = useState('')
  const state = useResource(({ signal }) => adminService.order(id, { signal }), [id])
  const order = state.data

  const move = async (statusCode) => {
    setBusy(true)
    try {
      await adminService.setOrderStatus(id, { statusCode })
      notify(`Order moved to ${statusCode.replace(/_/g, ' ')}.`, 'success')
      state.reload()
    } catch (error) {
      // The server rejects illegal transitions and production-without-approval,
      // so the message here is the real reason, not a guess.
      notify(error.message || 'That change was not allowed.', 'error')
    } finally { setBusy(false) }
  }

  const sendProof = async () => {
    setBusy(true)
    try {
      await adminService.uploadProof(id, { notes: proofNotes || undefined })
      notify('Proof sent to the customer for approval.', 'success')
      setProofNotes(''); state.reload()
    } catch (error) { notify(error.message || 'The proof could not be sent.', 'error') } finally { setBusy(false) }
  }

  const saveNotes = async () => {
    setBusy(true)
    try { await adminService.setInternalNotes(id, notes ?? ''); notify('Internal notes saved.', 'success'); state.reload() }
    catch (error) { notify(error.message || 'Notes could not be saved.', 'error') } finally { setBusy(false) }
  }

  if (state.loading) return <AdminShell title="Order"><LoadingState label="Loading order" /></AdminShell>
  if (state.error) return <AdminShell title="Order"><ErrorState title="This order could not be loaded" onRetry={state.reload} /></AdminShell>
  if (!order) return null

  // Only transitions the workflow permits are offered; the server validates again.
  const nextStates = {
    new: ['awaiting_payment', 'artwork_required', 'design_in_progress', 'cancelled'],
    awaiting_payment: ['artwork_required', 'design_in_progress', 'cancelled'],
    artwork_required: ['artwork_received', 'cancelled'],
    artwork_received: ['design_in_progress', 'in_production', 'cancelled'],
    design_in_progress: ['awaiting_customer_approval', 'in_production', 'cancelled'],
    awaiting_customer_approval: ['design_in_progress', 'cancelled'],
    approved: ['in_production', 'cancelled'],
    in_production: ['ready', 'cancelled'],
    ready: ['dispatched', 'completed'],
    dispatched: ['completed'],
  }[order.status] || []

  return (
    <AdminShell title={`Order ${order.reference}`} description={`${order.contactName} · ${order.statusLabel}`}>
      <div className="split">
        <div className="stack stack--lg">
          <section className="stack" aria-labelledby="move">
            <h2 className="t-h3" id="move">Move this job on</h2>
            {nextStates.length === 0
              ? <p className="t-body-sm t-muted">This order is in a final state.</p>
              : (
                <div className="cluster">
                  {nextStates.map(next => (
                    <Button key={next} variant={next === 'cancelled' ? 'text' : 'secondary'} size="sm" disabled={busy} onClick={() => move(next)}>
                      {next.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </div>
              )}
            {order.requiresProofApproval && !order.approvedProofId && (
              <p className="t-caption">This job needs an approved proof before it can enter production.</p>
            )}
          </section>

          <section className="stack" aria-labelledby="proofs">
            <h2 className="t-h3" id="proofs">Proofs</h2>
            {order.proofs.length > 0 && (
              <ul className="stack stack--sm">
                {order.proofs.map(proof => (
                  <li key={proof.id} className="attention-row">
                    <span>Version {proof.version}</span>
                    <div className="cluster">
                      <Badge tone={proof.status === 'approved' ? 'success' : proof.status === 'changes_requested' ? 'warning' : undefined}>
                        {proof.status.replace(/_/g, ' ')}
                      </Badge>
                      {proof.comment && <span className="t-meta">“{proof.comment}”</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Field as="textarea" label="Notes for the customer" value={proofNotes} onChange={(event) => setProofNotes(event.target.value)} optional />
            <Button variant="primary" size="sm" disabled={busy} onClick={sendProof}>Send proof for approval</Button>
          </section>

          <section className="stack" aria-labelledby="internal">
            <h2 className="t-h3" id="internal">Internal notes</h2>
            <p className="t-caption">Never shown to the customer.</p>
            <Field as="textarea" label="Notes" value={notes ?? order.internalNotes ?? ''} onChange={(event) => setNotes(event.target.value)} />
            <Button variant="secondary" size="sm" disabled={busy} onClick={saveNotes}>Save notes</Button>
          </section>

          {order.audit?.length > 0 && (
            <section className="stack" aria-labelledby="audit">
              <h2 className="t-h3" id="audit">History</h2>
              <ul className="stack stack--sm">
                {order.audit.map((entry, index) => (
                  <li key={index} className="t-body-sm">
                    <span className="t-meta">{new Date(entry.created_at).toLocaleString()} — </span>
                    {entry.summary || entry.action}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="stack split__sticky">
          <div className="summary">
            <p className="t-eyebrow">Order</p>
            {order.items.map(item => (
              <div key={item.id} className="stack stack--sm" style={{ paddingBlock: 'var(--space-2)' }}>
                <div className="summary__row"><span>{item.title} × {item.quantity}</span><span>{formatAmount(item.lineTotal, order.currency)}</span></div>
                {Object.keys(item.configuration).length > 0 && (
                  <p className="t-meta">{Object.entries(item.configuration).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>
                )}
              </div>
            ))}
            <div className="summary__row summary__row--total"><span>Total</span><span>{formatAmount(order.total, order.currency)}</span></div>
            <div className="summary__row"><span>Payment</span><span>{order.paymentStatus}</span></div>
            {/* No "mark as paid" control. Payment state comes from verified
                settlement only (Prompt 10.3). */}
            <p className="t-caption">Payment status follows verified settlement and cannot be set by hand here.</p>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}

/* ── Reports (10.6) ───────────────────────────────────────────────────────── */

const RANGES = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
]

export function AdminReportsPage() {
  const [range, setRange] = useState('this_month')
  const state = useResource(({ signal }) => adminService.reports({ range }, { signal }), [range])

  return (
    <AdminShell title="Reports" description="Computed in the database. Revenue counts settled payments only.">
      <div className="stack stack--lg">
        <FilterBar options={RANGES} value={range} onChange={setRange} label="Date range" />
        <Async state={state} errorTitle="Reports could not be loaded">
          {(data) => (
            <div className="stack stack--lg">
              <dl className="queue-grid">
                <div className="queue-grid__item"><dt className="t-caption">Revenue (settled)</dt><dd className="t-h2">{formatAmount(data.summary.revenue, data.currency)}</dd></div>
                <div className="queue-grid__item"><dt className="t-caption">Orders</dt><dd className="t-h2">{data.summary.orders}</dd></div>
                <div className="queue-grid__item">
                  <dt className="t-caption">Average order</dt>
                  {/* Null, not zero: an average of no orders is not zero. */}
                  <dd className="t-h2">{data.summary.averageOrderValue ? formatAmount(data.summary.averageOrderValue, data.currency) : '—'}</dd>
                </div>
                <div className="queue-grid__item"><dt className="t-caption">Outstanding</dt><dd className="t-h2">{formatAmount(data.summary.outstanding, data.currency)}</dd></div>
                <div className="queue-grid__item">
                  <dt className="t-caption">Quote conversion</dt>
                  <dd className="t-h2">{data.summary.quoteConversion === null ? '—' : `${data.summary.quoteConversion}%`}</dd>
                </div>
                <div className="queue-grid__item">
                  <dt className="t-caption">Average production</dt>
                  <dd className="t-h2">{data.summary.averageProductionHours === null ? '—' : `${data.summary.averageProductionHours}h`}</dd>
                </div>
              </dl>

              {data.topProducts.length > 0 && (
                <section className="stack" aria-labelledby="top">
                  <h2 className="t-h3" id="top">Top products</h2>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead><tr><th scope="col">Product</th><th scope="col">Units</th><th scope="col">Revenue</th></tr></thead>
                      <tbody>
                        {data.topProducts.map(row => (
                          <tr key={row.title}><td>{row.title}</td><td>{row.units}</td><td>{formatAmount(row.revenue, data.currency)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {data.topProducts.length === 0 && (
                <EmptyState title="No sales in this period" description="Figures appear here once orders are placed and paid. Nothing is estimated." />
              )}

              <details className="stack">
                <summary className="t-body-sm">How these are calculated</summary>
                <dl className="detail-list">
                  {Object.entries(data.definitions).map(([key, definition]) => (
                    <div className="detail-list__row" key={key}><dt>{key}</dt><dd className="t-body-sm">{definition}</dd></div>
                  ))}
                </dl>
              </details>
            </div>
          )}
        </Async>
      </div>
    </AdminShell>
  )
}

/* ── Customers (10.4) ─────────────────────────────────────────────────────── */

export function AdminCustomersPage() {
  const [term, setTerm] = useState('')
  const state = useResource(({ signal }) => adminService.customers({ q: term || undefined, limit: 50 }, { signal }), [term])

  return (
    <AdminShell title="Customers" description="Business records only. Authentication data is never shown here.">
      <div className="stack stack--lg">
        <Field label="Search" hint="Name, phone or company." value={term} onChange={(event) => setTerm(event.target.value)} />
        <Async state={state} errorTitle="Customers could not be loaded" empty={<EmptyState title="No customers yet" />}>
          {(rows) => (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Phone</th><th scope="col">Orders</th><th scope="col">Lifetime</th></tr></thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.id}>
                      <td><Link to={`/manager/customers/${row.id}`}>{row.full_name}</Link></td>
                      <td>{row.company_name || '—'}</td>
                      <td>{row.phone || '—'}</td>
                      <td>{row.order_count}</td>
                      <td>{formatAmount(row.lifetime_value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Async>
      </div>
    </AdminShell>
  )
}

export function AdminCustomerDetailPage() {
  const { id } = useParams()
  const state = useResource(({ signal }) => adminService.customer(id, { signal }), [id])

  if (state.loading) return <AdminShell title="Customer"><LoadingState label="Loading customer" /></AdminShell>
  if (state.error) return <AdminShell title="Customer"><ErrorState title="This customer could not be loaded" onRetry={state.reload} /></AdminShell>
  if (!state.data) return null

  const { profile, orders, quotes } = state.data

  return (
    <AdminShell title={profile.full_name} description={profile.company_name || 'Individual customer'}>
      <div className="stack stack--lg">
        <dl className="detail-list">
          <div className="detail-list__row"><dt>Phone</dt><dd>{profile.phone || '—'}</dd></div>
          <div className="detail-list__row"><dt>Company</dt><dd>{profile.company_name || '—'}</dd></div>
          <div className="detail-list__row"><dt>Customer since</dt><dd>{new Date(profile.created_at).toLocaleDateString()}</dd></div>
        </dl>
        {/* Authentication material is never selected by the API and so cannot
            appear here — no hashes, tokens or session data (Prompt 10.4). */}

        <section className="stack" aria-labelledby="customer-orders">
          <h2 className="t-h3" id="customer-orders">Orders</h2>
          {orders.length === 0 ? <p className="t-body-sm t-muted">No orders yet.</p> : (
            <ul className="stack stack--sm">
              {orders.map(order => (
                <li key={order.id} className="attention-row">
                  <Link to={`/manager/orders/${order.id}`}>{order.order_number}</Link>
                  <span className="t-meta">{order.status_code.replace(/_/g, ' ')} · {formatAmount(order.total_amount, order.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="stack" aria-labelledby="customer-quotes">
          <h2 className="t-h3" id="customer-quotes">Quote requests</h2>
          {quotes.length === 0 ? <p className="t-body-sm t-muted">No quote requests yet.</p> : (
            <ul className="stack stack--sm">
              {quotes.map(quote => (
                <li key={quote.id} className="attention-row">
                  <span>{quote.request_number}</span>
                  <span className="t-meta">{quote.project_type || 'General'} · {quote.status_code}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  )
}

/* Remaining admin sections reuse the same shell and services. Kept as focused
   list/detail screens rather than speculative tooling. */
export function AdminSectionPage({ title, description, load, columns, newPath, editPath }) {
  const state = useResource(({ signal }) => load({ signal }), [])
  return (
    <AdminShell
      title={title}
      description={description}
      actions={newPath ? <Button to={newPath} variant="primary" size="sm">Add {title.replace(/s$/, '').toLowerCase()}</Button> : null}
    >
      <Async
        state={state}
        errorTitle={`${title} could not be loaded`}
        empty={(
          <EmptyState
            title={`No ${title.toLowerCase()} yet`}
            description="Nothing has been created here. Nothing is hidden — the list is genuinely empty."
            action={newPath ? <Button to={newPath} variant="secondary" size="sm">Create the first one</Button> : null}
          />
        )}
      >
        {(rows) => (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}
                  {editPath && <th scope="col"><span className="visually-hidden">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    {columns.map((column, index) => (
                      <td key={column.key}>
                        {index === 0 && editPath
                          ? <Link to={editPath(row)}>{column.render ? column.render(row) : row[column.key]}</Link>
                          : (column.render ? column.render(row) : (row[column.key] ?? '—'))}
                      </td>
                    ))}
                    {editPath && <td><Link to={editPath(row)} className="t-body-sm">Edit</Link></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Async>
    </AdminShell>
  )
}
