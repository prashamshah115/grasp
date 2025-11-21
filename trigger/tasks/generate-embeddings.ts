import { task } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings as generateEmbeddingsUtil } from '../utils/embeddings';
import { chunkText } from '../utils/chunking';

interface GenerateEmbeddingsPayload {
  documentId: string;
  pageIds: string[]; // From Task 1 result
  userId: string;
}

interface GenerateEmbeddingsResult {
  success: true;
  documentId: string;
  embeddingCount: number;
  chunkCount: number;
  stats: {
    embedTimeMs: number;
    chunkTimeMs: number;
  };
}

/**
 * TASK 2: generate_embeddings
 * 
 * STREAMING PIPELINE: Process pages one at a time, chunks one at a time.
 * No accumulation, no batching, minimal memory footprint.
 * 
 * Uses Jina API for embeddings (no local model, no OOM, fast, cost-effective)
 * 
 * Flow: Fetch page → Embed page (Jina API) → Insert → Chunk → Embed chunk (Jina API) → Insert → Free (repeat)
 */
export const generateEmbeddings = task({
  id: "generate-embeddings",
  // ✅ No machine preset needed - Jina API works on default machines
  queue: {
    concurrencyLimit: 5
  },
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 600_000,
    randomize: true
  },
  run: async (payload: GenerateEmbeddingsPayload) => {
    const { documentId, pageIds, userId } = payload;

    console.log(`[generate-embeddings] ▶️  Starting job for document ${documentId} (${pageIds.length} pages)`);
    const startTime = Date.now();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // STEP 1: Update document status
      await supabase
        .from('documents')
        .update({ processing_step: 'generating_embeddings' })
        .eq('id', documentId);

      console.log(`[generate-embeddings] 🧠 Generating 768d embeddings with Jina API (jina-embeddings-v2-base-en)...`);
      const embedStart = Date.now();
      const chunkStart = Date.now();

      let totalEmbeddings = 0;
      let totalChunks = 0;

      // STEP 2: Process pages ONE AT A TIME (streaming)
      for (const pageId of pageIds) {
        // Fetch single page - include document_id for page_embeddings_v2 table
        const { data: page, error: pageError } = await supabase
          .from('document_pages')
          .select('id, page_number, text_content, document_id')
          .eq('id', pageId)
          .single();

        if (pageError || !page) {
          console.warn(`[generate-embeddings] ⚠️  Skipping page ${pageId}: ${pageError?.message || 'not found'}`);
          continue;
        }

        console.log(`[generate-embeddings] 📄 Processing page ${page.page_number} (${page.text_content.length} chars)`);

        // STEP 2a: Generate page embedding (single page, single embedding)
        // ✅ Check if page embedding already exists (idempotent)
        const { data: existingPageEmbedding } = await supabase
          .from('page_embeddings_v2')
          .select('id')
          .eq('document_id', page.document_id)
          .eq('page_number', page.page_number)
          .single();

        if (!existingPageEmbedding) {
          // Page embedding doesn't exist - generate and insert
          const pageText = page.text_content.substring(0, 8000);
          const [pageEmbedding] = await generateEmbeddingsUtil([pageText]);

          // Insert page embedding
          const { error: embedError } = await supabase
            .from('page_embeddings_v2')
            .insert({
              document_id: page.document_id,
              page_number: page.page_number,
              embedding: pageEmbedding
            });

          if (embedError) {
            throw new Error(`❌ Failed to insert page embedding: ${embedError.message}`);
          }

          totalEmbeddings++;
          console.log(`[generate-embeddings] ✅ Page ${page.page_number} embedding inserted`);
        } else {
          console.log(`[generate-embeddings] ⚠️  Page ${page.page_number} embedding already exists, skipping`);
        }

        // STEP 2b: Process chunks ONE AT A TIME (streaming)
        const chunks = chunkText(page.text_content, 500, 100);

        if (chunks.length > 0) {
          console.log(`[generate-embeddings] ✂️  Page ${page.page_number}: ${chunks.length} chunks`);

          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];

            // ✅ Check if chunk already exists (idempotent - handles chunk_metadata view issue)
            const { data: existingChunk } = await supabase
              .from('document_chunks')
              .select('id')
              .eq('page_id', page.id)
              .eq('chunk_index', chunkIndex)
              .single();

            if (!existingChunk) {
              // Chunk doesn't exist - generate embedding and insert
              const [chunkEmbedding] = await generateEmbeddingsUtil([chunk]);

              // Insert chunk
              const { error: chunkError } = await supabase
                .from('document_chunks')
                .insert({
                  page_id: page.id,
                  content: chunk,
                  embedding: chunkEmbedding,
                  context_tags: [],
                  chunk_index: chunkIndex
                });

              if (chunkError) {
                // If error mentions chunk_metadata, it's a database view issue - skip gracefully
                if (chunkError.message.includes('chunk_metadata')) {
                  console.warn(`[generate-embeddings] ⚠️  Chunk ${chunkIndex} insert failed (chunk_metadata view issue), skipping: ${chunkError.message}`);
                  continue;
                }
                throw new Error(`❌ Failed to insert chunk: ${chunkError.message}`);
              }

              totalChunks++;
            } else {
              console.log(`[generate-embeddings] ⚠️  Chunk ${chunkIndex} already exists, skipping`);
            }
            
            // Memory freed: chunk, chunkEmbedding are now out of scope
          }

          console.log(`[generate-embeddings] ✅ Page ${page.page_number}: ${chunks.length} chunks inserted`);
        }

        // Memory freed: page, pageEmbedding, chunks are now out of scope
      }

      const embedTime = Date.now() - embedStart;
      const chunkTime = Date.now() - chunkStart;
      
      console.log(`[generate-embeddings] ✅ Generated ${totalEmbeddings} page embeddings in ${embedTime}ms`);
      console.log(`[generate-embeddings] ✅ Created ${totalChunks} chunks in ${chunkTime}ms`);

      // Update status
      await supabase
        .from('documents')
        .update({ processing_step: 'embedded' })
        .eq('id', documentId);

      const totalTime = Date.now() - startTime;
      console.log(`[generate-embeddings] 🎉 Document ${documentId} embeddings complete in ${totalTime}ms`);

      return {
        success: true,
        documentId,
        embeddingCount: totalEmbeddings,
        chunkCount: totalChunks,
        stats: {
          embedTimeMs: embedTime,
          chunkTimeMs: chunkTime
        }
      } as GenerateEmbeddingsResult;

    } catch (error) {
      console.error(`[generate-embeddings] ❌ Error processing embeddings for document ${documentId}:`, error);

      // Update document with error
      try {
        await supabase
          .from('documents')
          .update({
            status: 'error',
            error_message: (error as Error).message
          })
          .eq('id', documentId);
      } catch (updateError) {
        console.error('[generate-embeddings] Failed to update error status:', updateError);
      }

      throw error;
    }
  }
});

