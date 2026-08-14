import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.error('Application error', error) }
  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="container" role="alert">
        <div className="page-head" style={{ paddingBlock: 'var(--space-9)' }}>
          <p className="t-eyebrow">Motion</p>
          <h1 className="t-h1 page-head__title">Something went wrong</h1>
          <p className="t-body-lg t-muted t-measure">
            The page could not be displayed. Reloading usually resolves it.
          </p>
          <div className="cluster">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>Reload the page</button>
            <a className="btn btn--secondary" href="/">Return home</a>
          </div>
        </div>
      </main>
    )
  }
}
