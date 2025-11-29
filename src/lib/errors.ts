/**
 * Error Handling Utilities
 * Custom error classes and helpers for API/LLM failures
 */

export class NovaloError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = true,
    public context?: any
  ) {
    super(message)
    this.name = 'NovaloError'
  }
}

export class NetworkError extends NovaloError {
  constructor(message: string, context?: any) {
    super('NETWORK_ERROR', message, true, context)
    this.name = 'NetworkError'
  }
}

export class RAGError extends NovaloError {
  constructor(message: string, context?: any) {
    super('RAG_ERROR', `Failed to retrieve context: ${message}`, false, context)
    this.name = 'RAGError'
  }
}

export class SessionError extends NovaloError {
  constructor(message: string, context?: any) {
    super('SESSION_ERROR', message, true, context)
    this.name = 'SessionError'
  }
}

export class AuthError extends NovaloError {
  constructor(message: string = 'User not authenticated', context?: any) {
    super('AUTH_ERROR', message, false, context)
    this.name = 'AuthError'
  }
}

export class ValidationError extends NovaloError {
  constructor(message: string, context?: any) {
    super('VALIDATION_ERROR', message, true, context)
    this.name = 'ValidationError'
  }
}

export class SupabaseError extends NovaloError {
  constructor(message: string, context?: any) {
    super('SUPABASE_ERROR', message, true, context)
    this.name = 'SupabaseError'
  }
}

// Helper to handle Supabase errors
export function handleSupabaseError(error: any): never {
  if (error?.message) {
    throw new SupabaseError(error.message, { originalError: error })
  }
  throw new SupabaseError('Unknown Supabase error', { originalError: error })
}

// Retry helper with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw new NetworkError(`Failed after ${maxRetries} attempts`, {
    lastError: lastError?.message,
  })
}

// Type guard for NovaloError
export function isNovaloError(error: unknown): error is NovaloError {
  return error instanceof NovaloError
}

// Format error for display
export function formatError(error: unknown): string {
  if (isNovaloError(error)) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred'
}
