import { task, logger, metadata, AbortTaskRunError } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { callLLM, type ChatMessage } from "../lib/llm";
import { safeParseJSON } from "../lib/utils";
import { 
  fetchCourseWebResults, 
  aggregateWebContent, 
  formatWebContentForPrompt,
  type CategorizedWebResult 
} from "../lib/websearch";
import type { FinalPacksLLMResponse } from "../lib/types";

interface FinalPackPayload {
  courseId: string;
  forceFresh?: boolean;
}

// =====================================================
// EXPERT SYSTEM PROMPT - 15+ Years Professor Experience
// =====================================================

const FINAL_PACKS_SYSTEM_PROMPT = `
You are a senior university professor, expert exam setter, and curriculum designer.
You have taught this exact course (including its UCSD-specific version) for over 15 years.
Your job: From a given course document set, build *final exam survival packs* that maximize a student's score with minimal time.

You think like:
- A professor writing a tough but fair final
- A TA who has graded hundreds of exams and knows common mistakes
- A learning scientist optimizing for active recall and spaced repetition

QUALITY REQUIREMENTS (NON-NEGOTIABLE):

1. ACCURACY
   - Every fact must be correct.
   - If you are uncertain, either omit or clearly mark as "LOW_CONFIDENCE".

2. EXAM FOCUS
   - Prioritize *what is likely tested on midterms/finals*:
     - core definitions, theorems, invariants
     - standard algorithm patterns
     - canonical problems professors love to ask
     - tricky edge cases that produce partial credit loss

3. COMMON MISTAKES
   - Explicitly surface errors students make:
     - wrong formula variants
     - misapplied conditions or assumptions
     - confusion between similar concepts

4. ACTIVE RECALL
   - Do NOT produce essays.
   - Produce *questions*, *prompts*, and *problem skeletons* that force thinking.

5. CONCISENESS
   - Remove fluff.
   - Prefer dense, high-yield bullets and question templates.

6. BLOOM'S TAXONOMY – TARGET LEVELS
   - "Essentials": Remember + Understand (define, explain, identify)
   - "MustSolve": Apply + Analyze (solve, trace, compare, derive)
   - "Drills": Apply (repeatable practice; quick pattern recognition)

INPUT SOURCES (USE ALL OF THEM):
You will receive:
1. KNOWLEDGE_OBJECTS - Pre-extracted concepts, formulas, and worked examples from course materials (PRIMARY SOURCE)
2. EXISTING_QUESTIONS - Actual exam/quiz questions from the database (USE THESE TO INFORM DIFFICULTY AND STYLE)
3. WEB_CONTENT - Categorized web search results:
   - lecture_notes: Official UCSD course materials
   - flashcards: Quizlet study sets (use for common definitions and memorization items)
   - github_guides: GitHub repos with homework solutions and project code
   - past_exams: Past exam questions from CourseHero, Studocu, etc.
   - student_tips: Reddit discussions with student insights

HOW TO USE WEB CONTENT:
- Use flashcards to identify what students commonly memorize
- Use past_exams to match exam question styles and difficulty
- Use github_guides for coding-related problems and common patterns
- Use student_tips to identify common misconceptions and study strategies
- If web and course conflict, prefer course documents and mark the conflict in a "notes" field.

OUTPUT FORMAT:
- You must output ONLY valid JSON and NOTHING else.
- No markdown, no comments, no backticks.

JSON SCHEMA:
{
  "course_id": string,
  "source_documents": string[],
  "packs": {
    "essentials": FinalPackItem[],
    "must_solve": FinalPackItem[],
    "drills": FinalPackItem[]
  }
}

FinalPackItem:
{
  "topic_id": string | null,
  "title": string,
  "bloom_level": "remember" | "understand" | "apply" | "analyze",
  "prompt": string,
  "short_answer": string | null,
  "common_mistakes": string[],
  "difficulty": 1 | 2 | 3,
  "exam_relevance": 1 | 2 | 3,
  "source_refs": string[]
}
`;

// =====================================================
// FEW-SHOT EXAMPLE - CSE 120 Style
// =====================================================

const FINAL_PACKS_FEWSHOT_EXAMPLE = `
{
  "course_id": "cse120",
  "source_documents": ["lec01-intro.pdf", "lec02-threads.pdf"],
  "packs": {
    "essentials": [
      {
        "topic_id": "threads_vs_processes",
        "title": "Thread vs Process – Key Differences",
        "bloom_level": "understand",
        "prompt": "Explain the differences between a process and a thread in terms of address space, execution state, and OS abstraction.",
        "short_answer": "A process has its own address space, file descriptors, and OS resources. Threads within a process share the address space and resources but have separate program counters, registers, and stacks.",
        "common_mistakes": [
          "Saying threads have their own address space.",
          "Ignoring that threads share open file descriptors.",
          "Not mentioning per-thread stack and registers."
        ],
        "difficulty": 1,
        "exam_relevance": 3,
        "source_refs": ["lec02-threads.pdf#p3"]
      }
    ],
    "must_solve": [
      {
        "topic_id": "scheduling_fcfs_vs_sjf",
        "title": "Compare FCFS vs SJF Scheduling",
        "bloom_level": "analyze",
        "prompt": "Given N jobs with known CPU burst times, manually compute the average waiting time under FCFS and under non-preemptive SJF. Identify which minimizes average waiting time and why.",
        "short_answer": "Non-preemptive SJF always minimizes average waiting time when burst times are known, because it schedules the shortest available job first, reducing the sum of waiting times.",
        "common_mistakes": [
          "Messing up the waiting-time calculation order.",
          "Assuming FCFS also minimizes waiting time.",
          "Forgetting to include the first job's waiting time as 0."
        ],
        "difficulty": 2,
        "exam_relevance": 3,
        "source_refs": ["lec05-scheduling.pdf#p7"]
      }
    ],
    "drills": [
      {
        "topic_id": "critical_section",
        "title": "Critical Section Identification Drills",
        "bloom_level": "apply",
        "prompt": "Given a short multi-threaded pseudocode snippet, identify the minimal critical section that must be protected to avoid race conditions.",
        "short_answer": "Highlight only the shared-state update region (e.g., increment of shared counter), not the entire function.",
        "common_mistakes": [
          "Locking a larger region than necessary (hurts concurrency).",
          "Missing non-atomic read-modify-write sequences.",
          "Forgetting that multiple variables can form one invariant."
        ],
        "difficulty": 2,
        "exam_relevance": 2,
        "source_refs": ["lec07-synchronization.pdf#p10"]
      }
    ]
  }
}
`;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Fetch existing questions from the database for this course
 * These are actual exam/quiz questions that inform difficulty and style
 */
async function getCourseQuestions(
  supabase: ReturnType<typeof createClient>,
  courseId: string
) {
  const { data, error } = await supabase
    .from("questions")
    .select("id, text, type, difficulty, topic_id, options, correct_answer")
    .eq("course_id", courseId)
    .limit(100);

  if (error) {
    logger.warn("Failed to fetch course questions", { error });
    return [];
  }

  return (data || []).map((q: any) => ({
    id: q.id,
    text: q.text,
    type: q.type,
    difficulty: q.difficulty,
    topic_id: q.topic_id,
    has_options: Array.isArray(q.options) && q.options.length > 0,
  }));
}

async function getCourseAndKnowledgeObjects(
  supabase: ReturnType<typeof createClient>,
  courseId: string
) {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, code, name")
    .eq("id", courseId)
    .single();

  if (courseError || !course) {
    throw new Error(`Course not found for id ${courseId}`);
  }

  // Get knowledge objects (already extracted) - much more efficient than raw pages
  const { data: objects, error: koError } = await supabase
    .from("knowledge_objects")
    .select("id, title, summary, object_type, content, common_mistakes, source_refs")
    .eq("course_id", courseId)
    .limit(100);

  if (koError) {
    logger.warn("Failed to fetch knowledge objects", { error: koError });
  }

  // Format for prompt - summarized version
  const knowledgeObjects = (objects || []).map((ko: any) => ({
    id: ko.id,
    type: ko.object_type,
    title: ko.title,
    summary: ko.summary,
    common_mistakes: ko.common_mistakes || [],
  }));

  // Also get document titles for reference
  const { data: docs } = await supabase
    .from("documents")
    .select("id, title")
    .eq("course_id", courseId);

  const documentTitles = (docs || []).map((d: any) => d.title);

  return { course, knowledgeObjects, documentTitles };
}

// =====================================================
// MAIN TASK
// =====================================================

export const precomputeFinalPacks = task({
  id: "precompute-final-packs",
  queue: {
    concurrencyLimit: 2,
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 120000,
    randomize: true,
  },
  // Classify errors - abort on fatal, retry on transient
  catchError: async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Fatal errors - don't retry
    if (errorMessage.includes("Course not found")) {
      throw new AbortTaskRunError("Course does not exist - cannot proceed");
    }
    if (errorMessage.includes("no_knowledge_objects")) {
      throw new AbortTaskRunError("No knowledge objects - run precompute-knowledge-objects first");
    }
    if (errorMessage.includes("SUPABASE_URL") || errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    
    // Allow retry for transient errors
    return undefined;
  },
  run: async (payload: FinalPackPayload) => {
    const { courseId } = payload;
    logger.info(`[precompute-final-packs] Starting for course ${courseId}`);
    
    // Initialize progress metadata
    metadata
      .set("stage", "initializing")
      .set("progress", 0)
      .set("courseId", courseId);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get course and knowledge objects (pre-extracted, much smaller than raw docs)
    metadata.set("stage", "fetching_data");
    const { course, knowledgeObjects, documentTitles } = await getCourseAndKnowledgeObjects(supabase, courseId);
    logger.info(`Found ${knowledgeObjects.length} knowledge objects for ${course.code}`);
    
    metadata
      .set("courseCode", course.code)
      .set("knowledgeObjectsCount", knowledgeObjects.length)
      .set("progress", 10);

    if (knowledgeObjects.length === 0) {
      logger.warn("No knowledge objects found. Run precompute-knowledge-objects first.");
      metadata.set("stage", "no_knowledge_objects");
      return { success: false, reason: "no_knowledge_objects" };
    }

    // Fetch existing questions from the database
    metadata.set("stage", "fetching_questions");
    const existingQuestions = await getCourseQuestions(supabase, courseId);
    logger.info(`Found ${existingQuestions.length} existing questions in DB`);
    metadata.set("existingQuestionsCount", existingQuestions.length).set("progress", 20);

    // Fetch web search results - HEAVY SEARCH (5 queries, 50 results)
    metadata.set("stage", "web_search");
    let webResults: CategorizedWebResult[] = [];
    try {
      webResults = await fetchCourseWebResults(course.code, course.name);
      logger.info(`Fetched ${webResults.length} web results from heavy search`);
      metadata.set("webResultsCount", webResults.length);
    } catch (error) {
      logger.warn("Web search failed, continuing without", { error });
      metadata.set("webSearchFailed", true);
    }
    metadata.set("progress", 40);

    // Aggregate and format web content by category
    const aggregatedWeb = aggregateWebContent(webResults);
    const formattedWebContent = formatWebContentForPrompt(aggregatedWeb, 8000); // 8k chars per category

    // Build messages with few-shot example - FULL CONTEXT
    metadata.set("stage", "llm_inference");
    const messages: ChatMessage[] = [
      { role: "system", content: FINAL_PACKS_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          course_id: courseId,
          course_code: course.code,
          course_name: course.name,
          // Primary source: extracted knowledge
          knowledge_objects: knowledgeObjects,
          source_documents: documentTitles,
          // Actual questions from DB for style/difficulty reference
          existing_questions: existingQuestions,
          // Categorized web content - heavy search results
          web_content: formattedWebContent,
        }),
      },
      // Few-shot example
      {
        role: "assistant",
        content: FINAL_PACKS_FEWSHOT_EXAMPLE.trim(),
      },
      {
        role: "user",
        content: `Based on all the provided content (knowledge_objects, existing_questions, and web_content), generate comprehensive final packs for ${course.code}.
        
Requirements:
- Create at least 10 items per tier (essentials, must_solve, drills)
- Use existing_questions to match the style and difficulty of actual course exams
- Incorporate insights from web_content.flashcards for common memorization items
- Use web_content.past_exams to identify common exam patterns
- Include common mistakes from student_tips (Reddit)
- Focus on exam-relevant content that maximizes score with minimal study time`,
      },
    ];

    // Call LLM - GPT-5 Mini (primary) for comprehensive exam pack generation
    const raw = await callLLM(messages, {
      temperature: 0.2,
      maxTokens: 12000, // Larger output for comprehensive packs
    });
    metadata.set("progress", 70);

    const parsed = safeParseJSON<FinalPacksLLMResponse>(raw);
    logger.info(`Parsed ${parsed.packs.essentials.length} essentials, ${parsed.packs.must_solve.length} must_solve, ${parsed.packs.drills.length} drills`);
    
    metadata
      .set("essentialsCount", parsed.packs.essentials.length)
      .set("mustSolveCount", parsed.packs.must_solve.length)
      .set("drillsCount", parsed.packs.drills.length)
      .set("progress", 80);

    // Upsert to final_packs table
    metadata.set("stage", "database_update");
    const timestamp = new Date().toISOString();
    const upsertPayload = [
      {
        course_id: courseId,
        tier: "essentials",
        content: {
          items: parsed.packs.essentials || [],
          source_documents: parsed.source_documents || [],
          web_sources_used: aggregatedWeb.all.length,
          questions_referenced: existingQuestions.length,
        },
        generated_at: timestamp,
        updated_at: timestamp,
      },
      {
        course_id: courseId,
        tier: "must_solve",
        content: {
          items: parsed.packs.must_solve || [],
          source_documents: parsed.source_documents || [],
          web_sources_used: aggregatedWeb.all.length,
          questions_referenced: existingQuestions.length,
        },
        generated_at: timestamp,
        updated_at: timestamp,
      },
      {
        course_id: courseId,
        tier: "drills",
        content: {
          items: parsed.packs.drills || [],
          source_documents: parsed.source_documents || [],
          web_sources_used: aggregatedWeb.all.length,
          questions_referenced: existingQuestions.length,
        },
        generated_at: timestamp,
        updated_at: timestamp,
      },
    ];

    const { error } = await supabase
      .from("final_packs")
      .upsert(upsertPayload, {
        onConflict: "course_id,tier",
      });

    if (error) {
      logger.error("Failed to upsert final_packs", { error });
      throw error;
    }

    const stats = {
      essentials: parsed.packs.essentials.length,
      mustSolve: parsed.packs.must_solve.length,
      drills: parsed.packs.drills.length,
      webResultsUsed: aggregatedWeb.all.length,
      questionsReferenced: existingQuestions.length,
    };

    metadata
      .set("stage", "completed")
      .set("progress", 100)
      .set("stats", stats);

    logger.info(`[precompute-final-packs] Completed for ${course.code}`, stats);

    return {
      success: true,
      courseId,
      stats,
    };
  },
});
