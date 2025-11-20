import { task } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

interface EmbedPDFPayload {
  documentId: string;
  pdfUrl: string;
  courseId: string;
  topicId: string | null;
  userId: string;
}

interface PageContent {
  pageNumber: number;
  text: string;
  charCount: number;
}

/**
 * Trigger.dev v3 Worker: embed-pdf-v2
 *
 * Uses PDF.js for robust PDF parsing
 * Uses bge-base-en-v1.5 (768d) via Jina AI for embeddings
 *
 * Pipeline:
 * 1. Download PDF from signed URL
 * 2. Extract text per page using PDF.js
 * 3. Generate 768d embeddings using bge-base-en-v1.5
 * 4. Chunk text and create chunk embeddings
 * 5. Store in Supabase (document_pages, page_embeddings_v2, page_chunks)
 */
export const embedPDFv2 = task({
  id: "embed-pdf-v2",
  queue: {
    concurrencyLimit: 3 // Process 3 PDFs at once max
  },
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 10_000, // 10 seconds
    maxTimeoutInMs: 600_000, // 10 minutes
    randomize: true
  },
  run: async (payload: EmbedPDFPayload, { ctx }) => {
    const { documentId, pdfUrl, courseId, topicId, userId } = payload;

    console.log(`[embed-pdf-v2] ▶️ Starting job for document ${documentId}`);
    const startTime = Date.now();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // HEALTH CHECK: Verify Supabase connection
      const { error: healthError } = await supabase.from('documents').select('id').limit(1);
      if (healthError) {
        throw new Error(`❌ Health check failed: ${healthError.message}`);
      }
      console.log(`[embed-pdf-v2] ✅ Health check passed`);

      // STEP 1: Update document status
      await supabase
        .from('documents')
        .update({
          status: 'processing',
          processing_step: 'downloading'
        })
        .eq('id', documentId);

      console.log(`[embed-pdf-v2] ⬇️  Downloading PDF...`);
      const downloadStart = Date.now();

      // STEP 2: Download PDF
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`❌ PDF download failed: ${pdfResponse.statusText}`);
      }

      const pdfArrayBuffer = await pdfResponse.arrayBuffer();
      const pdfBuffer = new Uint8Array(pdfArrayBuffer);

      const downloadTime = Date.now() - downloadStart;
      console.log(`[embed-pdf-v2] ✅ Downloaded ${pdfBuffer.length} bytes in ${downloadTime}ms`);

      // STEP 3: Parse PDF using PDF.js
      await supabase
        .from('documents')
        .update({ processing_step: 'parsing' })
        .eq('id', documentId);

      console.log(`[embed-pdf-v2] 📄 Parsing PDF with PDF.js...`);
      const parseStart = Date.now();

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: pdfBuffer,
        useSystemFonts: true,
        standardFontDataUrl: undefined
      });

      const pdfDocument = await loadingTask.promise;
      const totalPages = pdfDocument.numPages;

      console.log(`[embed-pdf-v2] 📊 PDF has ${totalPages} pages`);

      // Extract text from each page
      const pages: PageContent[] = [];
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine text items into single string
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');

        pages.push({
          pageNumber: pageNum,
          text: pageText,
          charCount: pageText.length
        });

        if (pageNum % 10 === 0) {
          console.log(`[embed-pdf-v2] 📝 Extracted text from ${pageNum}/${totalPages} pages`);
        }
      }

      const parseTime = Date.now() - parseStart;
      console.log(`[embed-pdf-v2] ✅ Parsed ${totalPages} pages in ${parseTime}ms`);

      // STEP 4: Insert document_pages
      await supabase
        .from('documents')
        .update({
          total_pages: pages.length,
          processing_step: 'storing_pages'
        })
        .eq('id', documentId);

      console.log(`[embed-pdf-v2] 💾 Storing ${pages.length} pages in database...`);
      const storeStart = Date.now();

      for (const page of pages) {
        await supabase
          .from('document_pages')
          .insert({
            document_id: documentId,
            page_number: page.pageNumber,
            text_content: page.text,
            token_count: Math.ceil(page.charCount / 4), // Rough token estimate
            has_diagrams: false, // TODO: detect diagrams
            has_tables: false, // TODO: detect tables
            importance_score: 0.5 // Default importance
          });
      }

      const storeTime = Date.now() - storeStart;
      console.log(`[embed-pdf-v2] ✅ Stored ${pages.length} pages in ${storeTime}ms`);

      // STEP 5: Generate embeddings using bge-base-en-v1.5 (768d)
      await supabase
        .from('documents')
        .update({ processing_step: 'generating_embeddings' })
        .eq('id', documentId);

      console.log(`[embed-pdf-v2] 🧠 Generating 768d embeddings with bge-base-en-v1.5...`);
      const embedStart = Date.now();

      const batchSize = 100; // Jina AI supports batch processing
      const batches = [];
      for (let i = 0; i < pages.length; i += batchSize) {
        batches.push(pages.slice(i, i + batchSize));
      }

      let totalEmbeddings = 0;

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`[embed-pdf-v2] 📊 Embedding batch ${batchIdx + 1}/${batches.length} (${batch.length} pages)`);

        // Call Jina AI for embeddings
        const embeddings = await generateEmbeddings(
          batch.map(p => p.text.substring(0, 8000)) // Limit to 8k chars
        );

        // Insert page_embeddings_v2
        for (let i = 0; i < embeddings.length; i++) {
          const page = batch[i];
          const embedding = embeddings[i];

          // Get page_id from document_pages
          const { data: pageRecord } = await supabase
            .from('document_pages')
            .select('id')
            .eq('document_id', documentId)
            .eq('page_number', page.pageNumber)
            .single();

          if (pageRecord) {
            await supabase
              .from('page_embeddings_v2')
              .insert({
                page_id: pageRecord.id,
                embedding: embedding,
                model_name: 'bge-base-en-v1.5'
              });

            totalEmbeddings++;
          }
        }

        console.log(`[embed-pdf-v2] ✅ Batch ${batchIdx + 1} complete (${totalEmbeddings}/${pages.length} embeddings)`);
      }

      const embedTime = Date.now() - embedStart;
      console.log(`[embed-pdf-v2] ✅ Generated ${totalEmbeddings} embeddings in ${embedTime}ms`);

      // STEP 6: Generate chunks and chunk embeddings
      await supabase
        .from('documents')
        .update({ processing_step: 'chunking' })
        .eq('id', documentId);

      console.log(`[embed-pdf-v2] ✂️  Chunking text for fine-grained retrieval...`);
      const chunkStart = Date.now();

      let totalChunks = 0;

      for (const page of pages) {
        const chunks = chunkText(page.text, 500); // 500 char chunks with overlap

        // Get page_id
        const { data: pageRecord } = await supabase
          .from('document_pages')
          .select('id')
          .eq('document_id', documentId)
          .eq('page_number', page.pageNumber)
          .single();

        if (!pageRecord) continue;

        // Generate embeddings for chunks
        const chunkEmbeddings = await generateEmbeddings(chunks);

        for (let i = 0; i < chunks.length; i++) {
          await supabase
            .from('page_chunks')
            .insert({
              page_id: pageRecord.id,
              content: chunks[i],
              embedding: chunkEmbeddings[i],
              context_tags: [], // TODO: extract tags
              chunk_index: i
            });

          totalChunks++;
        }
      }

      const chunkTime = Date.now() - chunkStart;
      console.log(`[embed-pdf-v2] ✅ Created ${totalChunks} chunks in ${chunkTime}ms`);

      // STEP 7: Mark as complete
      await supabase
        .from('documents')
        .update({
          status: 'ready',
          processing_step: null,
          processed_at: new Date().toISOString()
        })
        .eq('id', documentId);

      const totalTime = Date.now() - startTime;
      console.log(`[embed-pdf-v2] 🎉 Document ${documentId} processed successfully in ${totalTime}ms`);
      console.log(`[embed-pdf-v2] 📊 Stats: ${pages.length} pages, ${totalEmbeddings} embeddings, ${totalChunks} chunks`);

      return {
        success: true,
        documentId,
        stats: {
          pagesProcessed: pages.length,
          embeddingsGenerated: totalEmbeddings,
          chunksCreated: totalChunks,
          totalTimeMs: totalTime,
          downloadTimeMs: downloadTime,
          parseTimeMs: parseTime,
          storeTimeMs: storeTime,
          embedTimeMs: embedTime,
          chunkTimeMs: chunkTime
        }
      };

    } catch (error) {
      console.error(`[embed-pdf-v2] ❌ Error processing document ${documentId}:`, error);

      // Update document with error
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: (error as Error).message
        })
        .eq('id', documentId);

      throw error; // Trigger.dev will retry based on retry config
    }
  }
});

/**
 * Generate embeddings using Jina AI (bge-base-en-v1.5)
 * Returns 768-dimensional vectors
 */
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const startTime = Date.now();

  const response = await fetch('https://api.jina.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.JINA_API_KEY}`
    },
    body: JSON.stringify({
      model: 'jina-embeddings-v2-base-en', // bge-base-en-v1.5 equivalent, 768 dimensions
      input: texts
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`❌ Jina AI API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const embeddings = data.data.map((item: any) => item.embedding);

  const elapsed = Date.now() - startTime;
  console.log(`[generateEmbeddings] ✅ Generated ${embeddings.length} embeddings in ${elapsed}ms`);

  return embeddings;
}

/**
 * Chunk text with overlap for fine-grained retrieval
 */
function chunkText(text: string, chunkSize: number = 500, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
  }

  return chunks;
}
