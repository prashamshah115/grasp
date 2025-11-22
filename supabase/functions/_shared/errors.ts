/**
 * Centralized Error Handling for Supabase Edge Functions
 * Based on best practices from Supabase docs 2025
 *
 * Usage:
 *   import { handleError, AppError } from '../_shared/errors.ts'
 *
 *   serve(async (req) => {
 *     try {
 *       // ... your logic
 *     } catch (error) {
 *       return handleError(error, 'function-name')
 *     }
 *   })
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ==================== ERROR TYPES ====================

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'AuthenticationError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 422, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

// ==================== ERROR HANDLER ====================

interface ErrorResponse {
  error: string
  code?: string
  details?: any
  timestamp: string
}

/**
 * Centralized error handler that returns proper HTTP responses
 * with CORS headers included
 */
export function handleError(
  error: unknown,
  functionName: string
): Response {
  const timestamp = new Date().toISOString()

  // Log error for debugging
  console.error(`[${functionName}] Error at ${timestamp}:`, error)

  let statusCode = 500
  let errorMessage = 'Internal server error'
  let errorCode = 'INTERNAL_ERROR'
  let details: any = undefined

  if (error instanceof AppError) {
    statusCode = error.statusCode
    errorMessage = error.message
    errorCode = error.code || 'APP_ERROR'
  } else if (error instanceof Error) {
    errorMessage = error.message
    // Don't expose internal error details in production
    if (Deno.env.get('ENVIRONMENT') === 'development') {
      details = { stack: error.stack }
    }
  }

  const response: ErrorResponse = {
    error: errorMessage,
    code: errorCode,
    timestamp,
  }

  if (details) {
    response.details = details
  }

  return new Response(JSON.stringify(response), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
  })
}

// ==================== CORS HANDLER ====================

/**
 * Handle CORS preflight requests
 */
export function handleCORS(): Response {
  return new Response('ok', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    },
  })
}

// ==================== SUCCESS RESPONSE ====================

/**
 * Create a success response with CORS headers
 */
export function successResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers':
        'authorization, x-client-info, apikey, content-type',
    },
  })
}

// ==================== AUTH HELPERS ====================

/**
 * Extract and validate user from request
 * Creates Supabase client with proper Authorization header for Supabase v2
 * Returns authenticated client and user for use in edge functions
 * 
 * CORRECT PATTERN for Supabase v2 Edge Functions:
 * - Create client with SERVICE_ROLE_KEY
 * - Set Authorization header in global.headers
 * - Call getUser() without token (client uses header automatically)
 * 
 * Throws AuthenticationError if invalid
 */
export async function requireAuth(
  req: Request
): Promise<{ supabase: any; user: any }> {
  const authHeader = req.headers.get('Authorization')

  if (!authHeader) {
    throw new AuthenticationError('Missing Authorization header')
  }

  // Create Supabase client with Authorization header in global config
  // This is the CORRECT pattern for Supabase v2 Edge Functions
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || Deno.env.get('PUBLIC_SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  )

  // Call getUser() without token - client automatically uses Authorization header
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new AuthenticationError('Invalid or expired token')
  }

  // Return both client and user
  // The client has proper user context and will work with RLS policies
  return { supabase, user }
}

// ==================== VALIDATION HELPERS ====================

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: any,
  fields: string[]
): void {
  const missing: string[] = []

  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field)
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(
      `Missing required fields: ${missing.join(', ')}`
    )
  }
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}
