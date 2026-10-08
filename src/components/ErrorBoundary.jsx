import { Component } from 'react'

// If a page crashes while drawing, show a way out instead of a blank screen. The error is logged to the
// console for debugging; resets when you navigate to another page (resetKey = pathname).
export default class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Page crashed:', error, info?.componentStack) }
  componentDidUpdate(prev) { if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null }) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="container grid min-h-[60vh] place-items-center py-16 text-center">
        <div className="max-w-sm space-y-3">
          <p className="text-lg font-semibold">Something went wrong on this page.</p>
          <p className="text-sm text-muted-foreground">Your saved changes are safe. Reload to carry on.</p>
          {/* Short technical detail, so a screenshot is enough to find the cause. */}
          <p className="break-words font-mono text-[11px] text-muted-foreground/80">{String(this.state.error?.message || this.state.error).slice(0, 160)}</p>
          <button type="button" onClick={() => location.reload()} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">Reload</button>
        </div>
      </div>
    )
  }
}
