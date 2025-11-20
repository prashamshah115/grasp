import { task } from "@trigger.dev/sdk/v3";
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

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
  hasImages: boolean;
  hasTables: boolean;
}

/**
 * Trigger.dev v3 Worker: embed-pdf-v2
 *
 * Uses pymupdf4llm (Python) for robust PDF parsing with markdown support
 * Uses bge-base-en-v1.5 (768d) via Jina AI for embeddings
 *
 * Pipeline:
 * 1. Download PDF from signed URL
 * 2. Extract text per page using pymupdf4llm (handles diagrams, tables, layout)
 * 3. Generate 768d embeddings using bge-base-en-v1.5 via Jina AI
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

    console.log(`[embed-pdf-v2] ▶️  Starting job for document ${documentId}`);
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

      // STEP 2: Download PDF to temp file
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`❌ PDF download failed: ${pdfResponse.statusText}`);
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());

      // Save to temp file for pymupdf4llm
      tempPdfPath = path.join(os.tmpdir(), `${documentId}.pdf`);
      await fs.writeFile(tempPdfPath, pdfBuffer);

      const downloadTime = Date.now() - downloadStart;
      console.log(`[embed-pdf-v2] ✅ Downloaded ${pdfBuffer.length} bytes in ${downloadTime}ms`);

      // STEP 3: Parse PDF using pymupdf4llm
      await supabase
        .from('documents')
        .update({ processing_step: 'parsing' })
        .eq('id', documentId);

      console.log(`[embed-pdf-v2] 📄 Parsing PDF with pymupdf4llm...`);
      const parseStart = Date.now();

      // Call Python script to parse PDF
      const pages = await parsePDFWithPyMuPDF(tempPdfPath);

      const parseTime = Date.now() - parseStart;
      console.log(`[embed-pdf-v2] ✅ Parsed ${pages.length} pages in ${parseTime}ms`);

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
            has_diagrams: page.hasImages,
            has_tables: page.hasTables,
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

      // STEP 7: Mark as complete and cleanup
      await supabase
        .from('documents')
        .update({
          status: 'ready',
          processing_step: null,
          processed_at: new Date().toISOString()
        })
        .eq('id', documentId);

      // Clean up temp file
      if (tempPdfPath) {
        await fs.unlink(tempPdfPath).catch(() => {});
      }

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

      // Clean up temp file
      if (tempPdfPath) {
        await fs.unlink(tempPdfPath).catch(() => {});
      }

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
 * Parse PDF using pymupdf4llm (Python library)
 * Returns structured page content with markdown formatting
 */
async function parsePDFWithPyMuPDF(pdfPath: string): Promise<PageContent[]> {
  // Python script that uses pymupdf4llm
  const pythonScript = `
import sys
import json
import pymupdf4llm

pdf_path = sys.argv[1]

# Parse PDF to markdown with per-page output
result = pymupdf4llm.to_markdown(pdf_path, page_chunks=True, write_images=False)

# Extract pages
pages_data = []
for page_info in result.get('pages', []):
    page_num = page_info.get('page_number', 0)
    text = page_info.get('text', '')
    metadata = page_info.get('metadata', {})

    pages_data.append({
        'pageNumber': page_num,
        'text': text,
        'charCount': len(text),
        'hasImages': metadata.get('has_images', False),
        'hasTables': metadata.get('has_tables', False)
    })

print(json.dumps(pages_data))
`;

  // Save Python script to temp file
  const scriptPath = path.join(os.tmpdir(), `parse_${Date.now()}.py`);
  await fs.writeFile(scriptPath, pythonScript);

  try {
    // Execute Python script
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath} ${pdfPath}`);

    if (stderr && !stderr.includes('Warning')) {
      console.warn(`[pymupdf4llm] Python warnings: ${stderr}`);
    }

    const pages: PageContent[] = JSON.parse(stdout);

    // Clean up script
    await fs.unlink(scriptPath).catch(() => {});

    return pages;

  } catch (error) {
    // Clean up script
    await fs.unlink(scriptPath).catch(() => {});

    throw new Error(`❌ pymupdf4llm parsing failed: ${(error as Error).message}`);
  }
}

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
