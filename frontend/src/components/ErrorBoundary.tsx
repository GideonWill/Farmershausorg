import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { Icon } from './ui'

interface SafeBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface SafeBoundaryState {
  hasError: boolean
}

/**
 * Component-level error boundary to isolate non-critical widgets (like shopping assistant, badges, widgets)
 * so failures do not crash parent layouts.
 */
export class SafeBoundary extends Component<SafeBoundaryProps, SafeBoundaryState> {
  public override state: SafeBoundaryState = { hasError: false }

  public static getDerivedStateFromError(): SafeBoundaryState {
    return { hasError: true }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    } else {
      console.warn('SafeBoundary caught component error:', error.message, errorInfo)
    }
  }

  public override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

/**
 * Branded Root Error Boundary for React Router routes.
 * Handles Vite chunk loading errors / dynamic import failures gracefully
 * with automatic recovery and friendly action buttons.
 */
export function RootErrorBoundary() {
  const error = useRouteError()

  const isDynamicImportError =
    error instanceof Error &&
    (error.message.includes('dynamically imported module') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('Loading chunk') ||
      error.name === 'TypeError')

  const errorMessage = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected application error occurred'

  const handleReload = () => {
    // Clear any potential corrupted module cache and hard reload
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <div className="min-h-screen bg-[#faf8f3] text-brand-ink flex flex-col justify-between font-brand-body selection:bg-brand-green/20">
      <header className="border-b border-brand-green/10 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-brand-heading text-xl font-bold tracking-tight text-brand-green">
              Farmershaus
            </span>
          </Link>
          <button
            type="button"
            onClick={handleReload}
            className="rounded-full border border-brand-green/20 px-4 py-1.5 text-xs font-semibold text-brand-green transition hover:bg-brand-green hover:text-white"
          >
            Reload app
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-brand-green/10 text-brand-green">
          <Icon name="basket" />
        </div>

        <p className="font-brand-body text-xs font-bold uppercase tracking-widest text-brand-green/80">
          {isDynamicImportError ? 'Update in progress' : 'Freshness check'}
        </p>

        <h1 className="mt-2 font-brand-heading text-3xl font-bold text-brand-ink sm:text-4xl">
          {isDynamicImportError
            ? 'A fresh update is available'
            : 'Something took an unexpected turn'}
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-ink/75 sm:text-base">
          {isDynamicImportError
            ? 'We just updated the store with fresh improvements. Reloading will fetch the latest assets seamlessly.'
            : 'We encountered a momentary glitch while loading this section. Please reload or return to the homepage.'}
        </p>

        {import.meta.env.DEV && (
          <div className="mt-6 max-h-32 w-full overflow-auto rounded-xl border border-brand-green/15 bg-white p-3 text-left font-mono text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center gap-2 rounded-full bg-brand-green px-6 py-3 font-brand-body text-sm font-semibold text-white shadow-sm transition hover:bg-brand-green/90 active:scale-95"
          >
            <span>Reload page</span>
            <Icon name="arrow" />
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-white px-6 py-3 font-brand-body text-sm font-semibold text-brand-ink transition hover:border-brand-green/40 hover:bg-brand-cream/50 active:scale-95"
          >
            Return to store
          </Link>
        </div>
      </main>

      <footer className="border-t border-brand-green/10 bg-white/60 py-4 text-center text-xs text-brand-ink/60">
        Farmershaus Ghana &bull; Fresh Organic Harvest Delivered Straight to Your Doorstep
      </footer>
    </div>
  )
}
