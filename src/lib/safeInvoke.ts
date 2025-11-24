/**
 * Safe API Invocation with Retry Logic
 * Wrapper for supabase.functions.invoke() with exponential backoff
 * 
 * Features:
 * - Exponential backoff with jitter (300ms, 600ms, 1200ms)
 * - Network error detection
 * - Maximum 3 retries per call
 * - Graceful failure with user notification
 */

import { supabase } from './supabase'
import { NetworkError } from './errors'
import { logError } from './errorHandler'

interface SafeInvokeOptions {
  maxRetries?: number
  baseDelay?: number
  onRetry?: (attempt: number, error: Error) => void
}

const DEFAULT_OPTIONS: Required<SafeInvokeOptions> = {
  maxRetries: 3,
  baseDelay: 300, // Start with 300ms
  onRetry: () => {},
}

/**
 * Check if error is retryable (network errors, 5xx, rate limits)
 */
function isRetryableError(error: any): boolean {
  // Network errors
  if (error?.message?.includes('fetch') || 
      error?.message?.includes('network') ||
      error?.message?.includes('Failed to fetch')) {
    return true
  }

  // HTTP errors
  if (error?.status) {
    // Retry on server errors (5xx) and rate limits (429)
    return error.status >= 500 || error.status === 429
  }

  // Supabase function errors
  if (error?.code === 'FUNCTION_INVOCATION_ERROR' || 
      error?.code === 'TIMEOUT') {
    return true
  }

  return false
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, baseDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt)
  // Add jitter (±20% random variation)
  const jitter = exponentialDelay * 0.2 * (Math.random() * 2 - 1)
  return Math.min(exponentialDelay + jitter, 10000) // Cap at 10 seconds
}

/**
 * Safe wrapper for supabase.functions.invoke() with retry logic
 */
export async function safeInvoke<T = any>(
  functionName: string,
  options: {
    body?: any
    headers?: Record<string, string>
  } = {},
  invokeOptions: SafeInvokeOptions = {}
): Promise<T> {
  const { maxRetries, baseDelay, onRetry } = { ...DEFAULT_OPTIONS, ...invokeOptions }
  
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke<T>(functionName, options)

      if (error) {
        // Check if error is retryable
        if (isRetryableError(error) && attempt < maxRetries - 1) {
          lastError = new Error(error.message || 'Function invocation failed')
          onRetry(attempt + 1, lastError)
          
          // Wait before retry
          const delay = calculateDelay(attempt, baseDelay)
          await new Promise(resolve => setTimeout(resolve, delay))
          
          continue
        }

        // Non-retryable error or last attempt
        throw error
      }

      if (!data) {
        throw new Error(`No data returned from ${functionName}`)
      }

      return data
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Log error
      logError(error, `safeInvoke(${functionName}, attempt ${attempt + 1})`)

      // Check if retryable and not last attempt
      if (isRetryableError(error) && attempt < maxRetries - 1) {
        onRetry(attempt + 1, lastError)
        
        // Wait before retry
        const delay = calculateDelay(attempt, baseDelay)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        continue
      }

      // Last attempt or non-retryable error
      throw new NetworkError(
        `Failed to invoke ${functionName} after ${attempt + 1} attempts`,
        {
          originalError: lastError.message,
          functionName,
          attempts: attempt + 1,
        }
      )
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new NetworkError(
    `Failed to invoke ${functionName} after ${maxRetries} attempts`,
    {
      originalError: lastError?.message,
      functionName,
      attempts: maxRetries,
    }
  )
}

