// Rate Limiting Middleware for Edge Functions
// Prevents abuse of AI-powered endpoints

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RateLimitConfig {
  endpoint: string
  perMinute?: number // Requests per minute (burst protection)
  perHour?: number   // Requests per hour
  perDay?: number    // Requests per day
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  message?: string
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  rag_chat: {
    endpoint: 'rag_chat',
    perMinute: 10,  // Burst protection
    perHour: 100,   // Hourly limit
    perDay: 500     // Daily limit
  },
  generate_compression: {
    endpoint: 'generate_compression',
    perMinute: 2,   // Very expensive operation
    perHour: 10,
    perDay: 50
  },
  next_global_question: {
    endpoint: 'next_global_question',
    perMinute: 30,  // Users will call this frequently during practice
    perHour: 500,
    perDay: 5000
  },
  update_question_history: {
    endpoint: 'update_question_history',
    perMinute: 60,  // Called after each question answer
    perHour: 1000,
    perDay: 10000
  },
  update_mastery: {
    endpoint: 'update_mastery',
    perMinute: 20,  // Called after sessions complete
    perHour: 200,
    perDay: 1000
  },
  start_exam_session: {
    endpoint: 'start_exam_session',
    perMinute: 5,   // Exams shouldn't be started frequently
    perHour: 20,
    perDay: 50
  },
  submit_exam: {
    endpoint: 'submit_exam',
    perMinute: 5,   // Exams shouldn't be submitted frequently
    perHour: 20,
    perDay: 50
  }
}

/**
 * Check if user has exceeded rate limits
 * Returns whether request is allowed and remaining quota
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const supabaseUrl = Deno.env.get('PUBLIC_SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase configuration for rate limiting')
    // Fail open - allow request but log error
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 60000)
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Check different time windows
  const checks = []

  if (config.perMinute) {
    checks.push({
      limit: config.perMinute,
      window: 'minute',
      windowStart: new Date(Date.now() - 60 * 1000)
    })
  }

  if (config.perHour) {
    checks.push({
      limit: config.perHour,
      window: 'hour',
      windowStart: new Date(Date.now() - 60 * 60 * 1000)
    })
  }

  if (config.perDay) {
    checks.push({
      limit: config.perDay,
      window: 'day',
      windowStart: new Date(Date.now() - 24 * 60 * 60 * 1000)
    })
  }

  // Check each time window
  for (const check of checks) {
    const { data: usageRecords, error } = await supabase
      .from('rate_limit_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('endpoint', config.endpoint)
      .gte('window_start', check.windowStart.toISOString())

    if (error) {
      console.error('Rate limit check error:', error)
      // Fail open on database errors
      return {
        allowed: true,
        remaining: 999,
        resetAt: new Date(Date.now() + 60000)
      }
    }

    const totalRequests = usageRecords?.reduce(
      (sum, record) => sum + record.request_count,
      0
    ) || 0

    if (totalRequests >= check.limit) {
      // Rate limit exceeded
      const resetAt = new Date(check.windowStart.getTime() + getWindowDuration(check.window))
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        message: `Rate limit exceeded: ${check.limit} requests per ${check.window}. Try again after ${resetAt.toISOString()}`
      }
    }
  }

  // All checks passed - record this request
  await recordRequest(supabase, userId, config.endpoint)

  // Calculate remaining for the most restrictive limit
  const mostRestrictive = checks.reduce((min, check) =>
    check.limit < min.limit ? check : min
  )

  const { data: currentUsage } = await supabase
    .from('rate_limit_usage')
    .select('request_count')
    .eq('user_id', userId)
    .eq('endpoint', config.endpoint)
    .gte('window_start', mostRestrictive.windowStart.toISOString())

  const totalRequests = currentUsage?.reduce(
    (sum, record) => sum + record.request_count,
    0
  ) || 0

  return {
    allowed: true,
    remaining: mostRestrictive.limit - totalRequests,
    resetAt: new Date(mostRestrictive.windowStart.getTime() + getWindowDuration(mostRestrictive.window))
  }
}

/**
 * Record a request in the rate limit table
 * Uses PostgreSQL upsert pattern with date_trunc for window alignment
 */
async function recordRequest(
  supabase: any,
  userId: string,
  endpoint: string
): Promise<void> {
  // Use PostgreSQL's date_trunc to get current minute window
  // This query gets or creates the record atomically
  const { data, error } = await supabase.rpc('increment_rate_limit', {
    uid: userId,
    p_endpoint: endpoint
  })

  if (error) {
    // Fallback to manual insert/update if RPC not available
    const now = new Date()
    // Round down to the current minute
    now.setSeconds(0, 0)
    const windowStart = now.toISOString()

    const { data: existing, error: selectError } = await supabase
      .from('rate_limit_usage')
      .select('id, request_count')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gte('window_start', windowStart)
      .maybeSingle()

    if (existing) {
      // Increment existing record
      await supabase
        .from('rate_limit_usage')
        .update({
          request_count: existing.request_count + 1
        })
        .eq('id', existing.id)
    } else {
      // Create new record (window_start will use DEFAULT date_trunc('minute', now()))
      await supabase
        .from('rate_limit_usage')
        .insert({
          user_id: userId,
          endpoint,
          request_count: 1
        })
    }
  }
}

/**
 * Get duration in milliseconds for a time window
 */
function getWindowDuration(window: string): number {
  switch (window) {
    case 'minute':
      return 60 * 1000
    case 'hour':
      return 60 * 60 * 1000
    case 'day':
      return 24 * 60 * 60 * 1000
    default:
      return 60 * 1000
  }
}

/**
 * Create rate limit response with proper headers
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: result.message || 'Rate limit exceeded',
      resetAt: result.resetAt.toISOString()
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': result.resetAt.toISOString(),
        'Retry-After': Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
      }
    }
  )
}
