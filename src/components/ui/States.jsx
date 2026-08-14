import { Button } from './Button'

/* Empty states say plainly that nothing exists yet. With no products or projects
   in the database, these are what most listings render — that is correct, and far
   better than inventing placeholder business data to fill the layout. */
export function EmptyState({ title, description, action, center }) {
  return (
    <div className={['state', center && 'state--center'].filter(Boolean).join(' ')}>
      <p className="t-h4" style={{ color: 'var(--text)' }}>{title}</p>
      {description && <p className="t-body-sm t-measure">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ title = 'This did not load', description, onRetry }) {
  return (
    <div className="state" role="alert">
      <p className="t-h4" style={{ color: 'var(--text)' }}>{title}</p>
      {description && <p className="t-body-sm t-measure">{description}</p>}
      {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  )
}

export function LoadingState({ label = 'Loading' }) {
  return <p role="status" className="t-body-sm t-muted">{label}…</p>
}

/* Skeletons mirror the grid they replace, so nothing jumps when data arrives. */
export function SkeletonGrid({ count = 4, className = 'grid grid--products', ratio = '1 / 1' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="stack stack--sm" key={index}>
          <div className="skeleton" style={{ aspectRatio: ratio }} />
          <div className="skeleton" style={{ height: '0.85rem', width: '65%' }} />
          <div className="skeleton" style={{ height: '0.85rem', width: '35%' }} />
        </div>
      ))}
    </div>
  )
}

/* One place that decides what a data-driven section renders. Keeping this in a
   single component is what stops loading/error/empty handling drifting page to page. */
export function Async({ state, empty, children, skeleton, errorTitle }) {
  // `skeleton={null}` means "render nothing while loading"; only an omitted prop
  // falls back to the text loading state.
  if (state.loading) return skeleton === undefined ? <LoadingState /> : skeleton
  if (state.error) return errorTitle === null ? null : <ErrorState title={errorTitle} description={state.error.message} onRetry={state.reload} />
  if (!state.data || (Array.isArray(state.data) && state.data.length === 0)) return empty ?? null
  return children(state.data)
}
