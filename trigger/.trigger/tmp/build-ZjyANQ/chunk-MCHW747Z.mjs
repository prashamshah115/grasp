import {
  precomputeFinalPacks
} from "./chunk-DRBDICID.mjs";
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

// tasks/scheduled/daily-final-packs.ts
init_esm();
var import_supabase_js = __toESM(require_main());
var dailyFinalPacksRefresh = schedules_exports.task({
  id: "daily-final-packs-refresh",
  cron: "0 3 * * *",
  // Daily at 3 AM UTC
  run: /* @__PURE__ */ __name(async (payload) => {
    logger.info(`[daily-final-packs] Starting scheduled refresh at ${payload.timestamp}`);
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: activeCourses, error } = await supabase.from("courses").select(`
        id,
        code,
        name,
        user_courses(count),
        topics(count)
      `);
    if (error || !activeCourses) {
      logger.error("[daily-final-packs] Failed to fetch active courses:", { error });
      return { success: false, reason: "fetch_failed" };
    }
    const coursesToProcess = activeCourses.filter(
      (c) => c.user_courses && c.user_courses.length > 0 && c.topics && c.topics.length > 0
    );
    logger.info(`[daily-final-packs] Found ${coursesToProcess.length} active courses to process`);
    const results = [];
    for (const course of coursesToProcess) {
      try {
        const handle = await precomputeFinalPacks.trigger({
          courseId: course.id,
          forceFresh: false
          // Incremental update
        });
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: true,
          runId: handle.id
        });
        logger.info(`[daily-final-packs] Triggered for ${course.code}`, { runId: handle.id });
      } catch (triggerError) {
        logger.error(`[daily-final-packs] Failed to trigger for ${course.code}:`, { error: triggerError });
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: false,
          error: String(triggerError)
        });
      }
    }
    logger.info(`[daily-final-packs] Completed scheduled refresh`, {
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
  dailyFinalPacksRefresh
};
//# sourceMappingURL=chunk-MCHW747Z.mjs.map
