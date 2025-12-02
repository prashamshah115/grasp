/**
 * Error Display Component
 * 
 * User-friendly error display with recovery options
 */

import { AlertCircle, X, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { logger } from '@/lib/logger'

interface ErrorDisplayProps {
  error: Error | string
  onRetry?: () => void
  onDismiss?: () => void
  title?: string
  className?: string
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  title = 'Something went wrong',
  className = '',
}: ErrorDisplayProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  const errorMessage = error instanceof Error ? error.message : error
  const isRetryable = onRetry !== undefined

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  const handleRetry = () => {
    logger.info('User retrying after error', {
      errorMessage,
      hasRetryHandler: !!onRetry,
    })
    onRetry?.()
  }

  // Determine error type for better messaging
  const getErrorMessage = (msg: string): string => {
    const lowerMsg = msg.toLowerCase()
    
    if (lowerMsg.includes('rate limit') || lowerMsg.includes('429')) {
      return 'Too many requests. Please wait a moment and try again.'
    }
    
    if (lowerMsg.includes('network') || lowerMsg.includes('fetch')) {
      return 'Network error. Please check your connection and try again.'
    }
    
    if (lowerMsg.includes('timeout')) {
      return 'Request timed out. Please try again.'
    }
    
    if (lowerMsg.includes('api key') || lowerMsg.includes('401') || lowerMsg.includes('unauthorized')) {
      return 'Authentication error. Please refresh the page and try again.'
    }
    
    if (lowerMsg.includes('openai') || lowerMsg.includes('llm') || lowerMsg.includes('ai service')) {
      return 'AI service is temporarily unavailable. Please try again in a moment.'
    }
    
    if (lowerMsg.includes('edge function') || lowerMsg.includes('non-2xx')) {
      return 'Service error. Please try again, or contact support if this persists.'
    }
    
    // Default: show original message but make it more user-friendly
    return msg.length > 100 ? `${msg.substring(0, 100)}...` : msg
  }

  return (
    <div
      className={`bg-red-50 border border-red-200 rounded-[12px] p-4 ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <AlertCircle className="w-5 h-5 text-red-600" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-red-800 mb-1">{title}</h3>
          <p className="text-sm text-red-700">{getErrorMessage(errorMessage)}</p>
          
          {isRetryable && (
            <button
              onClick={handleRetry}
              className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-800 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          )}
        </div>
        
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

