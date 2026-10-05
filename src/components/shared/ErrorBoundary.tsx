import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
          <p className="max-w-md text-sm text-slate-500">
            {this.state.message || 'An unexpected error occurred. Please refresh the page.'}
          </p>
          <button
            className="btn-primary"
            onClick={() => {
              this.setState({ hasError: false, message: undefined })
              window.location.reload()
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
