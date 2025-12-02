/**
 * Centralized Error Handler
 * Maps technical errors to user-friendly messages
 */

import { NovaloError, isNovaloError, NetworkError, AuthError, ValidationError, SupabaseError } from './errors'

export interface UserFriendlyError {
  title: string
  message: string
  recoverable: boolean
  action?: string
}

/**
 * Classify and format errors for user display
 */
export function classifyError(error: unknown): UserFriendlyError {
  // Handle our custom errors
  if (isNovaloError(error)) {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return {
          title: 'Connection Problem',
          message: 'Unable to connect to the server. Please check your internet connection and try again.',
          recoverable: true,
          action: 'Retry',
        }
      
      case 'AUTH_ERROR':
        return {
          title: 'Authentication Required',
          message: 'Please sign in to continue.',
          recoverable: false,
          action: 'Sign In',
        }
      
      case 'VALIDATION_ERROR':
        return {
          title: 'Invalid Input',
          message: error.message || 'Please check your input and try again.',
          recoverable: true,
          action: 'Try Again',
        }
      
      case 'SUPABASE_ERROR':
        // Check for specific Supabase error codes
        const context = error.context?.originalError
        if (context?.code === '23505') {
          // Unique constraint violation
          return {
            title: 'Already Exists',
            message: 'This item already exists. No action needed.',
            recoverable: false,
          }
        }
        if (context?.code === 'PGRST116') {
          // Not found
          return {
            title: 'Not Found',
            message: 'The requested item could not be found.',
            recoverable: false,
          }
        }
        return {
          title: 'Database Error',
          message: 'Something went wrong with the database. Please try again.',
          recoverable: true,
          action: 'Retry',
        }
      
      case 'RAG_ERROR':
        return {
          title: 'AI Service Error',
          message: 'Unable to process your question. Please try again.',
          recoverable: true,
          action: 'Retry',
        }
      
      case 'SESSION_ERROR':
        return {
          title: 'Session Error',
          message: error.message || 'Your session encountered an error.',
          recoverable: true,
          action: 'Retry',
        }
      
      default:
        return {
          title: 'Error',
          message: error.message || 'An unexpected error occurred.',
          recoverable: error.recoverable,
          action: error.recoverable ? 'Try Again' : undefined,
        }
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return {
        title: 'Connection Problem',
        message: 'Unable to connect to the server. Please check your internet connection.',
        recoverable: true,
        action: 'Retry',
      }
    }

    // Timeout errors
    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return {
        title: 'Request Timeout',
        message: 'The request took too long. Please try again.',
        recoverable: true,
        action: 'Retry',
      }
    }

    return {
      title: 'Error',
      message: error.message,
      recoverable: true,
      action: 'Try Again',
    }
  }

  // Unknown error
  return {
    title: 'Unexpected Error',
    message: 'Something went wrong. Please try again or contact support if the problem persists.',
    recoverable: true,
    action: 'Retry',
  }
}

/**
 * Log error for debugging and production monitoring
 * Sends to console in all environments, can extend to error tracking service
 */
export async function logError(error: unknown, context?: string): Promise<void> {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    context,
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  }

  // Always log to console for debugging
  console.error(`[ErrorHandler] ${context || 'Unhandled error'}:`, errorInfo)

  // In production, send to error tracking (if configured)
  // For now, errors are logged to console and can be monitored via browser console
  // Future: Integrate with Sentry or Supabase Logs for centralized error tracking
  if (import.meta.env.PROD) {
    // Structured error logging for production monitoring
    // Errors can be collected via browser console monitoring tools
    // or integrated with error tracking service
    try {
      // Optional: Send to error tracking service
      // await sendToErrorTracking(errorInfo)
    } catch (trackingError) {
      // Don't fail if error tracking fails
      console.warn('Failed to send error to tracking service:', trackingError)
    }
  }
}




