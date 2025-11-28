import {
  callLLM,
  safeParseJSON
} from "./chunk-SBHDDZ3S.mjs";
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

// tasks/generate-study-plan.ts
init_esm();
var import_supabase_js = __toESM(require_main());
import { randomUUID } from "crypto";
var STUDY_PLAN_SYSTEM_PROMPT = `
You are an expert academic planner creating personalized study plans for university students.

INPUT:
- Course information (code, name, topics)
- Knowledge graph edges (prerequisite relationships)
- User's topic mastery levels
- Time budget and target date

GOAL:
- Create an optimized daily study plan that maximizes learning efficiency.
- Prioritize weak topics while respecting prerequisite dependencies.
- Balance new learning with review and practice.

PLANNING PRINCIPLES:
1. PREREQUISITE ORDERING: If topic A is a prerequisite for B, schedule A before B.
2. SPACED REPETITION: Revisit topics 1, 3, and 7 days after initial learning.
3. INTERLEAVING: Mix related topics rather than studying one topic for too long.
4. REST DAYS: Include light review or complete rest every 5-7 days.
5. FRONT-LOADING: Put harder topics earlier when energy is higher.
6. TIME BOXING: Each task should be 15-45 minutes.

TASK TYPES:
- "read": Review lecture notes, textbook sections
- "practice": Solve problems, work through examples
- "review": Quick recap of previously learned material
- "quiz": Self-test or flashcard session
- "rest": No study, mental recovery

DIFFICULTY ADAPTATION:
- Low mastery (0-40%): More reading and examples
- Medium mastery (40-70%): Mix of practice and review
- High mastery (70-100%): Quick reviews and advanced practice

OUTPUT FORMAT:
- Valid JSON only
- No markdown, comments, or backticks

JSON SCHEMA:
{
  "title": string,
  "overview": string,
  "weak_topics": string[],
  "priority_order": string[],
  "daily_plan": [
    {
      "day": number,
      "date": string,
      "focus_topics": string[],
      "tasks": [
        {
          "type": "read" | "practice" | "review" | "quiz" | "rest",
          "description": string,
          "duration_minutes": number,
          "topic_id": string | null,
          "topic_name": string,
          "priority": 1 | 2 | 3
        }
      ],
      "estimated_minutes": number
    }
  ],
  "tips": string[]
}

CONSTRAINTS:
- Maximum 14 days of planning
- Each day should not exceed the daily time budget
- Include at least one rest day per week
`;
var STUDY_PLAN_FEWSHOT = `
{
  "title": "CSE 120 Finals Prep - 7 Day Plan",
  "overview": "Focused study plan targeting your weakest areas (Deadlock, Virtual Memory) while reinforcing fundamentals. Total estimated time: 6.5 hours over 7 days.",
  "weak_topics": ["deadlock", "virtual_memory", "tlb"],
  "priority_order": ["process_basics", "threads", "synchronization", "deadlock", "memory_management", "virtual_memory", "tlb"],
  "daily_plan": [
    {
      "day": 1,
      "date": "2024-12-01",
      "focus_topics": ["process_basics", "threads"],
      "tasks": [
        {
          "type": "read",
          "description": "Review process lifecycle and PCB structure from lecture notes",
          "duration_minutes": 20,
          "topic_id": "topic_process",
          "topic_name": "Process Basics",
          "priority": 2
        },
        {
          "type": "practice",
          "description": "Complete 3 thread synchronization problems from HW2",
          "duration_minutes": 30,
          "topic_id": "topic_threads",
          "topic_name": "Threads",
          "priority": 1
        },
        {
          "type": "quiz",
          "description": "Self-test: 10 flashcards on process vs thread differences",
          "duration_minutes": 10,
          "topic_id": "topic_threads",
          "topic_name": "Threads",
          "priority": 3
        }
      ],
      "estimated_minutes": 60
    },
    {
      "day": 2,
      "date": "2024-12-02",
      "focus_topics": ["synchronization", "deadlock"],
      "tasks": [
        {
          "type": "read",
          "description": "Deep dive into Coffman conditions and deadlock prevention strategies",
          "duration_minutes": 25,
          "topic_id": "topic_deadlock",
          "topic_name": "Deadlock",
          "priority": 1
        },
        {
          "type": "practice",
          "description": "Work through banker's algorithm example step-by-step",
          "duration_minutes": 35,
          "topic_id": "topic_deadlock",
          "topic_name": "Deadlock",
          "priority": 1
        }
      ],
      "estimated_minutes": 60
    },
    {
      "day": 3,
      "date": "2024-12-03",
      "focus_topics": ["virtual_memory"],
      "tasks": [
        {
          "type": "review",
          "description": "Quick recap of deadlock (spaced repetition day 1)",
          "duration_minutes": 10,
          "topic_id": "topic_deadlock",
          "topic_name": "Deadlock",
          "priority": 2
        },
        {
          "type": "read",
          "description": "Study paging, page tables, and address translation",
          "duration_minutes": 30,
          "topic_id": "topic_virtual_memory",
          "topic_name": "Virtual Memory",
          "priority": 1
        },
        {
          "type": "practice",
          "description": "Calculate EAT for 3 different TLB configurations",
          "duration_minutes": 20,
          "topic_id": "topic_tlb",
          "topic_name": "TLB",
          "priority": 1
        }
      ],
      "estimated_minutes": 60
    }
  ],
  "tips": [
    "Focus on understanding WHY deadlock conditions must ALL be present, not just memorizing them",
    "Practice address translation by hand - it's almost always on the final",
    "Draw diagrams for page tables and TLB lookups to visualize the process",
    "Review your HW feedback for common mistakes before the final"
  ]
}
`;
async function getCourseWithTopics(supabase, courseId) {
  const { data: course, error: courseError } = await supabase.from("courses").select("id, code, name").eq("id", courseId).single();
  if (courseError || !course) {
    throw new Error(`Course not found: ${courseId}`);
  }
  const { data: topics, error: topicsError } = await supabase.from("topics").select("id, name, description, order_index").eq("course_id", courseId).order("order_index", { ascending: true });
  if (topicsError) {
    logger.warn("Failed to fetch topics", { error: topicsError });
  }
  return { course, topics: topics || [] };
}
__name(getCourseWithTopics, "getCourseWithTopics");
async function getUserMastery(supabase, userId, courseId) {
  const { data: mastery, error } = await supabase.from("topic_mastery").select("topic_id, mastery_level, last_reviewed_at").eq("user_id", userId).eq("course_id", courseId);
  if (error) {
    logger.warn("Failed to fetch user mastery", { error });
    return [];
  }
  return mastery || [];
}
__name(getUserMastery, "getUserMastery");
async function getGraphEdges(supabase, courseId) {
  const { data: edges, error } = await supabase.from("course_graph_edges").select("from_object_id, to_object_id, edge_type, confidence").eq("course_id", courseId).eq("edge_type", "prerequisite");
  if (error) {
    logger.warn("Failed to fetch graph edges", { error });
    return [];
  }
  return edges || [];
}
__name(getGraphEdges, "getGraphEdges");
var generateStudyPlan = task({
  id: "generate-study-plan",
  queue: {
    concurrencyLimit: 5
    // Multiple users can generate plans simultaneously
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5e3,
    maxTimeoutInMs: 6e4,
    randomize: true
  },
  catchError: /* @__PURE__ */ __name(async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Course not found") || errorMessage.includes("User not found")) {
      throw new AbortTaskRunError("Course or user does not exist");
    }
    if (errorMessage.includes("SUPABASE_URL")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    return void 0;
  }, "catchError"),
  run: /* @__PURE__ */ __name(async (payload) => {
    const {
      userId,
      courseId,
      targetDate,
      dailyMinutes = 60,
      focusWeakTopics = true
    } = payload;
    logger.info(`[generate-study-plan] Starting for user ${userId}, course ${courseId}`);
    metadata.set("stage", "initializing").set("userId", userId).set("courseId", courseId).set("dailyMinutes", dailyMinutes).set("progress", 0);
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    metadata.set("stage", "fetching_data");
    const { course, topics } = await getCourseWithTopics(supabase, courseId);
    logger.info(`Found ${topics.length} topics for ${course.code}`);
    metadata.set("courseCode", course.code).set("topicCount", topics.length).set("progress", 20);
    const mastery = await getUserMastery(supabase, userId, courseId);
    logger.info(`Found ${mastery.length} mastery records for user`);
    metadata.set("masteryRecords", mastery.length);
    const edges = await getGraphEdges(supabase, courseId);
    logger.info(`Found ${edges.length} prerequisite edges`);
    metadata.set("graphEdges", edges.length).set("progress", 40);
    const now = /* @__PURE__ */ new Date();
    const target = targetDate ? new Date(targetDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1e3);
    const daysUntilTarget = Math.max(1, Math.min(14, Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1e3))));
    logger.info(`Planning for ${daysUntilTarget} days until target date`);
    metadata.set("daysUntilTarget", daysUntilTarget);
    const masteryMap = /* @__PURE__ */ new Map();
    for (const topic of topics) {
      const userMastery = mastery.find((m) => m.topic_id === topic.id);
      masteryMap.set(topic.id, userMastery?.mastery_level ?? 0);
    }
    metadata.set("stage", "llm_generation");
    const messages = [
      { role: "system", content: STUDY_PLAN_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          course_code: course.code,
          course_name: course.name,
          topics: topics.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description?.slice(0, 200),
            mastery_percent: Math.round((masteryMap.get(t.id) || 0) * 100)
          })),
          prerequisite_edges: edges.map((e) => ({
            from: e.from_object_id,
            to: e.to_object_id,
            confidence: e.confidence
          })),
          planning_params: {
            days_available: daysUntilTarget,
            daily_minutes: dailyMinutes,
            focus_weak_topics: focusWeakTopics,
            target_date: target.toISOString().split("T")[0]
          }
        })
      },
      { role: "assistant", content: STUDY_PLAN_FEWSHOT.trim() },
      {
        role: "user",
        content: `Generate a ${daysUntilTarget}-day study plan for this course. The user has ${dailyMinutes} minutes per day. Focus on weak areas and respect prerequisite ordering.`
      }
    ];
    logger.info("Calling LLM for study plan generation...");
    const raw = await callLLM(messages, {
      temperature: 0.3,
      maxTokens: 6e3,
      intensive: true
      // GPT-5 Nano for quality
    });
    logger.debug("LLM raw response preview:", {
      preview: raw.slice(0, 500),
      length: raw.length
    });
    metadata.set("progress", 70);
    let parsed;
    try {
      parsed = safeParseJSON(raw);
    } catch (parseError) {
      logger.error("Failed to parse LLM response", {
        error: parseError,
        rawPreview: raw.slice(0, 1e3)
      });
      throw new Error("Failed to parse study plan from LLM response");
    }
    if (!parsed || !Array.isArray(parsed.daily_plan)) {
      logger.error("Invalid LLM response structure", {
        hasDailyPlan: !!parsed?.daily_plan,
        isArray: Array.isArray(parsed?.daily_plan)
      });
      throw new Error("LLM response missing daily_plan array");
    }
    logger.info(`Generated ${parsed.daily_plan.length}-day study plan`);
    metadata.set("planDays", parsed.daily_plan.length).set("progress", 85);
    metadata.set("stage", "database_update");
    const { error: archiveError } = await supabase.from("study_plans").update({ status: "archived" }).eq("user_id", userId).eq("course_id", courseId).eq("status", "active");
    if (archiveError) {
      logger.debug("No existing plan to archive");
    }
    const planId = randomUUID();
    const { error: insertError } = await supabase.from("study_plans").insert({
      id: planId,
      user_id: userId,
      course_id: courseId,
      title: parsed.title || `${course.code} Study Plan`,
      target_date: target.toISOString(),
      daily_minutes: dailyMinutes,
      plan_content: parsed.daily_plan,
      weak_topics: parsed.weak_topics || [],
      priority_order: parsed.priority_order || [],
      model_used: "gpt-5-nano",
      generated_at: (/* @__PURE__ */ new Date()).toISOString(),
      status: "active",
      progress_percent: 0,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (insertError) {
      logger.error("Failed to insert study plan", { error: insertError });
      throw new Error(`Failed to save study plan: ${insertError.message}`);
    }
    logger.info(`✅ Created study plan ${planId}`);
    const stats = {
      plan_id: planId,
      total_days: parsed.daily_plan.length,
      total_tasks: parsed.daily_plan.reduce((sum, d) => sum + d.tasks.length, 0),
      total_minutes: parsed.daily_plan.reduce((sum, d) => sum + d.estimated_minutes, 0),
      weak_topics_count: parsed.weak_topics?.length || 0,
      tips_count: parsed.tips?.length || 0
    };
    metadata.set("stage", "completed").set("progress", 100).set("stats", stats);
    logger.info(`[generate-study-plan] Completed`, stats);
    return {
      success: true,
      userId,
      courseId,
      planId,
      stats,
      overview: parsed.overview,
      tips: parsed.tips
    };
  }, "run")
});

export {
  generateStudyPlan
};
//# sourceMappingURL=chunk-2ZTXUQXN.mjs.map
