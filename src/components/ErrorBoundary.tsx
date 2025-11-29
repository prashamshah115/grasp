/**
 * ErrorBoundary Component
 * Catches React errors and route errors
 * Following React Router v7 errorElement pattern
 */

import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'
import { Button } from './ui/button'
import { isNovaloError, formatError } from '@/lib/errors'

export default function ErrorBoundary() {
  const error = useRouteError()

  // Handle different error types
  let errorMessage: string
  let errorCode: string | number = 'ERROR'
  let recoverable = true

  if (isRouteErrorResponse(error)) {
    // React Router error (404, etc.)
    errorCode = error.status
    errorMessage = error.statusText || error.data?.message || 'Page not found'
  } else if (isNovaloError(error)) {
    // Our custom error
    errorCode = error.code
    errorMessage = error.message
    recoverable = error.recoverable
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else {
    errorMessage = 'An unexpected error occurred'
  }

  console.error('ErrorBoundary caught:', error)

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
            {errorCode === 404 ? 'Page Not Found' : 'Something Went Wrong'}
          </h1>
          <p className="text-text-secondary">{errorMessage}</p>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/'}
          >
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>

          {recoverable && (
            <Button
              variant="default"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>

        {process.env.NODE_ENV === 'development' && error instanceof Error && (
          <details className="mt-8 text-left">
            <summary className="cursor-pointer text-sm text-text-tertiary hover:text-text-secondary">
              Error Details (Dev Only)
            </summary>
            <pre className="mt-2 p-4 bg-background-subtle rounded-md text-xs overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
