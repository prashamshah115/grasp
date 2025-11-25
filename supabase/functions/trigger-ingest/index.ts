// Edge Function: /trigger-ingest
// Purpose: Trigger PDF ingestion via Trigger.dev worker
// Called by: useIngestDocument hook after file upload

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  isValidUUID,
} from '../_shared/errors.ts'

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
  const FUNCTION_NAME = 'trigger-ingest'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user and get properly configured Supabase client
    // This uses the CORRECT Supabase v2 pattern for Edge Functions
    const { supabase, user } = await requireAuth(req)
    console.log(`[${FUNCTION_NAME}] User authenticated:`, user.id)

    // Safe JSON parsing with error handling
    let body: TriggerIngestRequest
    try {
      body = await req.json() as TriggerIngestRequest
    } catch (error) {
      throw new ValidationError('Invalid JSON in request body')
    }

    // Input validation
    if (!body.document_id || typeof body.document_id !== 'string') {
      throw new ValidationError('document_id is required and must be a string')
    }

    if (!isValidUUID(body.document_id)) {
      throw new ValidationError('document_id must be a valid UUID')
    }

    const { document_id } = body

    console.log(`[${FUNCTION_NAME}] Request:`, { userId: user.id, documentId: document_id })

    // Get Trigger.dev config
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
    }

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      console.error(`[${FUNCTION_NAME}] Document not found:`, docError)
      throw new NotFoundError('Document not found')
    }

    // Verify ownership (user must own document or be admin)
    if (document.owner_user_id && document.owner_user_id !== user.id) {
      throw new ForbiddenError('You do not own this document')
    }

    console.log(`[${FUNCTION_NAME}] Document found:`, {
      id: document.id,
      title: document.title,
      storagePath: document.storage_path,
      status: document.status
    })

    // Determine storage bucket (default to user-content for user uploads)
    const bucketName = document.storage_bucket || 'user-content'
    
    // Get signed URL for the PDF file
    const { data: signedUrlData, error: urlError } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(document.storage_path, 3600) // 1 hour

    if (urlError || !signedUrlData) {
      console.error(`[${FUNCTION_NAME}] Failed to get signed URL:`, urlError)
      throw new Error(`Failed to get signed URL: ${urlError?.message || 'Unknown error'}`)
    }

    console.log(`[${FUNCTION_NAME}] Got signed URL, updating document status...`)

    // Update status to queued
    await supabase
      .from('documents')
      .update({ status: 'queued', processing_step: 'waiting' })
      .eq('id', document_id)

    console.log(`[${FUNCTION_NAME}] Triggering Trigger.dev worker...`)

    const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/ingest-document/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${triggerKey}`
      },
      body: JSON.stringify({
        payload: {
          documentId: document.id,
          pdfUrl: signedUrlData.signedUrl,
          courseId: document.course_id || '',
          topicId: document.topic_id || null,
          userId: user.id
        }
      })
    })

    if (!triggerResponse.ok) {
      const error = await triggerResponse.text()
      console.error(`[${FUNCTION_NAME}] Trigger.dev error:`, error)

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

    console.log(`[${FUNCTION_NAME}] Success, job ID:`, job.id)

    return successResponse({
      success: true,
      documentId: document.id,
      jobId: job.id,
      status: 'queued',
      message: 'Document ingestion started. This may take 2-5 minutes.'
    } as TriggerIngestResponse)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
