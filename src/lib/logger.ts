/**
 * Production-Grade Logging Utility
 * 
 * Provides structured logging with:
 * - Log levels (debug, info, warn, error)
 * - Contextual information (user, component, action)
 * - Error tracking with stack traces
 * - Performance monitoring
 * - Production-safe (filters sensitive data)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  component?: string
  action?: string
  metadata?: Record<string, any>
}

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
  duration?: number
}

class Logger {
  private isDevelopment = import.meta.env.DEV
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100

  /**
   * Sanitize sensitive data from logs
   */
  private sanitize(data: any): any {
    if (!data || typeof data !== 'object') return data

    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'cookie']
    const sanitized = Array.isArray(data) ? [...data] : { ...data }

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key])
      }
    }

    return sanitized
  }

  /**
   * Format log entry for console output
   */
  private formatLog(entry: LogEntry): string {
    const { level, message, timestamp, context, error, duration } = entry
    const parts = [`[${timestamp}]`, level.toUpperCase(), message]

    if (context?.component) parts.push(`[${context.component}]`)
    if (context?.action) parts.push(`(${context.action})`)
    if (duration !== undefined) parts.push(`[${duration}ms]`)
    if (error) parts.push(`\nError: ${error.name} - ${error.message}`)

    return parts.join(' ')
  }

  /**
   * Send logs to external service (e.g., Sentry, LogRocket) in production
   */
  private async sendToExternalService(entry: LogEntry): Promise<void> {
    if (this.isDevelopment) return

    try {
      // In production, send to logging service
      // Example: await fetch('/api/logs', { method: 'POST', body: JSON.stringify(entry) })
      
      // For now, just store in buffer
      this.logBuffer.push(entry)
      if (this.logBuffer.length > this.maxBufferSize) {
        this.logBuffer.shift()
      }
    } catch (err) {
      // Silently fail - don't break app if logging fails
      console.error('Failed to send log:', err)
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number
  ): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: context ? this.sanitize(context) : undefined,
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: this.isDevelopment ? error.stack : undefined,
          }
        : undefined,
      duration,
    }

    // Format and output to console
    const formatted = this.formatLog(entry)
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'
    console[consoleMethod](formatted)

    if (error && this.isDevelopment) {
      console.error('Stack trace:', error.stack)
    }

    // Send to external service in production
    this.sendToExternalService(entry)
  }

  /**
   * Debug logs (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      this.log('debug', message, context)
    }
  }

  /**
   * Info logs (general information)
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context)
  }

  /**
   * Warning logs (potential issues)
   */
  warn(message: string, context?: LogContext, error?: Error): void {
    this.log('warn', message, context, error)
  }

  /**
   * Error logs (actual errors)
   */
  error(message: string, context?: LogContext, error?: Error): void {
    this.log('error', message, context, error)
  }

  /**
   * Performance monitoring
   */
  performance(action: string, duration: number, context?: LogContext): void {
    const level = duration > 1000 ? 'warn' : 'info'
    this.log(level, `Performance: ${action} took ${duration}ms`, context, undefined, duration)
  }

  /**
   * Get recent logs (for debugging)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count)
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = []
  }
}

// Export singleton instance
export const logger = new Logger()

// Export convenience functions
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context)
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context)
export const logWarn = (message: string, context?: LogContext, error?: Error) =>
  logger.warn(message, context, error)
export const logError = (message: string, context?: LogContext, error?: Error) =>
  logger.error(message, context, error)
export const logPerformance = (action: string, duration: number, context?: LogContext) =>
  logger.performance(action, duration, context)

