import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Custom fallback; defaults to a full error panel. */
  fallback?: ReactNode
  /** Label shown in the default fallback, e.g. a section name. */
  label?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'app', error, info.componentStack)
  }

  private reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback

    return (
      <div className="mx-auto my-12 flex max-w-lg flex-col items-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <div>
          <p className="font-semibold">
            {this.props.label ? `Failed to render ${this.props.label}` : 'Something went wrong'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{this.state.error.message}</p>
        </div>
        <Button variant="outline" size="sm" onClick={this.reset}>
          <RotateCcw /> Try again
        </Button>
      </div>
    )
  }
}
