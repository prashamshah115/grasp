/**
 * Centralized Logging Service
 * 
 * Provides structured logging with context, levels, and error tracking.
 * Designed for production-grade observability.
 * 
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info('User action', { userId, action: 'click' })
 *   logger.error('API call failed', { error, functionName: 'rag-chat' })
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

interface LogContext {
  userId?: string
  courseId?: string
  topicId?: string
  functionName?: string
  component?: string
  [key: string]: any
}

interface LogEntry {
  level: LogLevel
  message: string
  context: LogContext
  timestamp: string
  userAgent?: string
  url?: string
}

class Logger {
  private isDevelopment = import.meta.env.DEV
  private errorBuffer: LogEntry[] = []
  private readonly MAX_BUFFER_SIZE = 50

  /**
   * Log a message with context
   */
  private log(level: LogLevel, message: string, context: LogContext = {}) {
    const entry: LogEntry = {
      level,
      message,
      context: {
        ...context,
        // Add browser context in browser environment
        ...(typeof window !== 'undefined' && {
          url: window.location.href,
          userAgent: navigator.userAgent,
        }),
      },
      timestamp: new Date().toISOString(),
    }

    // Always log to console in development
    if (this.isDevelopment) {
      const consoleMethod = level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'
      const prefix = `[${level}]`
      console[consoleMethod](prefix, message, context)
    }

    // Buffer errors for potential backend reporting
    if (level === 'ERROR') {
      this.errorBuffer.push(entry)
      if (this.errorBuffer.length > this.MAX_BUFFER_SIZE) {
        this.errorBuffer.shift()
      }

      // In production, send critical errors to backend
      if (!this.isDevelopment) {
        this.reportError(entry).catch(err => {
          console.error('Failed to report error to backend:', err)
        })
      }
    }

    // Log to browser console in production (for debugging)
    if (!this.isDevelopment && level === 'ERROR') {
      console.error(`[${level}] ${message}`, context)
    }
  }

  /**
   * Report error to backend logging service
   */
  private async reportError(entry: LogEntry) {
    try {
      // Only report in production, and throttle to avoid spam
      if (this.isDevelopment) return

      // Use fetch directly to avoid circular dependencies
      const response = await fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })

      if (!response.ok) {
        console.warn('Failed to report error to backend:', response.status)
      }
    } catch (error) {
      // Silently fail - don't break the app if logging fails
      console.warn('Error reporting failed:', error)
    }
  }

  /**
   * Debug-level logging (only in development)
   */
  debug(message: string, context: LogContext = {}) {
    if (this.isDevelopment) {
      this.log('DEBUG', message, context)
    }
  }

  /**
   * Info-level logging
   */
  info(message: string, context: LogContext = {}) {
    this.log('INFO', message, context)
  }

  /**
   * Warning-level logging
   */
  warn(message: string, context: LogContext = {}) {
    this.log('WARN', message, context)
  }

  /**
   * Error-level logging with full context
   */
  error(message: string, error: Error | unknown, context: LogContext = {}) {
    const errorContext: LogContext = {
      ...context,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      errorName: error instanceof Error ? error.name : typeof error,
    }

    // Add error details if it's a structured error
    if (error && typeof error === 'object') {
      const err = error as any
      if (err.status) errorContext.status = err.status
      if (err.statusCode) errorContext.statusCode = err.statusCode
      if (err.code) errorContext.code = err.code
      if (err.context) errorContext.errorContext = err.context
    }

    this.log('ERROR', message, errorContext)
  }

  /**
   * Log API call with timing
   */
  async logApiCall<T>(
    functionName: string,
    apiCall: () => Promise<T>,
    context: LogContext = {}
  ): Promise<T> {
    const startTime = performance.now()
    this.info(`API call started: ${functionName}`, { ...context, functionName })

    try {
      const result = await apiCall()
      const duration = performance.now() - startTime
      this.info(`API call succeeded: ${functionName}`, {
        ...context,
        functionName,
        duration: `${duration.toFixed(2)}ms`,
      })
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      this.error(`API call failed: ${functionName}`, error, {
        ...context,
        functionName,
        duration: `${duration.toFixed(2)}ms`,
      })
      throw error
    }
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(): LogEntry[] {
    return [...this.errorBuffer]
  }

  /**
   * Clear error buffer
   */
  clearErrorBuffer() {
    this.errorBuffer = []
  }
}

// Export singleton instance
export const logger = new Logger()

// Export types for use in other files
export type { LogLevel, LogContext, LogEntry }
