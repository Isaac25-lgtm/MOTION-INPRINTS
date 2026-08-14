import { Button } from '../components/ui/Button'

/* Routes whose own build phase has not run yet. Says so plainly rather than
   showing a mocked-up interface. */
export function PlaceholderPage({ title }) {
  return (
    <section className="container" aria-labelledby="page-title">
      <div className="page-head" style={{ paddingBlock: 'var(--space-8)' }}>
        <p className="t-eyebrow">Motion</p>
        <h1 className="t-h1 page-head__title" id="page-title">{title}</h1>
        <p className="t-body-lg t-muted t-measure">
          This area is prepared and routed, and will be built in its own phase.
        </p>
        <div className="cluster">
          <Button to="/" variant="secondary">Return home</Button>
          <Button to="/custom-project" variant="text" arrow>Start a custom project</Button>
        </div>
      </div>
    </section>
  )
}
