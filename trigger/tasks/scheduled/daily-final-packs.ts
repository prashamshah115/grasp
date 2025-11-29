import { schedules, logger } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { precomputeFinalPacks } from '../precompute-final-packs';

/**
 * SCHEDULED TASK: Daily Final Packs Refresh
 * 
 * Runs at 3 AM UTC daily to refresh final packs for active courses.
 * Only processes courses that have enrolled users and topics.
 */
export const dailyFinalPacksRefresh = schedules.task({
  id: "daily-final-packs-refresh",
  cron: "0 3 * * *", // Daily at 3 AM UTC
  run: async (payload) => {
    logger.info(`[daily-final-packs] Starting scheduled refresh at ${payload.timestamp}`);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get courses with enrolled users and topics
    const { data: activeCourses, error } = await supabase
      .from('courses')
      .select(`
        id,
        code,
        name,
        user_courses(count),
        topics(count)
      `);

    if (error || !activeCourses) {
      logger.error('[daily-final-packs] Failed to fetch active courses:', { error });
      return { success: false, reason: 'fetch_failed' };
    }

    // Filter to courses with enrolled users AND topics
    const coursesToProcess = activeCourses.filter(
      (c: any) => 
        c.user_courses && c.user_courses.length > 0 &&
        c.topics && c.topics.length > 0
    );

    logger.info(`[daily-final-packs] Found ${coursesToProcess.length} active courses to process`);

    const results = [];
    for (const course of coursesToProcess) {
      try {
        const handle = await precomputeFinalPacks.trigger({ 
          courseId: course.id,
          forceFresh: false // Incremental update
        });
        
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: true,
          runId: handle.id,
        });
        
        logger.info(`[daily-final-packs] Triggered for ${course.code}`, { runId: handle.id });
      } catch (triggerError) {
        logger.error(`[daily-final-packs] Failed to trigger for ${course.code}:`, { error: triggerError });
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: false,
          error: String(triggerError),
        });
      }
    }

    logger.info(`[daily-final-packs] Completed scheduled refresh`, {
      processed: coursesToProcess.length,
      successful: results.filter(r => r.triggered).length,
    });

    return {
      success: true,
      timestamp: payload.timestamp,
      coursesProcessed: coursesToProcess.length,
      results,
    };
  }
});



