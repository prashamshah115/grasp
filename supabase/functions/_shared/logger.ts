/**
 * Edge Function Logging Utilities
 * 
 * Provides structured logging for Supabase Edge Functions with:
 * - Request/response logging
 * - Performance timing
 * - Error context
 * - Database query logging
 */

interface LogContext {
  userId?: string
  courseId?: string
  topicId?: string
  functionName: string
  [key: string]: any
}

/**
 * Structured log entry for edge functions
 */
function createLogEntry(
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
  message: string,
  context: LogContext
): void {
  const entry = {
    level,
    message,
    ...context,
    timestamp: new Date().toISOString(),
  }

  // Use appropriate console method
  switch (level) {
    case 'ERROR':
      console.error(JSON.stringify(entry))
      break
    case 'WARN':
      console.warn(JSON.stringify(entry))
      break
    case 'DEBUG':
      // Only log debug in development (check via env var)
      if (Deno.env.get('ENVIRONMENT') === 'development') {
        console.log(JSON.stringify(entry))
      }
      break
    default:
      console.log(JSON.stringify(entry))
  }
}

/**
 * Log function entry point
 */
export function logFunctionStart(functionName: string, context: Partial<LogContext> = {}) {
  createLogEntry('INFO', `[${functionName}] Function started`, {
    functionName,
    ...context,
  })
}

/**
 * Log function completion
 */
export function logFunctionEnd(
  functionName: string,
  duration: number,
  context: Partial<LogContext> = {}
) {
  createLogEntry('INFO', `[${functionName}] Function completed`, {
    functionName,
    duration: `${duration.toFixed(2)}ms`,
    ...context,
  })
}

/**
 * Log database query
 */
export function logQuery(
  functionName: string,
  queryName: string,
  result: { count?: number; error?: any },
  context: Partial<LogContext> = {}
) {
  if (result.error) {
    createLogEntry('ERROR', `[${functionName}] Query failed: ${queryName}`, {
      functionName,
      queryName,
      error: result.error.message || result.error,
      errorCode: result.error.code,
      ...context,
    })
  } else {
    createLogEntry('DEBUG', `[${functionName}] Query succeeded: ${queryName}`, {
      functionName,
      queryName,
      resultCount: result.count ?? 'N/A',
      ...context,
    })
  }
}

/**
 * Log external API call
 */
export function logApiCall(
  functionName: string,
  apiName: string,
  success: boolean,
  duration?: number,
  error?: any,
  context: Partial<LogContext> = {}
) {
  const level = success ? 'INFO' : 'ERROR'
  const message = success
    ? `[${functionName}] API call succeeded: ${apiName}`
    : `[${functionName}] API call failed: ${apiName}`

  createLogEntry(level, message, {
    functionName,
    apiName,
    success,
    duration: duration ? `${duration.toFixed(2)}ms` : undefined,
    error: error?.message || error,
    ...context,
  })
}

/**
 * Log error with full context
 */
export function logError(
  functionName: string,
  error: unknown,
  context: Partial<LogContext> = {}
) {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined
  const errorName = error instanceof Error ? error.name : typeof error

  createLogEntry('ERROR', `[${functionName}] Error occurred`, {
    functionName,
    errorMessage,
    errorStack,
    errorName,
    ...context,
  })
}

/**
 * Log validation error
 */
export function logValidationError(
  functionName: string,
  field: string,
  value: any,
  reason: string,
  context: Partial<LogContext> = {}
) {
  createLogEntry('WARN', `[${functionName}] Validation failed: ${field}`, {
    functionName,
    field,
    value: typeof value === 'string' ? value.substring(0, 100) : value,
    reason,
    ...context,
  })
}

/**
 * Get high-resolution timestamp (works in both Deno and browser)
 */
function getTimestamp(): number {
  // Deno doesn't have performance.now(), use Date.now() instead
  // For edge functions, millisecond precision is sufficient
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now()
  }
  return Date.now()
}

/**
 * Performance timer helper
 */
export class PerformanceTimer {
  private startTime: number
  private functionName: string
  private context: Partial<LogContext>

  constructor(functionName: string, context: Partial<LogContext> = {}) {
    this.functionName = functionName
    this.context = context
    this.startTime = getTimestamp()
    logFunctionStart(functionName, context)
  }

  /**
   * Log a checkpoint with elapsed time
   */
  checkpoint(checkpointName: string, additionalContext: Partial<LogContext> = {}) {
    const elapsed = getTimestamp() - this.startTime
    createLogEntry('DEBUG', `[${this.functionName}] Checkpoint: ${checkpointName}`, {
      functionName: this.functionName,
      checkpointName,
      elapsed: `${elapsed.toFixed(2)}ms`,
      ...this.context,
      ...additionalContext,
    })
  }

  /**
   * End timer and log completion
   */
  end(additionalContext: Partial<LogContext> = {}) {
    const duration = getTimestamp() - this.startTime
    logFunctionEnd(this.functionName, duration, { ...this.context, ...additionalContext })
    return duration
  }
}

/**
 * Create a performance timer
 */
export function createTimer(functionName: string, context: Partial<LogContext> = {}) {
  return new PerformanceTimer(functionName, context)
}

