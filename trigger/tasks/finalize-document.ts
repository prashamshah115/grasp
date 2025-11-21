import { task } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';

interface FinalizeDocumentPayload {
  documentId: string;
  pageCount: number; // From Task 1
  embeddingCount: number; // From Task 2
  chunkCount: number; // From Task 2
  userId: string;
}

interface FinalizeDocumentResult {
  success: true;
  documentId: string;
  finalizedAt: string;
}

/**
 * TASK 3: finalize_document
 * 
 * Marks document as ready, updates metadata, cleans up.
 */
export const finalizeDocument = task({
  id: "finalize-document",
  queue: {
    concurrencyLimit: 10 // Lightweight operation
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1_000, // 1 second
    maxTimeoutInMs: 30_000, // 30 seconds
    randomize: true
  },
  run: async (payload: FinalizeDocumentPayload) => {
    const { documentId, pageCount, embeddingCount, chunkCount, userId } = payload;

    console.log(`[finalize-document] ▶️  Finalizing document ${documentId}`);
    const startTime = Date.now();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // Update document to ready status
      const updateData: any = {
        status: 'ready',
        processing_step: null,
        processed_at: new Date().toISOString(),
        total_pages: pageCount
      };

      // Add optional fields if columns exist (graceful if they don't)
      // You can remove these if columns don't exist
      updateData.embedding_count = embeddingCount;
      updateData.chunk_count = chunkCount;

      const { error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', documentId);

      if (updateError) {
        // If embedding_count/chunk_count columns don't exist, try without them
        if (updateError.message.includes('embedding_count') || updateError.message.includes('chunk_count')) {
          const { error: retryError } = await supabase
            .from('documents')
            .update({
              status: 'ready',
              processing_step: null,
              processed_at: new Date().toISOString(),
              total_pages: pageCount
            })
            .eq('id', documentId);

          if (retryError) {
            throw new Error(`❌ Failed to finalize document: ${retryError.message}`);
          }
        } else {
          throw new Error(`❌ Failed to finalize document: ${updateError.message}`);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[finalize-document] ✅ Document ${documentId} finalized in ${totalTime}ms`);
      console.log(`[finalize-document] 📊 Stats: ${pageCount} pages, ${embeddingCount} embeddings, ${chunkCount} chunks`);

      return {
        success: true,
        documentId,
        finalizedAt: new Date().toISOString()
      } as FinalizeDocumentResult;

    } catch (error) {
      console.error(`[finalize-document] ❌ Error finalizing document ${documentId}:`, error);

      // Update document with error (but don't fail the whole pipeline)
      await supabase
        .from('documents')
        .update({
          status: 'error', // Valid status per database constraint
          error_message: (error as Error).message
        })
        .eq('id', documentId)
        .catch(() => {}); // Ignore errors in error handling

      throw error;
    }
  }
});

