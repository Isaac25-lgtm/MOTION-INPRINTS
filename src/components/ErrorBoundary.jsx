import { Component } from 'react'
export class ErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.error('Application error', error) }
  render() { return this.state.hasError ? <main className="page-placeholder" role="alert"><h1>Something went wrong</h1><button onClick={() => window.location.reload()}>Reload</button></main> : this.props.children }
}
