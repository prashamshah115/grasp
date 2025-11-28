import {
  updateRagCache
} from "./chunk-PA65Y743.mjs";
import {
  generateKnowledgeGraph
} from "./chunk-WNGZTBUO.mjs";
import {
  precomputeKnowledgeObjects
} from "./chunk-URXUTRCS.mjs";
import {
  precomputeFinalPacks
} from "./chunk-4W3EVQBH.mjs";
import {
  embedWebResults
} from "./chunk-2D7P6V22.mjs";
import {
  extractQuestions
} from "./chunk-LPW5APIG.mjs";
import {
  require_main
} from "./chunk-24BJQYVL.mjs";
import {
  logger,
  metadata,
  task
} from "./chunk-F2S4DK4N.mjs";
import {
  __name,
  __toESM,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// tasks/finalize-document.ts
init_esm();
var import_supabase_js = __toESM(require_main());
var finalizeDocument = task({
  id: "finalize-document",
  queue: {
    concurrencyLimit: 10
    // Lightweight operation
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1e3,
    // 1 second
    maxTimeoutInMs: 3e4,
    // 30 seconds
    randomize: true
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { documentId, pageCount, embeddingCount, chunkCount, userId } = payload;
    console.log(`[finalize-document] ▶️  Finalizing document ${documentId}`);
    const startTime = Date.now();
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    try {
      const updateData = {
        status: "ready",
        processing_step: null,
        processed_at: (/* @__PURE__ */ new Date()).toISOString(),
        total_pages: pageCount
      };
      updateData.embedding_count = embeddingCount;
      updateData.chunk_count = chunkCount;
      const { error: updateError } = await supabase.from("documents").update(updateData).eq("id", documentId);
      if (updateError) {
        if (updateError.message.includes("embedding_count") || updateError.message.includes("chunk_count")) {
          const { error: retryError } = await supabase.from("documents").update({
            status: "ready",
            processing_step: null,
            processed_at: (/* @__PURE__ */ new Date()).toISOString(),
            total_pages: pageCount
          }).eq("id", documentId);
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
      const { data: document } = await supabase.from("documents").select("course_id").eq("id", documentId).single();
      const courseId = document?.course_id;
      let downstreamTriggered = false;
      if (courseId) {
        logger.info(`[finalize-document] 🔄 Triggering downstream knowledge pipeline for course ${courseId}`);
        metadata.set("stage", "downstream_tasks").set("courseId", courseId);
        const idempotencyBase = `${documentId}-${Date.now().toString(36)}`;
        const { data: docDetails } = await supabase.from("documents").select("doc_type").eq("id", documentId).single();
        const docType = docDetails?.doc_type || "notes";
        const isExamOrHomework = ["exam", "homework", "quiz", "solution"].includes(docType);
        metadata.set("docType", docType).set("isExamOrHomework", isExamOrHomework);
        try {
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
          metadata.set("stage", "dependent_tasks");
          logger.info(`[finalize-document] 🔄 Step 2: Triggering dependent tasks in parallel...`);
          const parallelTasks = [
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
            )
          ];
          if (isExamOrHomework) {
            logger.info(`[finalize-document] 📝 Document is ${docType}, will extract questions`);
            parallelTasks.push(
              extractQuestions.trigger(
                {
                  documentId,
                  courseId,
                  autoPromote: true,
                  // Auto-promote high-confidence questions
                  confidenceThreshold: 0.85
                },
                { idempotencyKey: `eq-${idempotencyBase}`, idempotencyKeyTTL: "24h" }
              )
            );
          }
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
        }
      } else {
        logger.warn(`[finalize-document] ⚠️ No courseId found, skipping downstream tasks`);
      }
      return {
        success: true,
        documentId,
        finalizedAt: (/* @__PURE__ */ new Date()).toISOString(),
        downstreamTriggered
      };
    } catch (error) {
      console.error(`[finalize-document] ❌ Error finalizing document ${documentId}:`, error);
      try {
        await supabase.from("documents").update({
          status: "error",
          // Valid status per database constraint
          error_message: error.message
        }).eq("id", documentId);
      } catch {
      }
      throw error;
    }
  }, "run")
});

export {
  finalizeDocument
};
//# sourceMappingURL=chunk-JLA4THMB.mjs.map
