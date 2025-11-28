// Edge Function: /search-web
// Purpose: Web search using Tavily API for RAG enhancement
// Called by: searchWeb API function, optionally by rag-chat

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rate-limit.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
} from '../_shared/errors.ts'

interface WebSearchRequest {
  query: string
  maxResults?: number
}

interface WebSearchResult {
  title: string
  url: string
  snippet: string
  score?: number
}

interface WebSearchResponse {
  results: WebSearchResult[]
  query: string
}

serve(async (req) => {
  const FUNCTION_NAME = 'search-web'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    console.log(`[${FUNCTION_NAME}] Request received`)

    // Authenticate user
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Rate limiting check - use a more restrictive limit for web search
    const rateLimitResult = await checkRateLimit(user.id, {
      endpoint: 'search_web',
      limit: 30, // 30 requests per window
      window_minutes: 60, // 1 hour window
    })
    
    if (!rateLimitResult.allowed) {
      console.log(`[${FUNCTION_NAME}] Rate limit exceeded for user:`, user.id)
      return rateLimitResponse(rateLimitResult)
    }

    // Parse request
    let body: WebSearchRequest
    try {
      body = await req.json() as WebSearchRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Validate input
    if (!body.query || typeof body.query !== 'string' || body.query.trim().length === 0) {
      throw new ValidationError('Query is required and cannot be empty')
    }

    const query = body.query.trim()
    const maxResults = Math.min(body.maxResults || 5, 10) // Cap at 10 results

    console.log(`[${FUNCTION_NAME}] Searching for:`, query.substring(0, 100))

    // Get Tavily API key
    const tavilyApiKey = Deno.env.get('TAVILY_API_KEY')
    
    if (!tavilyApiKey) {
      console.error(`[${FUNCTION_NAME}] TAVILY_API_KEY not configured`)
      // Return empty results instead of failing
      return successResponse({
        results: [],
        query,
      } as WebSearchResponse)
    }

    // Call Tavily API
    const tavilyResponse = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query,
        search_depth: 'basic', // Use basic for faster/cheaper results
        include_answer: false,
        include_raw_content: false,
        max_results: maxResults,
      }),
    })

    if (!tavilyResponse.ok) {
      const errorText = await tavilyResponse.text()
      console.error(`[${FUNCTION_NAME}] Tavily API error:`, tavilyResponse.status, errorText)
      
      // Return empty results on API error (graceful degradation)
      return successResponse({
        results: [],
        query,
      } as WebSearchResponse)
    }

    const tavilyData = await tavilyResponse.json()
    
    // Transform Tavily results to our format
    const results: WebSearchResult[] = (tavilyData.results || []).map((r: any) => ({
      title: r.title || 'Untitled',
      url: r.url || '',
      snippet: r.content || r.snippet || '',
      score: r.score,
    }))

    console.log(`[${FUNCTION_NAME}] Found ${results.length} results`)

    // Track usage in llm_usage table (for cost tracking)
    try {
      await supabase
        .from('llm_usage')
        .insert({
          user_id: user.id,
          feature: 'web_search',
          model: 'tavily-basic',
          input_tokens: query.length,
          output_tokens: JSON.stringify(results).length,
          cost_estimate: 0.003 * results.length, // Rough estimate: $0.003 per result
          metadata: {
            query: query.substring(0, 200),
            result_count: results.length,
          },
        })
    } catch (usageError) {
      console.warn(`[${FUNCTION_NAME}] Failed to track usage (non-critical):`, usageError)
    }

    return successResponse({
      results,
      query,
    } as WebSearchResponse)

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})


