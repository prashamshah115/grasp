import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface IngestRequest {
  document_id: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { document_id } = await req.json() as IngestRequest

    console.log('[ingest-document] Request:', { userId: user.id, documentId: document_id })

    // Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      console.error('[ingest-document] Document not found:', docError)
      return new Response(
        JSON.stringify({ error: 'Document not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Get signed URL for the PDF file
    const { data: signedUrlData } = await supabase.storage
      .from('user-content')
      .createSignedUrl(document.storage_path, 3600) // 1 hour

    if (!signedUrlData) {
      console.error('[ingest-document] Failed to get signed URL')
      return new Response(
        JSON.stringify({ error: 'Failed to access file' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[ingest-document] Got signed URL, triggering worker...')

    // Trigger Trigger.dev worker for PDF processing
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      return new Response(
        JSON.stringify({ error: 'Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
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
      console.error('[ingest-document] Trigger.dev error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to trigger processing job' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const triggerData = await triggerResponse.json()

    console.log('[ingest-document] Worker triggered successfully:', triggerData)

    return new Response(
      JSON.stringify({
        success: true,
        jobId: triggerData.id,
        message: 'Document processing started'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[ingest-document] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
