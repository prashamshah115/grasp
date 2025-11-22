import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
  NotFoundError,
  isValidUUID,
} from '../_shared/errors.ts'

interface IngestRequest {
  document_id: string
}

serve(async (req) => {
  const FUNCTION_NAME = 'ingest-document'

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
    let body: IngestRequest
    try {
      body = await req.json() as IngestRequest
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

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      console.error(`[${FUNCTION_NAME}] Document not found:`, docError)
      throw new NotFoundError('Document not found')
    }

    // Get signed URL for the PDF file
    const { data: signedUrlData } = await supabase.storage
      .from('user-content')
      .createSignedUrl(document.storage_path, 3600) // 1 hour

    if (!signedUrlData) {
      console.error(`[${FUNCTION_NAME}] Failed to get signed URL`)
      throw new Error('Failed to access file')
    }

    console.log(`[${FUNCTION_NAME}] Got signed URL, triggering worker...`)

    // Trigger Trigger.dev worker for PDF processing
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
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
      console.error(`[${FUNCTION_NAME}] Trigger.dev error:`, errorText)
      throw new Error(`Failed to trigger processing job: ${errorText}`)
    }

    const triggerData = await triggerResponse.json()

    console.log(`[${FUNCTION_NAME}] Worker triggered successfully:`, triggerData)

    return successResponse({
      success: true,
      jobId: triggerData.id,
      message: 'Document processing started'
    })

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
