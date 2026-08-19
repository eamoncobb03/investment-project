import { Component } from 'react'

/**
 * Without this, a throw anywhere in the tree unmounts the whole app and leaves
 * an empty page with nothing to explain it. React has no hook equivalent for
 * catching render errors, so this stays a class.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="mx-auto max-w-[34rem] px-6 py-[12vh]">
        <h1 className="mb-2 text-xl font-semibold">Something went wrong</h1>
        <p className="text-muted-foreground mb-5">
          The planner hit an unexpected error. Reloading usually clears it.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-mono text-sm"
          >
            Reload
          </button>
          <a href="https://eamoncobb.com/" className="text-primary text-sm">
            Back to eamoncobb.com
          </a>
        </div>
      </div>
    )
  }
}
