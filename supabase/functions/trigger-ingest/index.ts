// Edge Function: /trigger-ingest
// Purpose: Trigger PDF ingestion via Trigger.dev worker
// Called by: useIngestDocument hook after file upload

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface TriggerIngestRequest {
  document_id: string
}

interface TriggerIngestResponse {
  success: boolean
  documentId: string
  jobId: string
  status: string
  message: string
}

serve(async (req) => {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const input = await req.json() as TriggerIngestRequest
    const { document_id } = input

    console.log('[trigger-ingest] Request:', { userId: user.id, documentId: document_id })

    // Get Trigger.dev config
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
    }

    // Validate document_id
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: 'Missing document_id' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      console.error('[trigger-ingest] Document not found:', docError)
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404 }
      )
    }

    // Verify ownership (user must own document or be admin)
    if (document.owner_user_id && document.owner_user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: You do not own this document' }),
        { status: 403 }
      )
    }

    console.log('[trigger-ingest] Document found:', {
      id: document.id,
      title: document.title,
      storagePath: document.storage_path,
      status: document.status
    })

    // Update status to queued
    await supabase
      .from('documents')
      .update({ status: 'queued', processing_step: 'waiting' })
      .eq('id', document_id)

    console.log('[trigger-ingest] Triggering Trigger.dev worker...')

    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/ingest-document/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${triggerKey}`
      },
      body: JSON.stringify({
        documentId: document.id,
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path,
        courseId: document.course_id,
        topicId: document.topic_id
      })
    })

    if (!triggerResponse.ok) {
      const error = await triggerResponse.text()
      console.error('[trigger-ingest] Trigger.dev error:', error)

      // Update document status to failed
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: `Failed to trigger ingestion: ${error}`
        })
        .eq('id', document_id)

      throw new Error(`Failed to trigger ingestion: ${error}`)
    }

    const job = await triggerResponse.json()

    console.log('[trigger-ingest] Success, job ID:', job.id)

    return new Response(
      JSON.stringify({
        success: true,
        documentId: document.id,
        jobId: job.id,
        status: 'queued',
        message: 'Document ingestion started. This may take 2-5 minutes.'
      } as TriggerIngestResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
        }
      }
    )

  } catch (error) {
    console.error('[trigger-ingest] Error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})
