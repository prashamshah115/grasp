import { task, logger, metadata, AbortTaskRunError } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';

interface UpdateRagCachePayload {
  courseId: string;
  documentId?: string; // Optional: only update cache for specific document
}

interface RagChunkRecord {
  course_id: string;
  topic_id: string | null;
  chunk_id: number;
  content: string;
  metadata: Record<string, unknown>;
  embedding: number[] | null;
  concept_ids: string[];
  formula_ids: string[];
}

/**
 * TASK: Update RAG Cache
 * 
 * Populates the optimized rag_chunks table from document_chunks.
 * Links chunks to concepts and formulas for enhanced RAG retrieval.
 */
export const updateRagCache = task({
  id: "update-rag-cache",
  queue: {
    concurrencyLimit: 2
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    randomize: true
  },
  // Classify errors - abort on fatal, retry on transient
  catchError: async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Fatal errors - don't retry
    if (errorMessage.includes("SUPABASE_URL") || errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    
    // Allow retry for transient errors
    return undefined;
  },
  run: async (payload: UpdateRagCachePayload) => {
    const { courseId, documentId } = payload;
    logger.info(`[update-rag-cache] Starting for course ${courseId}`, { documentId });
    
    // Initialize progress metadata
    metadata
      .set("stage", "initializing")
      .set("progress", 0)
      .set("courseId", courseId);
    
    if (documentId) {
      metadata.set("documentId", documentId);
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get documents to process
    metadata.set("stage", "fetching_documents");
    let documentsQuery = supabase
      .from('documents')
      .select('id, topic_id, title')
      .eq('course_id', courseId)
      .eq('status', 'ready');

    if (documentId) {
      documentsQuery = documentsQuery.eq('id', documentId);
    }

    const { data: documents, error: docsError } = await documentsQuery;

    if (docsError || !documents || documents.length === 0) {
      logger.warn(`[update-rag-cache] No ready documents found for course ${courseId}`);
      metadata.set("stage", "no_documents");
      return { success: false, reason: 'no_documents' };
    }

    logger.info(`[update-rag-cache] Processing ${documents.length} documents`);
    metadata.set("totalDocuments", documents.length).set("progress", 10);

    // Get concepts for this course (for linking)
    metadata.set("stage", "linking_concepts");
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, title, topic_id')
      .eq('course_id', courseId);

    const conceptsByTopic = new Map<string, string[]>();
    concepts?.forEach(c => {
      if (c.topic_id) {
        const existing = conceptsByTopic.get(c.topic_id) || [];
        existing.push(c.id);
        conceptsByTopic.set(c.topic_id, existing);
      }
    });
    metadata.set("conceptCount", concepts?.length || 0);

    // Get formulas for this course (for linking)
    const { data: formulas } = await supabase
      .from('formulas')
      .select('id, topic_id')
      .eq('course_id', courseId);

    const formulasByTopic = new Map<string, string[]>();
    formulas?.forEach(f => {
      if (f.topic_id) {
        const existing = formulasByTopic.get(f.topic_id) || [];
        existing.push(f.id);
        formulasByTopic.set(f.topic_id, existing);
      }
    });
    metadata.set("formulaCount", formulas?.length || 0).set("progress", 20);

    let totalChunks = 0;
    let insertedChunks = 0;
    let processedDocs = 0;

    metadata.set("stage", "processing_documents");

    for (const doc of documents) {
      const docProgress = 20 + Math.round((processedDocs / documents.length) * 70);
      metadata
        .set("progress", docProgress)
        .set("currentDocument", doc.title)
        .set("documentsProcessed", processedDocs);
      
      // Get document pages
      const { data: pages } = await supabase
        .from('document_pages')
        .select('id')
        .eq('document_id', doc.id);

      if (!pages || pages.length === 0) {
        processedDocs++;
        continue;
      }

      const pageIds = pages.map(p => p.id);

      // Get chunks for these pages
      const { data: chunks, error: chunksError } = await supabase
        .from('document_chunks')
        .select('id, page_id, content, embedding, context_tags')
        .in('page_id', pageIds);

      if (chunksError || !chunks) {
        processedDocs++;
        continue;
      }

      totalChunks += chunks.length;

      // Prepare rag_chunks records
      const ragChunks: RagChunkRecord[] = chunks.map(chunk => ({
        course_id: courseId,
        topic_id: doc.topic_id,
        chunk_id: chunk.id,
        content: chunk.content,
        metadata: {
          document_id: doc.id,
          document_title: doc.title,
          page_id: chunk.page_id,
          context_tags: chunk.context_tags || [],
        },
        embedding: chunk.embedding,
        concept_ids: doc.topic_id ? (conceptsByTopic.get(doc.topic_id) || []) : [],
        formula_ids: doc.topic_id ? (formulasByTopic.get(doc.topic_id) || []) : [],
      }));

      // Batch upsert chunks
      const batchSize = 100;
      for (let i = 0; i < ragChunks.length; i += batchSize) {
        const batch = ragChunks.slice(i, i + batchSize);
        
        // Delete existing chunks for this document's pages first (to avoid duplicates)
        const chunkIds = batch.map(c => c.chunk_id);
        await supabase
          .from('rag_chunks')
          .delete()
          .in('chunk_id', chunkIds);

        // Insert new chunks
        const { error: insertError } = await supabase
          .from('rag_chunks')
          .insert(batch);

        if (insertError) {
          logger.error(`[update-rag-cache] Failed to insert batch:`, { error: insertError });
        } else {
          insertedChunks += batch.length;
        }
      }
      
      processedDocs++;
      metadata.set("totalChunks", totalChunks).set("insertedChunks", insertedChunks);
    }

    const stats = {
      documents: documents.length,
      totalChunks,
      insertedChunks,
    };

    metadata
      .set("stage", "completed")
      .set("progress", 100)
      .set("stats", stats);

    logger.info(`[update-rag-cache] Completed for course ${courseId}`, stats);

    return {
      success: true,
      courseId,
      stats,
    };
  }
});

