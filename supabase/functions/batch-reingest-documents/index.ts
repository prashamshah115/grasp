import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface BatchReingestRequest {
  statusFilter?: string[] // e.g., ['processing', 'error']
  limit?: number // Max documents to process
  dryRun?: boolean // Test mode - don't actually trigger
}

interface DocumentToProcess {
  id: string
  title: string
  storage_path: string
  storage_bucket: string | null
  course_id: string | null
  topic_id: string | null
  owner_user_id: string | null
  status: string
}

/**
 * EDGE FUNCTION: batch-reingest-documents
 * 
 * Re-processes existing documents in the database that need ingestion.
 * 
 * Finds documents that:
 * - Have status 'processing' or 'error'
 * - OR have no document_pages (failed ingestion)
 * 
 * Then triggers ingest-document task for each (which chains to embeddings → finalize).
 * 
 * Usage:
 * POST /batch-reingest-documents
 * Headers: Authorization: Bearer <service_role_key or user_token>
 * Body: {
 *   "statusFilter": ["processing", "error"],  // optional
 *   "limit": 100,                           // optional, max docs to process
 *   "dryRun": false                         // optional, test mode
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

    // Get optional auth (for logging, but not required with SERVICE_ROLE_KEY)
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    const body = await req.json().catch(() => ({})) as BatchReingestRequest
    const { statusFilter = ['processing', 'error'], limit, dryRun = false } = body

    console.log('[batch-reingest-documents] Starting batch re-ingestion', {
      statusFilter,
      limit,
      dryRun,
      userId
    })

    // STEP 1: Find documents that need processing
    // Documents with status 'processing' or 'error', OR documents with no pages
    console.log('[batch-reingest-documents] 📋 Finding documents that need processing...')

    // First, get documents with problematic status
    let query = supabase
      .from('documents')
      .select('id, title, storage_path, storage_bucket, course_id, topic_id, owner_user_id, status')
      .in('status', statusFilter)

    if (limit) {
      query = query.limit(limit)
    }

    const { data: statusDocs, error: statusError } = await query

    if (statusError) {
      throw new Error(`Failed to query documents by status: ${statusError.message}`)
    }

    // Second, get all document IDs that have pages
    const { data: docsWithPages } = await supabase
      .from('document_pages')
      .select('document_id')
      .not('document_id', 'is', null)

    const docIdsWithPages = new Set((docsWithPages || []).map(p => p.document_id))

    // Third, get all documents and filter out those that already have pages
    const { data: allDocuments } = await supabase
      .from('documents')
      .select('id, title, storage_path, storage_bucket, course_id, topic_id, owner_user_id, status')
      .limit(limit ? limit * 2 : 2000) // Get more to account for filtering

    // Filter to documents without pages (that weren't already in statusDocs)
    const statusDocIds = new Set((statusDocs || []).map(d => d.id))
    const docsWithoutPages = (allDocuments || [])
      .filter(doc => !docIdsWithPages.has(doc.id) && !statusDocIds.has(doc.id))
      .slice(0, limit || 1000)

    // Combine and deduplicate
    const allDocs = [...(statusDocs || []), ...docsWithoutPages]
    const uniqueDocs = new Map<string, DocumentToProcess>()
    
    for (const doc of allDocs) {
      if (!uniqueDocs.has(doc.id)) {
        uniqueDocs.set(doc.id, doc as DocumentToProcess)
      }
    }

    const documentsToProcess = Array.from(uniqueDocs.values())
    
    if (limit && documentsToProcess.length > limit) {
      documentsToProcess.splice(limit)
    }

    console.log(`[batch-reingest-documents] 📊 Found ${documentsToProcess.length} documents to process`)

    if (documentsToProcess.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No documents need processing',
          documentsFound: 0,
          triggered: 0,
          errors: []
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // STEP 2: Process each document
    const triggerUrl = Deno.env.get('TRIGGER_API_URL')
    const triggerKey = Deno.env.get('TRIGGER_SECRET_KEY')

    if (!triggerUrl || !triggerKey) {
      throw new Error('Trigger.dev not configured. Set TRIGGER_API_URL and TRIGGER_SECRET_KEY')
    }

    console.log('[batch-reingest-documents] TRIGGER_API_URL:', triggerUrl)
    console.log('[batch-reingest-documents] TRIGGER_SECRET_KEY:', triggerKey ? `${triggerKey.substring(0, 10)}...` : 'MISSING')

    const results = {
      triggered: 0,
      errors: [] as Array<{ documentId: string; title: string; error: string }>,
      skipped: 0
    }

    for (const doc of documentsToProcess) {
      try {
        // Determine storage bucket (use document's bucket or default to 'course-materials')
        // Try 'course-materials' first (your main bucket), fallback to 'user-content'
        const bucketName = doc.storage_bucket || 'course-materials'
        
        console.log(`[batch-reingest-documents] 🔄 Processing: ${doc.title} (${doc.id})`)

        if (dryRun) {
          console.log(`[batch-reingest-documents] [DRY RUN] Would trigger ingestion for ${doc.id}`)
          results.triggered++
          continue
        }

        // Get signed URL for the PDF
        const { data: signedUrlData, error: urlError } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(doc.storage_path, 3600) // 1 hour

        if (urlError || !signedUrlData) {
          throw new Error(`Failed to get signed URL: ${urlError?.message || 'Unknown error'}`)
        }

        // Determine userId (use document owner or provided user or system)
        const effectiveUserId = doc.owner_user_id || userId || 'system'

        // Trigger ingest-document task
        const triggerResponse = await fetch(`${triggerUrl}/api/v1/tasks/ingest-document/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${triggerKey}`
          },
          body: JSON.stringify({
            payload: {
              documentId: doc.id,
              pdfUrl: signedUrlData.signedUrl,
              courseId: doc.course_id || '',
              topicId: doc.topic_id || null,
              userId: effectiveUserId
            }
          })
        })

        if (!triggerResponse.ok) {
          const errorText = await triggerResponse.text()
          throw new Error(`Trigger.dev API error: ${errorText}`)
        }

        const triggerData = await triggerResponse.json()
        console.log(`[batch-reingest-documents] ✅ Triggered ingestion for ${doc.title} (run: ${triggerData.id})`)
        
        results.triggered++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        console.error(`[batch-reingest-documents] ❌ Error processing ${doc.title}:`, error)
        results.errors.push({
          documentId: doc.id,
          title: doc.title,
          error: error.message || 'Unknown error'
        })
      }
    }

    console.log(`[batch-reingest-documents] 🎉 Batch re-ingestion complete!`)
    console.log(`[batch-reingest-documents] 📊 Stats: ${results.triggered} triggered, ${results.errors.length} errors`)

    return new Response(
      JSON.stringify({
        success: true,
        documentsFound: documentsToProcess.length,
        triggered: results.triggered,
        errors: results.errors,
        dryRun
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error: any) {
    console.error('[batch-reingest-documents] ❌ Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})

