import {
  require_main
} from "./chunk-24BJQYVL.mjs";
import {
  task
} from "./chunk-5EIJK32Z.mjs";
import {
  __name,
  __toESM,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// tasks/embed-pdf-v2.ts
init_esm();
var import_supabase_js = __toESM(require_main());
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";
var execAsync = promisify(exec);
var embedPDFv2 = task({
  id: "embed-pdf-v2",
  queue: {
    concurrencyLimit: 3
    // Process 3 PDFs at once max
  },
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 1e4,
    // 10 seconds
    maxTimeoutInMs: 6e5,
    // 10 minutes
    randomize: true
  },
  run: /* @__PURE__ */ __name(async (payload, { ctx }) => {
    const { documentId, pdfUrl, courseId, topicId, userId } = payload;
    console.log(`[embed-pdf-v2] ▶️  Starting job for document ${documentId}`);
    const startTime = Date.now();
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    let tempPdfPath = null;
    try {
      const { error: healthError } = await supabase.from("documents").select("id").limit(1);
      if (healthError) {
        throw new Error(`❌ Health check failed: ${healthError.message}`);
      }
      console.log(`[embed-pdf-v2] ✅ Health check passed`);
      await supabase.from("documents").update({
        status: "processing",
        processing_step: "downloading"
      }).eq("id", documentId);
      console.log(`[embed-pdf-v2] ⬇️  Downloading PDF...`);
      const downloadStart = Date.now();
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`❌ PDF download failed: ${pdfResponse.statusText}`);
      }
      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
      tempPdfPath = path.join(os.tmpdir(), `${documentId}.pdf`);
      await fs.writeFile(tempPdfPath, pdfBuffer);
      const downloadTime = Date.now() - downloadStart;
      console.log(`[embed-pdf-v2] ✅ Downloaded ${pdfBuffer.length} bytes in ${downloadTime}ms`);
      await supabase.from("documents").update({ processing_step: "parsing" }).eq("id", documentId);
      console.log(`[embed-pdf-v2] 📄 Parsing PDF with pymupdf4llm...`);
      const parseStart = Date.now();
      const pages = await parsePDFWithPyMuPDF(tempPdfPath);
      const parseTime = Date.now() - parseStart;
      console.log(`[embed-pdf-v2] ✅ Parsed ${pages.length} pages in ${parseTime}ms`);
      await supabase.from("documents").update({
        total_pages: pages.length,
        processing_step: "storing_pages"
      }).eq("id", documentId);
      console.log(`[embed-pdf-v2] 💾 Storing ${pages.length} pages in database...`);
      const storeStart = Date.now();
      for (const page of pages) {
        await supabase.from("document_pages").insert({
          document_id: documentId,
          page_number: page.pageNumber,
          text_content: page.text,
          token_count: Math.ceil(page.charCount / 4),
          // Rough token estimate
          has_diagrams: page.hasImages,
          has_tables: page.hasTables,
          importance_score: 0.5
          // Default importance
        });
      }
      const storeTime = Date.now() - storeStart;
      console.log(`[embed-pdf-v2] ✅ Stored ${pages.length} pages in ${storeTime}ms`);
      await supabase.from("documents").update({ processing_step: "generating_embeddings" }).eq("id", documentId);
      console.log(`[embed-pdf-v2] 🧠 Generating 768d embeddings with bge-base-en-v1.5...`);
      const embedStart = Date.now();
      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < pages.length; i += batchSize) {
        batches.push(pages.slice(i, i + batchSize));
      }
      let totalEmbeddings = 0;
      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];
        console.log(`[embed-pdf-v2] 📊 Embedding batch ${batchIdx + 1}/${batches.length} (${batch.length} pages)`);
        const embeddings = await generateEmbeddings(
          batch.map((p) => p.text.substring(0, 8e3))
          // Limit to 8k chars
        );
        for (let i = 0; i < embeddings.length; i++) {
          const page = batch[i];
          const embedding = embeddings[i];
          const { data: pageRecord } = await supabase.from("document_pages").select("id").eq("document_id", documentId).eq("page_number", page.pageNumber).single();
          if (pageRecord) {
            await supabase.from("page_embeddings_v2").insert({
              page_id: pageRecord.id,
              embedding,
              model_name: "bge-base-en-v1.5"
            });
            totalEmbeddings++;
          }
        }
        console.log(`[embed-pdf-v2] ✅ Batch ${batchIdx + 1} complete (${totalEmbeddings}/${pages.length} embeddings)`);
      }
      const embedTime = Date.now() - embedStart;
      console.log(`[embed-pdf-v2] ✅ Generated ${totalEmbeddings} embeddings in ${embedTime}ms`);
      await supabase.from("documents").update({ processing_step: "chunking" }).eq("id", documentId);
      console.log(`[embed-pdf-v2] ✂️  Chunking text for fine-grained retrieval...`);
      const chunkStart = Date.now();
      let totalChunks = 0;
      for (const page of pages) {
        const chunks = chunkText(page.text, 500);
        const { data: pageRecord } = await supabase.from("document_pages").select("id").eq("document_id", documentId).eq("page_number", page.pageNumber).single();
        if (!pageRecord) continue;
        const chunkEmbeddings = await generateEmbeddings(chunks);
        for (let i = 0; i < chunks.length; i++) {
          await supabase.from("page_chunks").insert({
            page_id: pageRecord.id,
            content: chunks[i],
            embedding: chunkEmbeddings[i],
            context_tags: [],
            // TODO: extract tags
            chunk_index: i
          });
          totalChunks++;
        }
      }
      const chunkTime = Date.now() - chunkStart;
      console.log(`[embed-pdf-v2] ✅ Created ${totalChunks} chunks in ${chunkTime}ms`);
      await supabase.from("documents").update({
        status: "ready",
        processing_step: null,
        processed_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", documentId);
      if (tempPdfPath) {
        await fs.unlink(tempPdfPath).catch(() => {
        });
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
      if (tempPdfPath) {
        await fs.unlink(tempPdfPath).catch(() => {
        });
      }
      await supabase.from("documents").update({
        status: "error",
        // Valid status per database constraint
        error_message: error.message
      }).eq("id", documentId);
      throw error;
    }
  }, "run")
});
async function parsePDFWithPyMuPDF(pdfPath) {
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
  const scriptPath = path.join(os.tmpdir(), `parse_${Date.now()}.py`);
  await fs.writeFile(scriptPath, pythonScript);
  try {
    const { stdout, stderr } = await execAsync(`python3 ${scriptPath} ${pdfPath}`);
    if (stderr && !stderr.includes("Warning")) {
      console.warn(`[pymupdf4llm] Python warnings: ${stderr}`);
    }
    const pages = JSON.parse(stdout);
    await fs.unlink(scriptPath).catch(() => {
    });
    return pages;
  } catch (error) {
    await fs.unlink(scriptPath).catch(() => {
    });
    throw new Error(`❌ pymupdf4llm parsing failed: ${error.message}`);
  }
}
__name(parsePDFWithPyMuPDF, "parsePDFWithPyMuPDF");
async function generateEmbeddings(texts) {
  const startTime = Date.now();
  const response = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.JINA_API_KEY}`
    },
    body: JSON.stringify({
      model: "jina-embeddings-v2-base-en",
      // bge-base-en-v1.5 equivalent, 768 dimensions
      input: texts
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`❌ Jina AI API error: ${response.statusText} - ${errorText}`);
  }
  const data = await response.json();
  const embeddings = data.data.map((item) => item.embedding);
  const elapsed = Date.now() - startTime;
  console.log(`[generateEmbeddings] ✅ Generated ${embeddings.length} embeddings in ${elapsed}ms`);
  return embeddings;
}
__name(generateEmbeddings, "generateEmbeddings");
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}
__name(chunkText, "chunkText");

export {
  embedPDFv2
};
//# sourceMappingURL=chunk-3Z2P62WS.mjs.map
