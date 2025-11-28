import {
  generateEmbeddings
} from "./chunk-FCGPIFIK.mjs";
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

// tasks/generate-embeddings.ts
init_esm();
var import_supabase_js = __toESM(require_main());

// utils/chunking.ts
init_esm();
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

// tasks/generate-embeddings.ts
var generateEmbeddings2 = task({
  id: "generate-embeddings",
  // ✅ No machine preset needed - Jina API works on default machines
  queue: {
    concurrencyLimit: 5
  },
  retry: {
    maxAttempts: 5,
    factor: 2,
    minTimeoutInMs: 5e3,
    maxTimeoutInMs: 6e5,
    randomize: true
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { documentId, pageIds, userId } = payload;
    console.log(`[generate-embeddings] ▶️  Starting job for document ${documentId} (${pageIds.length} pages)`);
    const startTime = Date.now();
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    try {
      await supabase.from("documents").update({ processing_step: "generating_embeddings" }).eq("id", documentId);
      console.log(`[generate-embeddings] 🧠 Generating 768d embeddings with Jina API (jina-embeddings-v2-base-en)...`);
      const embedStart = Date.now();
      const chunkStart = Date.now();
      let totalEmbeddings = 0;
      let totalChunks = 0;
      for (const pageId of pageIds) {
        const { data: page, error: pageError } = await supabase.from("document_pages").select("id, page_number, text_content, document_id").eq("id", pageId).single();
        if (pageError || !page) {
          console.warn(`[generate-embeddings] ⚠️  Skipping page ${pageId}: ${pageError?.message || "not found"}`);
          continue;
        }
        console.log(`[generate-embeddings] 📄 Processing page ${page.page_number} (${page.text_content.length} chars)`);
        const { data: existingPageEmbedding } = await supabase.from("page_embeddings_v2").select("id").eq("document_id", page.document_id).eq("page_number", page.page_number).single();
        if (!existingPageEmbedding) {
          const pageText = page.text_content.substring(0, 8e3);
          const [pageEmbedding] = await generateEmbeddings([pageText]);
          const { error: embedError } = await supabase.from("page_embeddings_v2").insert({
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
        const chunks = chunkText(page.text_content, 500, 100);
        if (chunks.length > 0) {
          console.log(`[generate-embeddings] ✂️  Page ${page.page_number}: ${chunks.length} chunks`);
          for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
            const chunk = chunks[chunkIndex];
            const { data: existingChunk } = await supabase.from("document_chunks").select("id").eq("page_id", page.id).eq("chunk_index", chunkIndex).single();
            if (!existingChunk) {
              const [chunkEmbedding] = await generateEmbeddings([chunk]);
              const { error: chunkError } = await supabase.from("document_chunks").insert({
                page_id: page.id,
                content: chunk,
                embedding: chunkEmbedding,
                context_tags: [],
                chunk_index: chunkIndex
              });
              if (chunkError) {
                if (chunkError.message.includes("chunk_metadata")) {
                  console.warn(`[generate-embeddings] ⚠️  Chunk ${chunkIndex} insert failed (chunk_metadata view issue), skipping: ${chunkError.message}`);
                  continue;
                }
                throw new Error(`❌ Failed to insert chunk: ${chunkError.message}`);
              }
              totalChunks++;
            } else {
              console.log(`[generate-embeddings] ⚠️  Chunk ${chunkIndex} already exists, skipping`);
            }
          }
          console.log(`[generate-embeddings] ✅ Page ${page.page_number}: ${chunks.length} chunks inserted`);
        }
      }
      const embedTime = Date.now() - embedStart;
      const chunkTime = Date.now() - chunkStart;
      console.log(`[generate-embeddings] ✅ Generated ${totalEmbeddings} page embeddings in ${embedTime}ms`);
      console.log(`[generate-embeddings] ✅ Created ${totalChunks} chunks in ${chunkTime}ms`);
      await supabase.from("documents").update({ processing_step: "embedded" }).eq("id", documentId);
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
      };
    } catch (error) {
      console.error(`[generate-embeddings] ❌ Error processing embeddings for document ${documentId}:`, error);
      try {
        await supabase.from("documents").update({
          status: "error",
          error_message: error.message
        }).eq("id", documentId);
      } catch (updateError) {
        console.error("[generate-embeddings] Failed to update error status:", updateError);
      }
      throw error;
    }
  }, "run")
});

export {
  generateEmbeddings2 as generateEmbeddings
};
//# sourceMappingURL=chunk-OYNO4F5K.mjs.map
