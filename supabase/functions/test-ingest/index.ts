import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface TestIngestRequest {
  document_id: string
}

/**
 * TEST ENDPOINT: test-ingest
 * 
 * Manually test the 3-task PDF ingestion pipeline.
 * 
 * Usage:
 * POST /test-ingest
 * Headers: Authorization: Bearer <user_token>
 * Body: { "document_id": "uuid" }
 * 
 * This endpoint:
 * 1. Validates the document exists
 * 2. Gets signed URL
 * 3. Triggers ingest-document task
 * 4. Returns run ID for monitoring
 */
serve(async (req) => {
  try {
    // CORS headers for testing
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

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    const { document_id } = await req.json() as TestIngestRequest

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id in request body' }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    console.log('[test-ingest] Request:', { userId: user.id, documentId: document_id })

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      console.error('[test-ingest] Document not found:', docError)
      return new Response(
        JSON.stringify({ error: 'Document not found', details: docError?.message }),
        { 
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Check document status
    if (document.status === 'processing' || document.status === 'parsed') {
      return new Response(
        JSON.stringify({ 
          error: 'Document is already being processed',
          current_status: document.status,
          processing_step: document.processing_step
        }),
        { 
          status: 409,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Get signed URL for the PDF file
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from('user-content')
      .createSignedUrl(document.storage_path, 3600) // 1 hour

    if (urlError || !signedUrlData) {
      console.error('[test-ingest] Failed to get signed URL:', urlError)
      return new Response(
        JSON.stringify({ error: 'Failed to access file', details: urlError?.message }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    console.log('[test-ingest] Got signed URL, triggering worker...')

    // Trigger Trigger.dev worker for PDF processing
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

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

    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/ingest-document/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${triggerKey}`
      },
      body: JSON.stringify({
        payload: {
          documentId: document_id,
          pdfUrl: signedUrlData.signedUrl,
          courseId: document.course_id,
          topicId: document.topic_id,
          userId: user.id
        }
      })
    })

    if (!triggerResponse.ok) {
      const errorText = await triggerResponse.text()
      console.error('[test-ingest] Trigger.dev error:', errorText)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to trigger processing job',
          details: errorText,
          triggerUrl: `${triggerUrl}/api/v1/tasks/ingest-document/trigger`
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

    console.log('[test-ingest] Worker triggered successfully:', triggerData)

    // Update document status to queued
    await supabase
      .from('documents')
      .update({ status: 'queued', processing_step: 'waiting' })
      .eq('id', document_id)
      .catch(err => console.error('[test-ingest] Failed to update status:', err))

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Document processing started',
        runId: triggerData.id,
        documentId: document_id,
        documentTitle: document.title,
        status: 'queued',
        monitorUrl: `https://cloud.trigger.dev/runs/${triggerData.id}`,
        nextSteps: [
          'Monitor progress at the monitorUrl above',
          'Check document status in Supabase: documents.status',
          'Task 1 (ingest-document) will parse PDF and store pages',
          'Task 2 (generate-embeddings) will create embeddings',
          'Task 3 (finalize-document) will mark as ready'
        ]
      }),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      }
    )

  } catch (error) {
    console.error('[test-ingest] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        stack: error instanceof Error ? error.stack : undefined
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

