import { task, logger, metadata, AbortTaskRunError } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { fetchCourseWebResults, type CategorizedWebResult } from "../lib/websearch";
import { generateEmbeddings } from "../utils/embeddings";

interface EmbedWebResultsPayload {
  courseId: string;
  forceFresh?: boolean; // Re-fetch even if cached results exist
  maxResults?: number;  // Maximum results to store (default: 50)
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function getCourseInfo(
  supabase: any,
  courseId: string
): Promise<{ id: string; code: string; name: string }> {
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, code, name")
    .eq("id", courseId)
    .single();

  if (error || !course) {
    throw new Error(`Course not found: ${courseId}`);
  }

  return course as { id: string; code: string; name: string };
}

async function getExistingResults(
  supabase: any,
  courseId: string
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("external_search_results")
    .select("url")
    .eq("course_id", courseId);

  if (error) {
    logger.warn("Failed to fetch existing results", { error });
    return new Set();
  }

  return new Set((data || []).map((r: any) => r.url));
}

async function deleteExpiredResults(
  supabase: any,
  courseId: string
) {
  const { error, count } = await supabase
    .from("external_search_results")
    .delete()
    .eq("course_id", courseId)
    .lt("expires_at", new Date().toISOString());

  if (!error && count && count > 0) {
    logger.info(`Deleted ${count} expired web results for course`);
  }
}

// =====================================================
// MAIN TASK
// =====================================================

export const embedWebResults = task({
  id: "embed-web-results",
  queue: {
    concurrencyLimit: 2, // Limit concurrent web searches
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 120000,
    randomize: true,
  },
  catchError: async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("Course not found")) {
      throw new AbortTaskRunError("Course does not exist");
    }
    if (errorMessage.includes("SUPABASE_URL") || errorMessage.includes("JINA_API_KEY")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    if (errorMessage.includes("TAVILY_API_KEY")) {
      // Don't abort, just skip web search
      logger.warn("TAVILY_API_KEY not configured, web search disabled");
      return undefined;
    }
    
    return undefined; // Allow retry for other errors
  },
  run: async (payload: EmbedWebResultsPayload) => {
    const { courseId, forceFresh = false, maxResults = 50 } = payload;
    
    logger.info(`[embed-web-results] Starting for course ${courseId}`);
    
    metadata
      .set("stage", "initializing")
      .set("courseId", courseId)
      .set("forceFresh", forceFresh)
      .set("progress", 0);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get course info
    metadata.set("stage", "fetching_course");
    const course = await getCourseInfo(supabase, courseId);
    
    logger.info(`Processing web results for ${course.code}: ${course.name}`);
    metadata
      .set("courseCode", course.code)
      .set("courseName", course.name)
      .set("progress", 10);

    // Clean up expired results
    await deleteExpiredResults(supabase, courseId);

    // Check cache if not forcing fresh
    let existingUrls = new Set<string>();
    if (!forceFresh) {
      existingUrls = await getExistingResults(supabase, courseId);
      logger.info(`Found ${existingUrls.size} existing cached results`);
      metadata.set("cachedResults", existingUrls.size);
    }

    // Fetch new web results using Tavily
    metadata.set("stage", "web_search");
    let webResults: CategorizedWebResult[] = [];
    
    try {
      webResults = await fetchCourseWebResults(course.code, course.name);
      logger.info(`Fetched ${webResults.length} web results`);
      metadata.set("fetchedResults", webResults.length);
    } catch (error) {
      logger.warn("Web search failed", { error });
      metadata.set("webSearchFailed", true);
      
      // If no cached results and search failed, return
      if (existingUrls.size === 0) {
        return { 
          success: false, 
          reason: "web_search_failed",
          courseId 
        };
      }
    }
    metadata.set("progress", 30);

    // Filter out already-cached URLs
    const newResults = webResults.filter(r => !existingUrls.has(r.url));
    logger.info(`${newResults.length} new results to embed (${webResults.length - newResults.length} already cached)`);
    metadata.set("newResults", newResults.length);

    if (newResults.length === 0) {
      logger.info("No new results to embed, using cached data");
      metadata.set("stage", "completed_cached").set("progress", 100);
      return {
        success: true,
        courseId,
        newResults: 0,
        cachedResults: existingUrls.size,
      };
    }

    // Limit results to process
    const resultsToProcess = newResults.slice(0, maxResults);
    
    // Generate embeddings for result content
    metadata.set("stage", "generating_embeddings");
    logger.info(`Generating embeddings for ${resultsToProcess.length} results...`);

    // Prepare texts for embedding (use snippet + title for best semantic match)
    const textsToEmbed = resultsToProcess.map(r => {
      const combined = `${r.title}\n\n${r.snippet}`.slice(0, 4000);
      return combined;
    });

    let embeddings: number[][] = [];
    try {
      // Process in batches of 10 for Jina API
      const BATCH_SIZE = 10;
      for (let i = 0; i < textsToEmbed.length; i += BATCH_SIZE) {
        const batch = textsToEmbed.slice(i, i + BATCH_SIZE);
        const batchEmbeddings = await generateEmbeddings(batch);
        embeddings.push(...batchEmbeddings);
        
        const progress = 30 + Math.round((i / textsToEmbed.length) * 40);
        metadata.set("progress", progress);
        metadata.set("embeddedCount", embeddings.length);
        
        // Small delay between batches
        if (i + BATCH_SIZE < textsToEmbed.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      logger.info(`Generated ${embeddings.length} embeddings`);
    } catch (error) {
      logger.error("Failed to generate embeddings", { error });
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    metadata.set("progress", 70);

    // Prepare database rows
    metadata.set("stage", "database_insert");
    const rows = resultsToProcess.map((r, i) => ({
      id: randomUUID(),
      course_id: courseId,
      source_type: r.source,
      title: r.title.slice(0, 500),
      url: r.url,
      snippet: r.snippet?.slice(0, 2000) || null,
      raw_content: r.raw_content?.slice(0, 50000) || null, // Limit raw content
      embedding: embeddings[i] ? `[${embeddings[i].join(',')}]` : null,
      search_query: `${course.code} ${course.name}`,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      created_at: new Date().toISOString(),
    }));

    // Insert new results
    const BATCH_SIZE = 25;
    let insertedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      const { error: insertError } = await supabase
        .from("external_search_results")
        .upsert(batch, {
          onConflict: "course_id,url",
          ignoreDuplicates: false, // Update existing
        });

      if (insertError) {
        logger.warn(`Failed to insert batch ${Math.floor(i/BATCH_SIZE) + 1}`, { 
          error: insertError,
          firstUrl: batch[0]?.url 
        });
        failedCount += batch.length;
      } else {
        insertedCount += batch.length;
      }
      
      const progress = 70 + Math.round(((i + batch.length) / rows.length) * 25);
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
        ucsd: resultsToProcess.filter(r => r.source === "ucsd").length,
        quizlet: resultsToProcess.filter(r => r.source === "quizlet").length,
        github: resultsToProcess.filter(r => r.source === "github").length,
        exam: resultsToProcess.filter(r => r.source === "exam").length,
        reddit: resultsToProcess.filter(r => r.source === "reddit").length,
        other: resultsToProcess.filter(r => r.source === "other").length,
      },
    };

    metadata
      .set("stage", "completed")
      .set("progress", 100)
      .set("stats", stats);

    logger.info(`[embed-web-results] Completed for ${course.code}`, stats);

    return {
      success: true,
      courseId,
      stats,
    };
  },
});

