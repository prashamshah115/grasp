import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BatchIngestRequest {
  bucketName?: string
  folderPath?: string
  userId?: string
  dryRun?: boolean
}

/**
 * EDGE FUNCTION: batch-ingest-storage
 * 
 * Triggers batch ingestion of all PDFs in Supabase Storage.
 * 
 * Handles ANY folder structure:
 * - Standard: {courseCode}/{week-topic}/{files.pdf}
 * - Flat: {files.pdf}
 * - Nested: {userId}/courses/{courseId}/{topicId}/{files.pdf}
 * - Mixed: Any combination
 * 
 * Usage:
 * POST /batch-ingest-storage
 * Headers: Authorization: Bearer <service_role_key or user_token>
 * Body: {
 *   "bucketName": "user-content",  // optional, default: "user-content"
 *   "folderPath": "CSE101/week1",  // optional, specific folder
 *   "userId": "uuid",              // optional, specific user
 *   "dryRun": true                 // optional, test mode
 * }
 */
serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'authorization, content-type',
        },
      })
    }

    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Auth - can use service role or user token
    const authHeader = req.headers.get('Authorization')
    let user: any = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
      
      if (!authError && authUser) {
        user = authUser;
      }
      // If auth fails, continue with service role (admin access)
    }

    const { bucketName = 'user-content', folderPath, userId, dryRun = false } = 
      await req.json() as BatchIngestRequest

    console.log('[batch-ingest-storage] Request:', {
      bucketName,
      folderPath,
      userId: userId || user?.id || 'system',
      dryRun
    })

    // Trigger Trigger.dev batch ingestion task
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    console.log('[batch-ingest-storage] TRIGGER_API_URL:', triggerUrl)
    console.log('[batch-ingest-storage] TRIGGER_SECRET_KEY:', triggerKey ? `${triggerKey.substring(0, 10)}...` : 'MISSING')

    if (!triggerUrl || !triggerKey) {
      return new Response(
        JSON.stringify({ 
          error: 'Trigger.dev not configured',
          missing: !triggerUrl ? 'TRIGGER_API_URL' : 'TRIGGER_SECRET_KEY'
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    const effectiveUserId = userId || user?.id || null;

    // Build payload - only include optional fields when they have values
    const payload: any = {
      bucketName,
      dryRun
    };

    // Only add optional fields if they have actual values (not null/undefined)
    if (folderPath) {
      payload.folderPath = folderPath;
    }

    if (effectiveUserId) {
      payload.userId = effectiveUserId;
    }

    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/batch-ingest-storage/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${triggerKey}`
      },
      body: JSON.stringify({
        payload
      })
    })

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      console.error('[batch-ingest-storage] Trigger.dev error:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to trigger batch ingestion',
          details: errorText
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    const triggerData = await triggerResponse.json()

    console.log('[batch-ingest-storage] Batch job triggered:', triggerData.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: dryRun ? 'Dry run started - no files will be processed' : 'Batch ingestion started',
        runId: triggerData.id,
        monitorUrl: `https://cloud.trigger.dev/runs/${triggerData.id}`,
        config: {
          bucketName,
          folderPath: folderPath || 'root',
          userId: effectiveUserId || 'all users',
          dryRun
        },
        note: 'This may take several minutes. Monitor progress at the monitorUrl above.'
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )

  } catch (error: any) {
    console.error('[batch-ingest-storage] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )
  }
})

