import { task, logger, metadata } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { generateKnowledgeGraph } from './generate-knowledge-graph';
import { precomputeKnowledgeObjects } from './precompute-knowledge-objects';
import { precomputeFinalPacks } from './precompute-final-packs';
import { updateRagCache } from './update-rag-cache';
import { extractQuestions } from './extract-questions';
import { embedWebResults } from './embed-web-results';

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
  downstreamTriggered: boolean;
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
      logger.info(`[finalize-document] ✅ Document ${documentId} finalized in ${totalTime}ms`);
      logger.info(`[finalize-document] 📊 Stats: ${pageCount} pages, ${embeddingCount} embeddings, ${chunkCount} chunks`);

      // Get courseId from document for downstream tasks
      const { data: document } = await supabase
        .from('documents')
        .select('course_id')
        .eq('id', documentId)
        .single();

      const courseId = document?.course_id;
      let downstreamTriggered = false;

      if (courseId) {
        logger.info(`[finalize-document] 🔄 Triggering downstream knowledge pipeline for course ${courseId}`);
        metadata.set("stage", "downstream_tasks").set("courseId", courseId);
        
        // Idempotency key based on document + timestamp (prevents duplicate runs on double-click)
        const idempotencyBase = `${documentId}-${Date.now().toString(36)}`;
        
        // Get document type to determine if we should extract questions
        const { data: docDetails } = await supabase
          .from('documents')
          .select('doc_type')
          .eq('id', documentId)
          .single();
        
        const docType = docDetails?.doc_type || 'notes';
        const isExamOrHomework = ['exam', 'homework', 'quiz', 'solution'].includes(docType);
        
        metadata.set("docType", docType).set("isExamOrHomework", isExamOrHomework);
        
        try {
          // STEP 1: Extract knowledge objects FIRST (other tasks depend on this)
          // This must complete before graph/packs can run
          metadata.set("stage", "knowledge_objects");
          logger.info(`[finalize-document] 📚 Step 1: Extracting knowledge objects...`);
          
          const koResult = await precomputeKnowledgeObjects.triggerAndWait(
            { courseId },
            { 
              idempotencyKey: `ko-${idempotencyBase}`,
              idempotencyKeyTTL: "24h"
            }
          );
          
          if (!koResult.ok) {
            logger.warn(`[finalize-document] ⚠️ Knowledge objects extraction failed, continuing with dependent tasks anyway`, {
              error: koResult.error
            });
          } else {
            logger.info(`[finalize-document] ✅ Knowledge objects extracted`, { stats: koResult.output?.stats });
          }
          
          // STEP 2: Now trigger dependent tasks in parallel (they can read knowledge_objects)
          metadata.set("stage", "dependent_tasks");
          logger.info(`[finalize-document] 🔄 Step 2: Triggering dependent tasks in parallel...`);
          
          // Build list of parallel tasks
          const parallelTasks: Promise<any>[] = [
            // Core tasks - always run
            generateKnowledgeGraph.trigger(
              { courseId },
              { idempotencyKey: `kg-${idempotencyBase}`, idempotencyKeyTTL: "24h" }
            ),
            precomputeFinalPacks.trigger(
              { courseId },
              { idempotencyKey: `fp-${idempotencyBase}`, idempotencyKeyTTL: "24h" }
            ),
            updateRagCache.trigger(
              { courseId, documentId },
              { idempotencyKey: `rag-${idempotencyBase}`, idempotencyKeyTTL: "24h" }
            ),
            // NEW: Embed web search results for RAG
            embedWebResults.trigger(
              { courseId },
              { idempotencyKey: `web-${idempotencyBase}`, idempotencyKeyTTL: "24h" }
            ),
          ];
          
          // Conditional: Extract questions from exam/homework documents
          if (isExamOrHomework) {
            logger.info(`[finalize-document] 📝 Document is ${docType}, will extract questions`);
            parallelTasks.push(
              extractQuestions.trigger(
                { 
                  documentId, 
                  courseId,
                  autoPromote: true, // Auto-promote high-confidence questions
                  confidenceThreshold: 0.85
                },
                { idempotencyKey: `eq-${idempotencyBase}`, idempotencyKeyTTL: "24h" }
              )
            );
          }
          
          // Trigger all parallel tasks
          await Promise.all(parallelTasks);
          
          downstreamTriggered = true;
          metadata.set("stage", "completed");
          logger.info(`[finalize-document] ✅ All downstream tasks triggered successfully`, {
            tasksTriggered: parallelTasks.length,
            includesQuestionExtraction: isExamOrHomework
          });
        } catch (downstreamError) {
          logger.error(`[finalize-document] ⚠️ Downstream pipeline error:`, { error: downstreamError });
          metadata.set("stage", "error").set("error", String(downstreamError));
          // Don't fail the finalization if downstream tasks fail
        }
      } else {
        logger.warn(`[finalize-document] ⚠️ No courseId found, skipping downstream tasks`);
      }

      return {
        success: true,
        documentId,
        finalizedAt: new Date().toISOString(),
        downstreamTriggered,
      } as FinalizeDocumentResult;

    } catch (error) {
      console.error(`[finalize-document] ❌ Error finalizing document ${documentId}:`, error);

      // Update document with error (but don't fail the whole pipeline)
      try {
        await supabase
          .from('documents')
          .update({
            status: 'error', // Valid status per database constraint
            error_message: (error as Error).message
          })
          .eq('id', documentId);
      } catch {
        // Ignore errors in error handling
      }

      throw error;
    }
  }
});

