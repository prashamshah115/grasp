import { task, logger, metadata } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from '../utils/embeddings';

interface ExtractParagraphsPayload {
  documentId: string;
  pageIds?: string[]; // Optional: specific pages to process
  courseId?: string; // Optional: for logging
}

interface ExtractParagraphsResult {
  success: true;
  documentId: string;
  paragraphsExtracted: number;
}

/**
 * TASK: extract-paragraphs
 * 
 * Simple paragraph extraction from document_pages:
 * - Split text_content by double newlines (paragraph boundaries)
 * - Generate embeddings for each paragraph
 * - Store in document_paragraphs table
 * 
 * No fancy PDF parsing, just text splitting.
 */
export const extractParagraphs = task({
  id: "extract-paragraphs",
  queue: {
    concurrencyLimit: 5
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 120_000,
    randomize: true
  },
  run: async (payload: ExtractParagraphsPayload) => {
    const { documentId, pageIds, courseId } = payload;
    
    logger.info(`[extract-paragraphs] ▶️  Starting paragraph extraction for document ${documentId}`);
    const startTime = Date.now();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // STEP 1: Fetch pages for this document (all or specific ones)
      let query = supabase
        .from('document_pages')
        .select('id, text_content, page_number')
        .eq('document_id', documentId);
      
      if (pageIds && pageIds.length > 0) {
        query = query.in('id', pageIds);
      }
      
      const { data: pages, error: pagesError } = await query.order('page_number', { ascending: true });

      if (pagesError) {
        throw new Error(`Failed to fetch pages: ${pagesError.message}`);
      }

      if (!pages || pages.length === 0) {
        logger.warn(`[extract-paragraphs] No pages found for document ${documentId}`);
        return {
          success: true,
          documentId,
          paragraphsExtracted: 0
        } as ExtractParagraphsResult;
      }

      logger.info(`[extract-paragraphs] Found ${pages.length} pages to process`);

      let totalParagraphs = 0;

      // STEP 2: Process each page
      for (const page of pages) {
        if (!page.text_content || page.text_content.trim().length === 0) {
          continue;
        }

        // Split by double newlines (paragraph boundaries)
        // Also handle single newlines followed by indentation or capital letters
        const paragraphs = page.text_content
          .split(/\n\s*\n/) // Split on double newlines
          .map(p => p.trim())
          .filter(p => p.length > 50); // Filter out very short "paragraphs" (likely headers/footers)

        if (paragraphs.length === 0) {
          continue;
        }

        logger.info(`[extract-paragraphs] Page ${page.page_number}: ${paragraphs.length} paragraphs found`);

        // STEP 3: Generate embeddings for all paragraphs in this page
        const embeddings = await generateEmbeddings(paragraphs);

        if (embeddings.length !== paragraphs.length) {
          throw new Error(`Embedding count mismatch: expected ${paragraphs.length}, got ${embeddings.length}`);
        }

        // STEP 4: Insert paragraphs into database
        const paragraphInserts = paragraphs.map((content, index) => ({
          page_id: page.id,
          document_id: documentId,
          paragraph_index: index,
          content: content,
          embedding: embeddings[index],
          page_number: page.page_number
        }));

        // Insert in batches to avoid overwhelming the database
        const batchSize = 10;
        for (let i = 0; i < paragraphInserts.length; i += batchSize) {
          const batch = paragraphInserts.slice(i, i + batchSize);
          const { error: insertError } = await supabase
            .from('document_paragraphs')
            .insert(batch);

          if (insertError) {
            // If paragraph already exists (idempotent), skip
            if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
              logger.warn(`[extract-paragraphs] Some paragraphs already exist, skipping duplicates`);
              continue;
            }
            throw new Error(`Failed to insert paragraphs: ${insertError.message}`);
          }
        }

        totalParagraphs += paragraphs.length;
        logger.info(`[extract-paragraphs] ✅ Page ${page.page_number}: ${paragraphs.length} paragraphs inserted`);
      }

      const totalTime = Date.now() - startTime;
      logger.info(`[extract-paragraphs] ✅ Document ${documentId}: ${totalParagraphs} paragraphs extracted in ${totalTime}ms`);

      return {
        success: true,
        documentId,
        paragraphsExtracted: totalParagraphs
      } as ExtractParagraphsResult;

    } catch (error) {
      logger.error(`[extract-paragraphs] ❌ Failed to extract paragraphs:`, error);
      throw error;
    }
  }
});

