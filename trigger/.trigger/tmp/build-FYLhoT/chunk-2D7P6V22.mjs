import {
  generateEmbeddings
} from "./chunk-FCGPIFIK.mjs";
import {
  fetchCourseWebResults
} from "./chunk-BRTLRSKF.mjs";
import {
  require_main
} from "./chunk-24BJQYVL.mjs";
import {
  AbortTaskRunError,
  logger,
  metadata,
  task
} from "./chunk-F2S4DK4N.mjs";
import {
  __name,
  __toESM,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// tasks/embed-web-results.ts
init_esm();
var import_supabase_js = __toESM(require_main());
import { randomUUID } from "crypto";
async function getCourseInfo(supabase, courseId) {
  const { data: course, error } = await supabase.from("courses").select("id, code, name").eq("id", courseId).single();
  if (error || !course) {
    throw new Error(`Course not found: ${courseId}`);
  }
  return course;
}
__name(getCourseInfo, "getCourseInfo");
async function getExistingResults(supabase, courseId) {
  const { data, error } = await supabase.from("external_search_results").select("url").eq("course_id", courseId);
  if (error) {
    logger.warn("Failed to fetch existing results", { error });
    return /* @__PURE__ */ new Set();
  }
  return new Set((data || []).map((r) => r.url));
}
__name(getExistingResults, "getExistingResults");
async function deleteExpiredResults(supabase, courseId) {
  const { error, count } = await supabase.from("external_search_results").delete().eq("course_id", courseId).lt("expires_at", (/* @__PURE__ */ new Date()).toISOString());
  if (!error && count && count > 0) {
    logger.info(`Deleted ${count} expired web results for course`);
  }
}
__name(deleteExpiredResults, "deleteExpiredResults");
var embedWebResults = task({
  id: "embed-web-results",
  queue: {
    concurrencyLimit: 2
    // Limit concurrent web searches
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5e3,
    maxTimeoutInMs: 12e4,
    randomize: true
  },
  catchError: /* @__PURE__ */ __name(async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Course not found")) {
      throw new AbortTaskRunError("Course does not exist");
    }
    if (errorMessage.includes("SUPABASE_URL") || errorMessage.includes("JINA_API_KEY")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    if (errorMessage.includes("TAVILY_API_KEY")) {
      logger.warn("TAVILY_API_KEY not configured, web search disabled");
      return void 0;
    }
    return void 0;
  }, "catchError"),
  run: /* @__PURE__ */ __name(async (payload) => {
    const { courseId, forceFresh = false, maxResults = 50 } = payload;
    logger.info(`[embed-web-results] Starting for course ${courseId}`);
    metadata.set("stage", "initializing").set("courseId", courseId).set("forceFresh", forceFresh).set("progress", 0);
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    metadata.set("stage", "fetching_course");
    const course = await getCourseInfo(supabase, courseId);
    logger.info(`Processing web results for ${course.code}: ${course.name}`);
    metadata.set("courseCode", course.code).set("courseName", course.name).set("progress", 10);
    await deleteExpiredResults(supabase, courseId);
    let existingUrls = /* @__PURE__ */ new Set();
    if (!forceFresh) {
      existingUrls = await getExistingResults(supabase, courseId);
      logger.info(`Found ${existingUrls.size} existing cached results`);
      metadata.set("cachedResults", existingUrls.size);
    }
    metadata.set("stage", "web_search");
    let webResults = [];
    try {
      webResults = await fetchCourseWebResults(course.code, course.name);
      logger.info(`Fetched ${webResults.length} web results`);
      metadata.set("fetchedResults", webResults.length);
    } catch (error) {
      logger.warn("Web search failed", { error });
      metadata.set("webSearchFailed", true);
      if (existingUrls.size === 0) {
        return {
          success: false,
          reason: "web_search_failed",
          courseId
        };
      }
    }
    metadata.set("progress", 30);
    const newResults = webResults.filter((r) => !existingUrls.has(r.url));
    logger.info(`${newResults.length} new results to embed (${webResults.length - newResults.length} already cached)`);
    metadata.set("newResults", newResults.length);
    if (newResults.length === 0) {
      logger.info("No new results to embed, using cached data");
      metadata.set("stage", "completed_cached").set("progress", 100);
      return {
        success: true,
        courseId,
        newResults: 0,
        cachedResults: existingUrls.size
      };
    }
    const resultsToProcess = newResults.slice(0, maxResults);
    metadata.set("stage", "generating_embeddings");
    logger.info(`Generating embeddings for ${resultsToProcess.length} results...`);
    const textsToEmbed = resultsToProcess.map((r) => {
      const combined = `${r.title}

${r.snippet}`.slice(0, 4e3);
      return combined;
    });
    let embeddings = [];
    try {
      const BATCH_SIZE2 = 10;
      for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE2) {
        const batch = textsToEmbed.slice(i, i + BATCH_SIZE2);
        const batchEmbeddings = await generateEmbeddings(batch);
        embeddings.push(...batchEmbeddings);
        const progress = 30 + Math.round(i / textsToEmbed.length * 40);
        metadata.set("progress", progress);
        metadata.set("embeddedCount", embeddings.length);
        if (i + BATCH_SIZE2 < textsToEmbed.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      logger.info(`Generated ${embeddings.length} embeddings`);
    } catch (error) {
      logger.error("Failed to generate embeddings", { error });
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    metadata.set("progress", 70);
    metadata.set("stage", "database_insert");
    const rows = resultsToProcess.map((r, i) => ({
      id: randomUUID(),
      course_id: courseId,
      source_type: r.source,
      title: r.title.slice(0, 500),
      url: r.url,
      snippet: r.snippet?.slice(0, 2e3) || null,
      raw_content: r.raw_content?.slice(0, 5e4) || null,
      // Limit raw content
      embedding: embeddings[i] ? `[${embeddings[i].join(",")}]` : null,
      search_query: `${course.code} ${course.name}`,
      fetched_at: (/* @__PURE__ */ new Date()).toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
      // 30 days
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    }));
    const BATCH_SIZE = 25;
    let insertedCount = 0;
    let failedCount = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase.from("external_search_results").upsert(batch, {
        onConflict: "course_id,url",
        ignoreDuplicates: false
        // Update existing
      });
      if (insertError) {
        logger.warn(`Failed to insert batch ${Math.floor(i / BATCH_SIZE) + 1}`, {
          error: insertError,
          firstUrl: batch[0]?.url
        });
        failedCount += batch.length;
      } else {
        insertedCount += batch.length;
      }
      const progress = 70 + Math.round((i + batch.length) / rows.length * 25);
      metadata.set("progress", progress);
    }
    logger.info(`✅ Inserted ${insertedCount} web results (${failedCount} failed)`);
    const stats = {
      total_fetched: webResults.length,
      new_results: newResults.length,
      embedded: embeddings.length,
      inserted: insertedCount,
      failed: failedCount,
      cached: existingUrls.size,
      by_source: {
        ucsd: resultsToProcess.filter((r) => r.source === "ucsd").length,
        quizlet: resultsToProcess.filter((r) => r.source === "quizlet").length,
        github: resultsToProcess.filter((r) => r.source === "github").length,
        exam: resultsToProcess.filter((r) => r.source === "exam").length,
        reddit: resultsToProcess.filter((r) => r.source === "reddit").length,
        other: resultsToProcess.filter((r) => r.source === "other").length
      }
    };
    metadata.set("stage", "completed").set("progress", 100).set("stats", stats);
    logger.info(`[embed-web-results] Completed for ${course.code}`, stats);
    return {
      success: true,
      courseId,
      stats
    };
  }, "run")
});

export {
  embedWebResults
};
//# sourceMappingURL=chunk-2D7P6V22.mjs.map
