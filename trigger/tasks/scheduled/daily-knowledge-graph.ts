import { schedules, logger } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { generateKnowledgeGraph } from '../generate-knowledge-graph';

/**
 * SCHEDULED TASK: Daily Knowledge Graph Refresh
 * 
 * Runs at 2 AM UTC daily to refresh knowledge graphs for active courses.
 * Only processes courses that have enrolled users and documents.
 */
export const dailyKnowledgeGraphRefresh = schedules.task({
  id: "daily-knowledge-graph-refresh",
  cron: "0 2 * * *", // Daily at 2 AM UTC
  run: async (payload) => {
    logger.info(`[daily-knowledge-graph] Starting scheduled refresh at ${payload.timestamp}`);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get courses with enrolled users and ready documents
    const { data: activeCourses, error } = await supabase
      .from('courses')
      .select(`
        id,
        code,
        name,
        user_courses(count),
        documents!inner(id)
      `)
      .eq('documents.status', 'ready');

    if (error || !activeCourses) {
      logger.error('[daily-knowledge-graph] Failed to fetch active courses:', { error });
      return { success: false, reason: 'fetch_failed' };
    }

    // Filter to courses with at least one enrolled user
    const coursesToProcess = activeCourses.filter(
      (c: any) => c.user_courses && c.user_courses.length > 0
    );

    logger.info(`[daily-knowledge-graph] Found ${coursesToProcess.length} active courses to process`);

    const results = [];
    for (const course of coursesToProcess) {
      try {
        const handle = await generateKnowledgeGraph.trigger({ 
          courseId: course.id,
          forceFresh: false // Only update, don't force refresh
        });
        
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: true,
          runId: handle.id,
        });
        
        logger.info(`[daily-knowledge-graph] Triggered for ${course.code}`, { runId: handle.id });
      } catch (triggerError) {
        logger.error(`[daily-knowledge-graph] Failed to trigger for ${course.code}:`, { error: triggerError });
        results.push({
          courseId: course.id,
          code: course.code,
          triggered: false,
          error: String(triggerError),
        });
      }
    }

    logger.info(`[daily-knowledge-graph] Completed scheduled refresh`, {
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


