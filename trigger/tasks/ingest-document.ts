import { task } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { parsePDFWithPyMuPDF, type PageContent } from '../utils/pdf-parser';
import { generateEmbeddings } from './generate-embeddings';
import { finalizeDocument } from './finalize-document';

interface IngestDocumentPayload {
  documentId: string;
  pdfUrl: string; // Signed URL from Supabase Storage
  courseId: string;
  topicId: string | null;
  userId: string;
}

interface IngestDocumentResult {
  success: true;
  documentId: string;
  pageIds: string[];
  pageCount: number;
  stats: {
    downloadTimeMs: number;
    parseTimeMs: number;
    storeTimeMs: number;
  };
}

/**
 * TASK 1: ingest_document
 * 
 * Downloads PDF, parses with PyMuPDF4LLM, stores pages in database.
 * Then triggers Task 2 (generate_embeddings) and Task 3 (finalize_document).
 */
export const ingestDocument = task({
  id: "ingest-document",
  queue: {
    concurrencyLimit: 2 // PDF parsing is CPU-heavy
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 10_000, // 10 seconds
    maxTimeoutInMs: 300_000, // 5 minutes
    randomize: true
  },
  run: async (payload: IngestDocumentPayload) => {
    const { documentId, pdfUrl, courseId, topicId, userId } = payload;

    console.log(`[ingest-document] ▶️  Starting job for document ${documentId}`);
    const startTime = Date.now();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let tempPdfPath: string | null = null;

    try {
      // HEALTH CHECK: Verify Supabase connection
      const { error: healthError } = await supabase.from('documents').select('id').limit(1);
      if (healthError) {
        throw new Error(`❌ Health check failed: ${healthError.message}`);
      }
      console.log(`[ingest-document] ✅ Health check passed`);

      // STEP 1: Update document status
      await supabase
        .from('documents')
        .update({
          status: 'processing',
          processing_step: 'downloading'
        })
        .eq('id', documentId);

      console.log(`[ingest-document] ⬇️  Downloading PDF...`);
      const downloadStart = Date.now();

      // STEP 2: Download PDF to temp file
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`❌ PDF download failed: ${pdfResponse.statusText}`);
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      tempPdfPath = path.join(os.tmpdir(), `${documentId}.pdf`);
      await fs.writeFile(tempPdfPath, pdfBuffer);

      const downloadTime = Date.now() - downloadStart;
      console.log(`[ingest-document] ✅ Downloaded ${pdfBuffer.length} bytes in ${downloadTime}ms`);

      // STEP 3: Parse PDF using pymupdf4llm
      await supabase
        .from('documents')
        .update({ processing_step: 'parsing' })
        .eq('id', documentId);

      console.log(`[ingest-document] 📄 Parsing PDF with pymupdf4llm...`);
      const parseStart = Date.now();

      const pages = await parsePDFWithPyMuPDF(tempPdfPath);

      const parseTime = Date.now() - parseStart;
      console.log(`[ingest-document] ✅ Parsed ${pages.length} pages in ${parseTime}ms`);

      // STEP 4: Insert document_pages
      await supabase
        .from('documents')
        .update({
          total_pages: pages.length,
          processing_step: 'storing_pages'
        })
        .eq('id', documentId);

      console.log(`[ingest-document] 💾 Storing ${pages.length} pages in database...`);
      const storeStart = Date.now();

      // ✅ Check if pages already exist (idempotent - handles retries and re-processing)
      const { data: existingPages, error: checkError } = await supabase
        .from('document_pages')
        .select('id, page_number')
        .eq('document_id', documentId);

      let pageIds: string[] = [];

      if (existingPages && existingPages.length > 0) {
        // Pages already exist - use existing IDs
        console.log(`[ingest-document] ⚠️  Pages already exist (${existingPages.length} pages), skipping insertion`);
        pageIds = existingPages.map(p => p.id);
      } else {
        // Pages don't exist - insert them
        const pageInserts = pages.map(page => ({
          document_id: documentId,
          page_number: page.pageNumber,
          text_content: page.text,
          token_count: Math.ceil(page.charCount / 4), // Rough token estimate
          has_diagrams: page.hasImages,
          has_tables: page.hasTables,
          importance_score: 0.5 // Default importance
        }));

        const { data: insertedPages, error: insertError } = await supabase
          .from('document_pages')
          .insert(pageInserts)
          .select('id');

        if (insertError) {
          throw new Error(`❌ Failed to insert pages: ${insertError.message}`);
        }

        pageIds = insertedPages?.map(p => p.id) || [];
      }

      const storeTime = Date.now() - storeStart;
      console.log(`[ingest-document] ✅ Stored ${pageIds.length} pages in ${storeTime}ms`);

      // Clean up temp PDF file
      if (tempPdfPath) {
        await fs.unlink(tempPdfPath).catch(() => {});
      }

      // Update processing step (keep status as 'processing' since constraint only allows: processing, ready, error)
      await supabase
        .from('documents')
        .update({
          processing_step: 'parsed'
          // Status stays 'processing' - will be updated to 'ready' by finalize-document
        })
        .eq('id', documentId);

      // STEP 5: Trigger Task 2 (generate embeddings) and wait
      console.log(`[ingest-document] 🚀 Triggering generate-embeddings task...`);
      const task2Result = await generateEmbeddings.triggerAndWait({
        documentId,
        pageIds,
        userId
      });

      if (!task2Result.ok) {
        throw new Error(`❌ Task 2 (generate-embeddings) failed: ${task2Result.error}`);
      }

      // STEP 6: Trigger Task 3 (finalize document) and wait
      console.log(`[ingest-document] 🚀 Triggering finalize-document task...`);
      const task3Result = await finalizeDocument.triggerAndWait({
        documentId,
        pageCount: pages.length,
        embeddingCount: task2Result.output.embeddingCount,
        chunkCount: task2Result.output.chunkCount,
        userId
      });

      if (!task3Result.ok) {
        throw new Error(`❌ Task 3 (finalize-document) failed: ${task3Result.error}`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`[ingest-document] 🎉 Document ${documentId} processed successfully in ${totalTime}ms`);

      return {
        success: true,
        documentId,
        pageIds,
        pageCount: pages.length,
        stats: {
          downloadTimeMs: downloadTime,
          parseTimeMs: parseTime,
          storeTimeMs: storeTime
        }
      } as IngestDocumentResult;

    } catch (error) {
      console.error(`[ingest-document] ❌ Error processing document ${documentId}:`, error);

      // Clean up temp file
      if (tempPdfPath) {
        await fs.unlink(tempPdfPath).catch(() => {});
      }

      // Update document with error
      try {
        await supabase
          .from('documents')
          .update({
            status: 'error', // Valid status per database constraint
            error_message: (error as Error).message
          })
          .eq('id', documentId);
      } catch (updateError) {
        // Ignore errors in error handling
        console.error('[ingest-document] Failed to update error status:', updateError);
      }

      throw error; // Trigger.dev will retry based on retry config
    }
  }
});

