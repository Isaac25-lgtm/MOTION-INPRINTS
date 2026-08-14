import { Link } from 'react-router-dom'
import { Badge } from '../components/ui/Cards'
import { Button } from '../components/ui/Button'
import { formatAmount } from '../components/ui/Price'
import { Async, EmptyState, SkeletonGrid } from '../components/ui/States'
import { Breadcrumbs } from '../components/ui/Navigation'
import { useResource } from '../hooks/useResource'
import { quoteService } from '../services/quoteService'

const labels = {
  submitted: 'Submitted', under_review: 'Under review', prepared: 'Prepared', sent: 'Sent',
  accepted: 'Accepted', changes_requested: 'Changes requested', declined: 'Declined', expired: 'Expired',
}

export function AccountQuotesPage() {
  const state = useResource(({ signal }) => quoteService.listMine({ signal }), [])
  return (
    <div className="container">
      <div className="page-head">
        <Breadcrumbs trail={[{ to: '/account', label: 'Account' }, { label: 'Quotes' }]} />
        <h1 className="t-h1 page-head__title">Your quotes</h1>
        <p className="t-body-lg t-muted t-measure">Project requests and the latest quotation issued for each one.</p>
      </div>
      <div className="section section--flush-top">
        <Async
          state={state}
          skeleton={<SkeletonGrid count={3} />}
          empty={<EmptyState title="No quote requests yet" description="When you submit a custom project, it will appear here." action={<Button to="/custom-project" size="sm">Start a project</Button>} />}
        >
          {(items) => (
            <ol className="account-list">
              {items.map(item => (
                <li className="account-list__item" key={item.request_id}>
                  <div className="stack stack--sm">
                    <p className="t-eyebrow">{item.request_number}</p>
                    <h2 className="t-h4">{item.project_type ? item.project_type.replace(/_/g, ' ') : 'Custom project'}</h2>
                    <p className="t-body-sm t-muted">{item.project_brief}</p>
                    <Badge>{labels[item.quote_status || item.request_status] || item.quote_status || item.request_status}</Badge>
                  </div>
                  <div className="stack stack--sm" style={{ justifyItems: 'end' }}>
                    {item.quote_id && item.total_amount !== null && <p className="t-price">{formatAmount(item.total_amount, item.currency)}</p>}
                    {item.quote_id
                      ? <Link className="btn btn--text" to={`/account/quotes/${item.quote_id}`}>View quote</Link>
                      : <p className="t-caption">A quotation has not been issued yet.</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Async>
      </div>
    </div>
  )
}
