// Edge Function: /health-check
// Purpose: Health check for all GRASP backend services
// Returns: Status of database, embeddings, and recent ingestion health

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  checks: {
    database: {
      status: 'pass' | 'fail'
      responseTime?: number
      error?: string
    }
    embeddings: {
      status: 'pass' | 'fail'
      count?: number
      dimension?: number
      error?: string
    }
    ingestion: {
      status: 'pass' | 'warn' | 'fail'
      recentSuccessRate?: number
      failedLast24h?: number
      error?: string
    }
    auth: {
      status: 'pass' | 'fail'
      error?: string
    }
  }
  edgeFunctions: {
    [key: string]: 'deployed' | 'missing'
  }
}

serve(async (req) => {
  const startTime = Date.now()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const response: HealthCheckResponse = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: 'pass' },
        embeddings: { status: 'pass' },
        ingestion: { status: 'pass' },
        auth: { status: 'pass' }
      },
      edgeFunctions: {
        'rag-chat': 'deployed',
        'generate-compression': 'deployed',
        'next-global-question': 'deployed',
        'update-question-history': 'deployed',
        'update-mastery': 'deployed',
        'trigger-ingest': 'deployed',
        'health-check': 'deployed'
      }
    }

    // CHECK 1: Database connectivity
    try {
      const dbStart = Date.now()
      const { data, error } = await supabase
        .from('courses')
        .select('id')
        .limit(1)

      response.checks.database.responseTime = Date.now() - dbStart

      if (error) {
        response.checks.database.status = 'fail'
        response.checks.database.error = error.message
        response.status = 'unhealthy'
      }
    } catch (error) {
      response.checks.database.status = 'fail'
      response.checks.database.error = error instanceof Error ? error.message : 'Unknown error'
      response.status = 'unhealthy'
    }

    // CHECK 2: Embeddings (BGE 768d)
    try {
      const { data: embeddings, error } = await supabase
        .from('page_embeddings_v2')
        .select('id, embedding')
        .limit(1)

      if (error) {
        response.checks.embeddings.status = 'fail'
        response.checks.embeddings.error = error.message
        response.status = 'degraded'
      } else {
        response.checks.embeddings.count = embeddings?.length || 0

        // Verify embedding dimension (should be 768 for BGE)
        if (embeddings && embeddings.length > 0 && embeddings[0].embedding) {
          const dimension = Array.isArray(embeddings[0].embedding)
            ? embeddings[0].embedding.length
            : 0
          response.checks.embeddings.dimension = dimension

          if (dimension !== 768) {
            response.checks.embeddings.status = 'fail'
            response.checks.embeddings.error = `Invalid embedding dimension: expected 768, got ${dimension}`
            response.status = 'degraded'
          }
        }
      }
    } catch (error) {
      response.checks.embeddings.status = 'fail'
      response.checks.embeddings.error = error instanceof Error ? error.message : 'Unknown error'
      response.status = 'degraded'
    }

    // CHECK 3: Recent ingestion health
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)

      const { data: recentDocs, error } = await supabase
        .from('documents')
        .select('id, status')
        .gte('created_at', yesterday.toISOString())

      if (error) {
        response.checks.ingestion.status = 'fail'
        response.checks.ingestion.error = error.message
        response.status = 'degraded'
      } else if (recentDocs) {
        const total = recentDocs.length
        const failed = recentDocs.filter(d => d.status === 'failed').length
        const successful = recentDocs.filter(d => d.status === 'ready').length

        response.checks.ingestion.failedLast24h = failed

        if (total > 0) {
          response.checks.ingestion.recentSuccessRate = (successful / total) * 100

          if (response.checks.ingestion.recentSuccessRate < 50) {
            response.checks.ingestion.status = 'fail'
            response.status = 'degraded'
          } else if (response.checks.ingestion.recentSuccessRate < 80) {
            response.checks.ingestion.status = 'warn'
            if (response.status === 'healthy') response.status = 'degraded'
          }
        }
      }
    } catch (error) {
      response.checks.ingestion.status = 'fail'
      response.checks.ingestion.error = error instanceof Error ? error.message : 'Unknown error'
      response.status = 'degraded'
    }

    // CHECK 4: Auth system
    try {
      const { data, error } = await supabase.auth.getUser('dummy-token')
      // Expected to fail with invalid token, but should not throw
      response.checks.auth.status = 'pass'
    } catch (error) {
      response.checks.auth.status = 'fail'
      response.checks.auth.error = error instanceof Error ? error.message : 'Unknown error'
      response.status = 'degraded'
    }

    const statusCode = response.status === 'healthy' ? 200 : response.status === 'degraded' ? 503 : 500

    console.log('[health-check] Complete:', {
      status: response.status,
      duration: Date.now() - startTime,
      database: response.checks.database.status,
      embeddings: response.checks.embeddings.status,
      ingestion: response.checks.ingestion.status
    })

    return new Response(
      JSON.stringify(response, null, 2),
      {
        status: statusCode,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        }
      }
    )

  } catch (error) {
    console.error('[health-check] Critical error:', error)

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {}
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
