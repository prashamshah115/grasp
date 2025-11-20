/**
 * Trigger.dev Worker: PDF Ingestion with BGE Embeddings
 *
 * This worker:
 * 1. Downloads PDF from Supabase Storage
 * 2. Parses PDF using pymupdf4llm (requires Python extension)
 * 3. Generates BGE embeddings (768 dimensions)
 * 4. Stores pages and embeddings in Supabase
 *
 * Model: BAAI/bge-base-en-v1.5 (768 dimensions)
 *
 * Setup Instructions:
 * 1. Install Trigger.dev CLI: npm install -g @trigger.dev/cli
 * 2. Initialize project: npx trigger.dev init
 * 3. Enable Python extension in Trigger.dev dashboard
 * 4. Deploy: npx trigger.dev deploy
 */

import { task } from "@trigger.dev/sdk/v3"
import { createClient } from '@supabase/supabase-js'

interface IngestPDFPayload {
  documentId: string
  storageBucket: string
  storagePath: string
  courseId: string
  topicId: string | null
}

interface IngestPDFResult {
  success: boolean
  documentId: string
  pagesProcessed: number
  embeddingsGenerated: number
}

export const ingestPDF = task({
  id: "ingest_pdf_bge",
  queue: {
    concurrencyLimit: 3 // Process 3 PDFs at once max
  },
  retry: {
    maxAttempts: 5,
    minTimeout: 10000, // 10 seconds
    maxTimeout: 600000 // 10 minutes
  },
  run: async (payload: IngestPDFPayload, { ctx }): Promise<IngestPDFResult> => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { documentId, storageBucket, storagePath } = payload

    try {
      console.log('[ingest-pdf] Starting ingestion:', { documentId, storagePath })

      // STEP 1: Update status
      await supabase
        .from('documents')
        .update({ status: 'processing', processing_step: 'downloading' })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'download_start', 'Starting PDF download', true)

      // STEP 2: Download PDF from Supabase Storage
      const { data: pdfBlob, error: downloadError } = await supabase
        .storage
        .from(storageBucket)
        .download(storagePath)

      if (downloadError) {
        console.error('[ingest-pdf] Download error:', downloadError)
        throw downloadError
      }

      await logStep(supabase, documentId, 'download_complete', `Downloaded ${pdfBlob.size} bytes`, true)

      // STEP 3: Parse PDF using pymupdf4llm (Python)
      await supabase
        .from('documents')
        .update({ processing_step: 'parsing' })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'parse_start', 'Starting PDF parsing', true)

      // Convert Blob to Buffer
      const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

      // Call Python parsing function
      // NOTE: This requires Python extension enabled in Trigger.dev
      const parsedData = await ctx.runPython({
        code: `
import pymupdf4llm
import json

def parse_pdf(pdf_bytes):
    # Parse PDF to structured markdown
    result = pymupdf4llm.to_markdown(pdf_bytes, page_chunks=True)

    pages = []
    for i, page in enumerate(result.get('pages', [])):
        pages.append({
            'page_number': i + 1,
            'text': page.get('text', ''),
            'has_images': len(page.get('images', [])) > 0,
            'has_tables': len(page.get('tables', [])) > 0
        })

    return pages

# Entry point
pages = parse_pdf(pdf_bytes)
print(json.dumps(pages))
        `,
        args: { pdf_bytes: pdfBuffer }
      })

      const pages = JSON.parse(parsedData.stdout)

      await supabase
        .from('documents')
        .update({ total_pages: pages.length })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'parse_complete', `Parsed ${pages.length} pages`, true)

      // STEP 4: Insert page contents
      await supabase
        .from('documents')
        .update({ processing_step: 'storing_pages' })
        .eq('id', documentId)

      for (const page of pages) {
        await supabase
          .from('document_pages')
          .insert({
            document_id: documentId,
            page_number: page.page_number,
            content: page.text,
            char_count: page.text.length,
            has_images: page.has_images || false,
            has_tables: page.has_tables || false
          })
      }

      await logStep(supabase, documentId, 'pages_stored', `Stored ${pages.length} pages`, true)

      // STEP 5: Generate BGE embeddings (768d)
      await supabase
        .from('documents')
        .update({ processing_step: 'generating_embeddings' })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'embedding_start', 'Generating BGE embeddings', true)

      // Call Python for BGE embeddings
      const embeddingsData = await ctx.runPython({
        code: `
from sentence_transformers import SentenceTransformer
import json

def generate_embeddings(texts):
    # Load BGE model (768 dimensions)
    model = SentenceTransformer('BAAI/bge-base-en-v1.5')

    # Generate embeddings
    embeddings = model.encode(texts)

    # Convert to list format
    return [emb.tolist() for emb in embeddings]

# Entry point
texts = [page['text'][:8000] for page in pages]  # Truncate to 8k chars
embeddings = generate_embeddings(texts)
print(json.dumps(embeddings))
        `,
        args: { pages }
      })

      const embeddings = JSON.parse(embeddingsData.stdout)

      // Verify embedding dimensions
      if (embeddings.length > 0 && embeddings[0].length !== 768) {
        throw new Error(`Invalid embedding dimension: expected 768, got ${embeddings[0].length}`)
      }

      // STEP 6: Insert embeddings into page_embeddings_v2
      const embeddingInserts = embeddings.map((emb: number[], idx: number) => ({
        document_id: documentId,
        page_number: pages[idx].page_number,
        embedding: emb,
        model: 'bge-base-en-v1.5'
      }))

      await supabase
        .from('page_embeddings_v2')
        .insert(embeddingInserts)

      await logStep(
        supabase,
        documentId,
        'embedding_complete',
        `Generated ${embeddings.length} BGE embeddings (768d)`,
        true
      )

      // STEP 7: Mark as completed
      await supabase
        .from('documents')
        .update({
          status: 'ready',
          processing_step: null,
          processed_at: new Date().toISOString()
        })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'complete', 'Ingestion completed successfully', true)

      console.log('[ingest-pdf] Success:', {
        documentId,
        pagesProcessed: pages.length,
        embeddingsGenerated: embeddings.length
      })

      return {
        success: true,
        documentId,
        pagesProcessed: pages.length,
        embeddingsGenerated: embeddings.length
      }

    } catch (error) {
      console.error('[ingest-pdf] Error:', error)

      // Log error
      await logStep(
        supabase,
        documentId,
        'error',
        error instanceof Error ? error.message : 'Unknown error',
        false
      )

      // Update document status
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', documentId)

      throw error // Trigger.dev will retry
    }
  }
})

// Also export a simple text embedding task for RAG queries
export const embedText = task({
  id: "embed_text_bge",
  machine: {
    preset: "small-1x" // Fast for single queries
  },
  run: async (payload: { text: string }, { ctx }) => {
    console.log('[embed-text] Generating embedding for query')

    const embeddingData = await ctx.runPython({
      code: `
from sentence_transformers import SentenceTransformer
import json

def generate_embedding(text):
    model = SentenceTransformer('BAAI/bge-base-en-v1.5')
    embedding = model.encode([text])
    return embedding[0].tolist()

embedding = generate_embedding(text)
print(json.dumps(embedding))
      `,
      args: { text: payload.text }
    })

    const embedding = JSON.parse(embeddingData.stdout)

    console.log('[embed-text] Success, dimensions:', embedding.length)

    return {
      embedding,
      dimensions: 768,
      model: 'bge-base-en-v1.5'
    }
  }
})

// Helper function to log steps
async function logStep(
  supabase: any,
  documentId: string,
  step: string,
  message: string,
  success: boolean
) {
  await supabase
    .from('document_ingestion_logs')
    .insert({
      document_id: documentId,
      step,
      message,
      success
    })
}
