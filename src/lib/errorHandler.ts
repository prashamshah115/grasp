/**
 * Centralized Error Handler
 * Maps technical errors to user-friendly messages
 */

import { GraspError, isGraspError, NetworkError, AuthError, ValidationError, SupabaseError } from './errors'

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
  if (isGraspError(error)) {
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
 * Log error for debugging (can extend to Supabase Logs/Sentry later)
 */
export function logError(error: unknown, context?: string): void {
  const timestamp = new Date().toISOString()
  const errorInfo = {
    timestamp,
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  }

  console.error(`[ErrorHandler] ${context || 'Unhandled error'}:`, errorInfo)

  // TODO: Send to Supabase Logs or Sentry in production
  // if (process.env.NODE_ENV === 'production') {
  //   await supabase.functions.invoke('log-error', { body: errorInfo })
  // }
}



