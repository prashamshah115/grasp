import {
  generateKnowledgeGraph
} from "./chunk-RB3SD2SP.mjs";
import {
  require_main
} from "./chunk-24BJQYVL.mjs";
import {
  logger,
  schedules_exports
} from "./chunk-F2S4DK4N.mjs";
import {
  __name,
  __toESM,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// tasks/scheduled/daily-knowledge-graph.ts
init_esm();
var import_supabase_js = __toESM(require_main());
var dailyKnowledgeGraphRefresh = schedules_exports.task({
  id: "daily-knowledge-graph-refresh",
  cron: "0 2 * * *",
  // Daily at 2 AM UTC
  run: /* @__PURE__ */ __name(async (payload) => {
    logger.info(`[daily-knowledge-graph] Starting scheduled refresh at ${payload.timestamp}`);
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: activeCourses, error } = await supabase.from("courses").select(`
        id,
        code,
        name,
        user_courses(count),
        documents!inner(id)
      `).eq("documents.status", "ready");
    if (error || !activeCourses) {
      logger.error("[daily-knowledge-graph] Failed to fetch active courses:", { error });
      return { success: false, reason: "fetch_failed" };
    }
    const coursesToProcess = activeCourses.filter(
      (c) => c.user_courses && c.user_courses.length > 0
    );
    logger.info(`[daily-knowledge-graph] Found ${coursesToProcess.length} active courses to process`);
    const results = [];
    for (const course of coursesToProcess) {
      try {
        const handle = await generateKnowledgeGraph.trigger({
          courseId: course.id,
          forceFresh: false
          // Only update, don't force refresh
        });
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: true,
          runId: handle.id
        });
        logger.info(`[daily-knowledge-graph] Triggered for ${course.code}`, { runId: handle.id });
      } catch (triggerError) {
        logger.error(`[daily-knowledge-graph] Failed to trigger for ${course.code}:`, { error: triggerError });
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: false,
          error: String(triggerError)
        });
      }
    }
    logger.info(`[daily-knowledge-graph] Completed scheduled refresh`, {
      processed: coursesToProcess.length,
      successful: results.filter((r) => r.triggered).length
    });
    return {
      success: true,
      timestamp: payload.timestamp,
      coursesProcessed: coursesToProcess.length,
      results
    };
  }, "run")
});

export {
  dailyKnowledgeGraphRefresh
};
//# sourceMappingURL=chunk-LYE3KWRD.mjs.map
