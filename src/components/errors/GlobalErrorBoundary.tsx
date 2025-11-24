/**
 * Global Error Boundary Component
 * Catches React errors and shows fallback UI
 * 
 * Usage: Wrap app in main.tsx
 * <GlobalErrorBoundary>
 *   <App />
 * </GlobalErrorBoundary>
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import { classifyError, logError } from '@/lib/errorHandler'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for debugging
    logError(error, 'GlobalErrorBoundary')
    
    this.setState({
      error,
      errorInfo,
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    
    // Reload page to reset app state
    window.location.reload()
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const userError = classifyError(this.state.error)

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-danger/10 p-4">
                <AlertCircle className="h-12 w-12 text-danger" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-text-primary">
                {userError.title}
              </h1>
              <p className="text-text-secondary">{userError.message}</p>
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/')}
              >
                <Home className="h-4 w-4 mr-2" />
                Go Home
              </Button>

              {userError.recoverable && (
                <Button variant="default" onClick={this.handleReset}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {userError.action || 'Try Again'}
                </Button>
              )}
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-sm text-text-tertiary hover:text-text-secondary">
                  Error Details (Dev Only)
                </summary>
                <pre className="mt-2 p-4 bg-background-subtle rounded-md text-xs overflow-auto">
                  <div className="mb-2 font-semibold">Error:</div>
                  <div>{this.state.error.toString()}</div>
                  {this.state.error.stack && (
                    <>
                      <div className="mt-4 mb-2 font-semibold">Stack:</div>
                      <div>{this.state.error.stack}</div>
                    </>
                  )}
                  {this.state.errorInfo && (
                    <>
                      <div className="mt-4 mb-2 font-semibold">Component Stack:</div>
                      <div>{this.state.errorInfo.componentStack}</div>
                    </>
                  )}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

