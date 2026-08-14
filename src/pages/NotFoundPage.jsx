import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <main className="container">
      <div className="page-head" style={{ paddingBlock: 'var(--space-9)' }}>
        <p className="t-eyebrow">Error 404</p>
        <h1 className="t-h1 page-head__title">This page does not exist</h1>
        <p className="t-body-lg t-muted t-measure">
          The address may have changed, or the page may have been removed.
        </p>
        <div className="cluster">
          <Button to="/" variant="primary">Return home</Button>
          <Button to="/work" variant="secondary">See our work</Button>
        </div>
      </div>
    </main>
  )
}
