import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Form'
import { Badge } from '../components/ui/Cards'
import { formatAmount } from '../components/ui/Price'
import { LoadingState, ErrorState } from '../components/ui/States'
import { Wordmark } from '../layouts/Wordmark'
import { useToast } from '../components/ToastProvider'
import { useResource } from '../hooks/useResource'
import { quoteResponseService } from '../services/orderService'

/* Customer quote view (Prompt 6.3).

   Set as a business document rather than a dashboard: Motion's lockup, a
   reference, the items, the total, validity and terms. Reachable by a guest
   holding the tokenised link. */

const statusTone = { accepted: 'success', declined: 'error', changes_requested: 'warning', sent: 'accent' }
const statusLabel = {
  sent: 'Awaiting your decision',
  accepted: 'Accepted',
  declined: 'Declined',
  changes_requested: 'Changes requested',
  expired: 'Expired',
  prepared: 'Being prepared',
}

export function QuoteViewPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const notify = useToast()
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const [showChanges, setShowChanges] = useState(false)

  const state = useResource(
    ({ signal }) => quoteResponseService.getPublic(id, token, { signal }),
    [id, token],
    { enabled: Boolean(token) },
  )
  const quote = state.data

  const respond = async (action) => {
    setBusy(action)
    try {
      await quoteResponseService.respond(id, { action, message: action === 'request_changes' ? message : undefined, token }, token)
      notify(action === 'accept' ? 'Quote accepted. We will be in touch to start the job.'
        : action === 'decline' ? 'Quote declined.' : 'Your requested changes have been sent.', 'success')
      setShowChanges(false)
      setMessage('')
      state.reload()
    } catch (error) {
      // Expiry and supersession are reported precisely, so the customer knows
      // whether to ask for a fresh quote or simply reload.
      notify(error.message || 'That could not be completed.', 'error')
    } finally {
      setBusy(null)
    }
  }

  if (!token) {
    return (
      <div className="container section">
        <ErrorState title="This quote link is incomplete" description="Open the quote using the full link we sent you." />
      </div>
    )
  }
  if (state.loading) return <div className="container section"><LoadingState label="Loading quote" /></div>
  if (state.error) return <div className="container section"><ErrorState title="This quote could not be opened" description={state.error.message} onRetry={state.reload} /></div>
  if (!quote) return null

  const open = quote.status === 'sent' || quote.status === 'changes_requested'
  const actionable = open && !quote.expired && !quote.superseded && !quote.acceptedAt

  return (
    <div className="container container--narrow">
      <article className="quote-document">
        <header className="quote-document__head">
          <Wordmark variant="lockup" />
          <div className="stack stack--sm" style={{ justifyItems: 'end', textAlign: 'end' }}>
            <p className="t-eyebrow">Quotation</p>
            <p className="t-h3">{quote.reference}</p>
            {quote.version > 1 && <p className="t-meta">Version {quote.version}</p>}
          </div>
        </header>

        <div className="cluster" style={{ paddingBlock: 'var(--space-4)' }}>
          <Badge tone={statusTone[quote.status]}>{statusLabel[quote.status] || quote.status}</Badge>
          {quote.expired && <Badge tone="error">Expired</Badge>}
          {quote.superseded && <Badge tone="warning">Superseded</Badge>}
        </div>

        <table className="quote-table">
          <thead>
            <tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Unit</th><th scope="col">Amount</th></tr>
          </thead>
          <tbody>
            {quote.items.map(item => (
              <tr key={item.id}>
                <td>
                  {item.title}
                  {Object.keys(item.configuration || {}).length > 0 && (
                    <span className="t-meta" style={{ display: 'block' }}>
                      {Object.entries(item.configuration).map(([key, value]) => `${key}: ${value}`).join(' · ')}
                    </span>
                  )}
                </td>
                <td>{item.quantity}</td>
                <td>{formatAmount(item.unitPrice, quote.currency)}</td>
                <td>{formatAmount(item.lineTotal, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={3}>Subtotal</th><td>{formatAmount(quote.subtotal, quote.currency)}</td></tr>
            {/* Tax appears only when a rate was actually configured on the quote. */}
            {quote.taxRateBp ? (
              <tr><th scope="row" colSpan={3}>Tax ({(quote.taxRateBp / 100).toFixed(0)}%)</th><td>{formatAmount(quote.taxAmount, quote.currency)}</td></tr>
            ) : null}
            <tr className="quote-table__total"><th scope="row" colSpan={3}>Total</th><td>{formatAmount(quote.total, quote.currency)}</td></tr>
          </tfoot>
        </table>

        <dl className="detail-list">
          {quote.validUntil && <div className="detail-list__row"><dt>Valid until</dt><dd>{quote.validUntil}</dd></div>}
          {quote.productionAssumptions && <div className="detail-list__row"><dt>Production assumptions</dt><dd>{quote.productionAssumptions}</dd></div>}
          {quote.paymentTerms && <div className="detail-list__row"><dt>Payment terms</dt><dd>{quote.paymentTerms}</dd></div>}
          {quote.notes && <div className="detail-list__row"><dt>Notes</dt><dd>{quote.notes}</dd></div>}
        </dl>

        {quote.acceptedAt && (
          <p className="t-body-sm" style={{ color: 'var(--state-success)' }}>
            Accepted on {new Date(quote.acceptedAt).toLocaleDateString()} at {formatAmount(quote.acceptedTotal, quote.currency)}.
          </p>
        )}

        {quote.changeRequests?.length > 0 && (
          <section className="stack" style={{ paddingBlockStart: 'var(--space-5)' }}>
            <p className="t-eyebrow">Your change requests</p>
            {quote.changeRequests.map((entry, index) => (
              <blockquote key={index} className="t-body-sm t-muted">{entry.message}</blockquote>
            ))}
          </section>
        )}

        {actionable && (
          <footer className="quote-document__actions">
            {showChanges ? (
              <div className="stack">
                <Field as="textarea" label="What would you like changed?" value={message} onChange={(event) => setMessage(event.target.value)} required />
                <div className="cluster">
                  <Button variant="primary" disabled={busy !== null || message.trim().length < 2} onClick={() => respond('request_changes')}>
                    {busy === 'request_changes' ? 'Sending…' : 'Send request'}
                  </Button>
                  <Button variant="text" onClick={() => setShowChanges(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="cluster">
                <Button variant="primary" disabled={busy !== null} onClick={() => respond('accept')}>
                  {busy === 'accept' ? 'Accepting…' : 'Accept quote'}
                </Button>
                <Button variant="secondary" onClick={() => setShowChanges(true)}>Request changes</Button>
                <Button variant="text" disabled={busy !== null} onClick={() => respond('decline')}>Decline</Button>
              </div>
            )}
          </footer>
        )}

        {!actionable && open && (
          <p className="t-body-sm t-muted">
            {quote.expired ? 'This quote has expired. Contact us and we will prepare a current one.'
              : quote.superseded ? 'A newer version of this quote has been issued.'
                : 'This quote is no longer open for a decision.'}
          </p>
        )}
      </article>
    </div>
  )
}
