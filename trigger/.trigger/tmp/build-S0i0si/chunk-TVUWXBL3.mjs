import {
  fetchCourseWebResults
} from "./chunk-BRTLRSKF.mjs";
import {
  callLLM,
  safeParseJSON
} from "./chunk-IR5YNSFZ.mjs";
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

// tasks/precompute-knowledge-objects.ts
init_esm();
var import_supabase_js = __toESM(require_main());
import { randomUUID, createHash } from "crypto";
function generateContentHash(title, type, courseId) {
  const hash = createHash("sha256");
  hash.update(`${courseId}-${type}-${title.toLowerCase().trim()}`);
  return hash.digest("hex").slice(0, 16);
}
__name(generateContentHash, "generateContentHash");
var KNOWLEDGE_OBJECTS_SYSTEM_PROMPT = `
You are an expert educational data designer building a *knowledge graph* for a university course.
From the given documents (and optional web search results), you must extract *atomic knowledge objects*:

- CONCEPTS:
  - precise, exam-relevant ideas (e.g., "Deadlock", "Dining Philosophers", "TLB", "Two-phase locking")

- FORMULAS:
  - equations with LaTeX, plain-text, and explicit variable meanings

- WORKED_EXAMPLES:
  - step-by-step problems that demonstrate application of concepts

PEDAGOGICAL REQUIREMENTS:
- Granularity: Each knowledge object must represent ONE main idea.
- Traceability: Every object must point back to sources (doc/page/line context).
- Exam Relevance: Prefer objects that show up in homeworks, projects, and finals.
- Misconceptions: For each object, record common mistakes and confusions.

WEB SEARCH USAGE:
- If web results are provided:
  - Use them to clarify standard terminology and canonical examples (e.g., from OS textbooks for CSE 120).
  - Do NOT invent course-specific policies or grading rules from the web.
  - If web conflicts with course, prefer the course and mention conflict in "notes".

OUTPUT FORMAT:
- Valid JSON only.
- No markdown, comments, or backticks.

JSON SCHEMA (CONCEPTUAL):
{
  "course_id": string,
  "knowledge_objects": KnowledgeObject[]
}

KnowledgeObject (union):

1) Concept:
{
  "type": "concept",
  "id": string,
  "course_id": string,
  "topic_id": string | null,
  "name": string,
  "short_definition": string,
  "detailed_explanation": string,
  "bloom_primary": "remember" | "understand" | "apply" | "analyze",
  "prerequisites": string[],
  "common_mistakes": string[],
  "source_refs": string[],
  "notes": string | null
}

2) Formula:
{
  "type": "formula",
  "id": string,
  "course_id": string,
  "topic_id": string | null,
  "name": string,
  "latex": string,
  "plain": string,
  "variables": [
    { "symbol": string, "name": string, "units": string | null, "description": string }
  ],
  "conditions": string[],
  "common_mistakes": string[],
  "example_usage": string | null,
  "source_refs": string[],
  "notes": string | null
}

3) Worked Example:
{
  "type": "worked_example",
  "id": string,
  "course_id": string,
  "topic_id": string | null,
  "title": string,
  "problem_statement": string,
  "step_by_step_solution": string[],
  "final_answer": string,
  "concept_ids": string[],
  "common_mistakes": string[],
  "difficulty": 1 | 2 | 3,
  "source_refs": string[],
  "notes": string | null
}

CONSTRAINTS:
- DO NOT CREATE MORE THAN 50 KNOWLEDGE OBJECTS per run.
- Only include concepts explicitly supported by the provided course documents or clearly standard for this course topic.
- Generate unique IDs using format: concept_{topic}_{name}, formula_{topic}_{name}, example_{topic}_{name}
`;
var KNOWLEDGE_OBJECTS_FEWSHOT = `
{
  "course_id": "cse120",
  "knowledge_objects": [
    {
      "type": "concept",
      "id": "concept_deadlock_four_conditions",
      "course_id": "cse120",
      "topic_id": "deadlock",
      "name": "Coffman Conditions for Deadlock",
      "short_definition": "Four necessary conditions (mutual exclusion, hold and wait, no preemption, circular wait) that must all hold simultaneously for deadlock to be possible.",
      "detailed_explanation": "Deadlock can occur only if four conditions hold: (1) Mutual exclusion: at least one resource is non-sharable. (2) Hold and wait: a process holds one resource while waiting for another. (3) No preemption: resources cannot be forcibly taken away. (4) Circular wait: a cycle of processes exists, each waiting for a resource held by another. Exam questions often ask you to identify which conditions are present in a scenario or how to break one condition to prevent deadlock.",
      "bloom_primary": "understand",
      "prerequisites": ["concept_deadlock_definition"],
      "common_mistakes": [
        "Forgetting that all four conditions are necessary, not sufficient.",
        "Mixing up 'hold and wait' and 'circular wait'.",
        "Claiming that breaking any one condition always completely eliminates deadlock in practice without considering performance tradeoffs."
      ],
      "source_refs": ["lec10-deadlock.pdf#p4"],
      "notes": null
    },
    {
      "type": "formula",
      "id": "formula_tlb_effective_access_time",
      "course_id": "cse120",
      "topic_id": "memory",
      "name": "TLB Effective Access Time (EAT)",
      "latex": "EAT = h(T_{TLB} + T_{M}) + (1 - h)(T_{TLB} + 2T_{M})",
      "plain": "EAT = hit_rate * (TLB_time + memory_time) + (1 - hit_rate) * (TLB_time + 2 * memory_time)",
      "variables": [
        { "symbol": "h", "name": "TLB hit rate", "units": null, "description": "Fraction of memory accesses found in the TLB." },
        { "symbol": "T_{TLB}", "name": "TLB access time", "units": "ns", "description": "Time to access the TLB entry." },
        { "symbol": "T_{M}", "name": "Memory access time", "units": "ns", "description": "Time to access physical memory once." }
      ],
      "conditions": [
        "Single-level page table",
        "On TLB miss, we must access page table in memory then the actual memory location"
      ],
      "common_mistakes": [
        "Forgetting the TLB access time on miss.",
        "Using memory_time instead of 2 * memory_time on miss.",
        "Confusing hit_rate with miss_rate."
      ],
      "example_usage": "If h = 0.9, T_TLB = 10 ns, and T_M = 100 ns, then EAT = 0.9*(10+100) + 0.1*(10+200) = 0.9*110 + 0.1*210 = 99 + 21 = 120 ns.",
      "source_refs": ["lec13-virtual-memory.pdf#p6"],
      "notes": null
    },
    {
      "type": "worked_example",
      "id": "example_scheduling_sjf",
      "course_id": "cse120",
      "topic_id": "scheduling",
      "title": "SJF Average Waiting Time Calculation",
      "problem_statement": "Given 4 processes with burst times [6, 8, 7, 3], compute the average waiting time under Shortest Job First (non-preemptive) scheduling.",
      "step_by_step_solution": [
        "Sort processes by burst time: P4(3), P1(6), P3(7), P2(8)",
        "Waiting times: P4=0, P1=3, P3=9, P2=16",
        "Sum = 0 + 3 + 9 + 16 = 28",
        "Average = 28 / 4 = 7 ms"
      ],
      "final_answer": "Average waiting time = 7 ms",
      "concept_ids": ["concept_sjf_scheduling"],
      "common_mistakes": [
        "Not sorting by burst time first",
        "Including burst time in waiting time",
        "Off-by-one errors in cumulative waiting"
      ],
      "difficulty": 2,
      "source_refs": ["lec05-scheduling.pdf#p12"],
      "notes": null
    }
  ]
}
`;
async function getCourseAndDocuments(supabase, courseId) {
  const { data: course, error: courseError } = await supabase.from("courses").select("id, code, name").eq("id", courseId).single();
  if (courseError || !course) {
    throw new Error(`Course not found for id ${courseId}`);
  }
  const { data: documents, error: docsError } = await supabase.from("documents").select("id, title, topic_id").eq("course_id", courseId).order("created_at", { ascending: true });
  if (docsError) {
    logger.warn("Failed to fetch documents", { error: docsError });
  }
  return { course, documents: documents || [] };
}
__name(getCourseAndDocuments, "getCourseAndDocuments");
async function getDocumentPages(supabase, documentId) {
  const { count, error: countError } = await supabase.from("document_pages").select("*", { count: "exact", head: true }).eq("document_id", documentId);
  if (countError) {
    logger.error("Count query failed for document_pages", {
      documentId,
      error: countError,
      errorMessage: countError.message,
      errorCode: countError.code
    });
    throw new Error(`Failed to count document_pages: ${countError.message}`);
  }
  logger.info("Document pages count query result", {
    documentId,
    count,
    countIsNull: count === null,
    countIsZero: count === 0
  });
  if (count === null) {
    logger.error("RLS likely blocking access - count returned null", { documentId });
    throw new Error(`RLS blocking access to document_pages for document ${documentId}`);
  }
  if (count === 0) {
    logger.warn("No pages found for document (legitimate empty)", { documentId });
    return [];
  }
  const { data: pages, error } = await supabase.from("document_pages").select("id, page_number, text_content").eq("document_id", documentId).order("page_number", { ascending: true }).limit(20);
  if (error) {
    logger.error("Failed to fetch pages for document", {
      documentId,
      error,
      errorMessage: error.message
    });
    throw new Error(`Failed to fetch pages: ${error.message}`);
  }
  if ((!pages || pages.length === 0) && count > 0) {
    logger.error("RLS blocking SELECT - count was positive but no pages returned", {
      documentId,
      expectedCount: count,
      actualLength: pages?.length || 0
    });
    throw new Error(`RLS blocking SELECT on document_pages for document ${documentId}`);
  }
  logger.info("Successfully fetched pages", {
    documentId,
    pageCount: pages?.length || 0
  });
  return (pages || []).map((p) => ({
    page_number: p.page_number,
    text: (p.text_content || "").slice(0, 1500)
    // 1500 chars per page
  }));
}
__name(getDocumentPages, "getDocumentPages");
function mapKnowledgeObjectToRow(ko, courseId, documentId) {
  const mapType = /* @__PURE__ */ __name((t) => t === "worked_example" ? "example" : t, "mapType");
  let title = "";
  if (ko.type === "concept") {
    title = ko.name || ko.title || "Untitled Concept";
  } else if (ko.type === "formula") {
    title = ko.name || ko.title || "Untitled Formula";
  } else if (ko.type === "worked_example") {
    title = ko.title || ko.name || "Untitled Example";
  } else {
    title = ko.title || ko.name || "Untitled";
  }
  title = String(title).trim() || "Untitled";
  const mappedType = mapType(ko.type);
  const validTypes = ["concept", "formula", "example", "common_mistake", "micro_drill"];
  if (!validTypes.includes(mappedType)) {
    logger.warn(`Invalid object type "${ko.type}" mapped to "${mappedType}", defaulting to "concept"`);
  }
  const base = {
    id: randomUUID(),
    // Generate proper UUID
    course_id: courseId,
    topic_id: null,
    // topic_id from LLM is not a valid UUID, use null
    object_type: validTypes.includes(mappedType) ? mappedType : "concept",
    bloom_primary: ko.bloom_primary ?? null,
    prerequisites: Array.isArray(ko.prerequisites) ? ko.prerequisites : [],
    common_mistakes: Array.isArray(ko.common_mistakes) ? ko.common_mistakes : [],
    source_refs: Array.isArray(ko.source_refs) ? ko.source_refs : [],
    content: {
      ...ko,
      llm_id: ko.id,
      // Preserve the LLM-generated ID in content for reference
      source_document_id: documentId,
      // Track which document this came from
      content_hash: generateContentHash(title, ko.type, courseId)
      // For deduplication
    },
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (ko.type === "concept") {
    return {
      ...base,
      title,
      summary: ko.short_definition || ko.detailed_explanation || ""
    };
  }
  if (ko.type === "formula") {
    return {
      ...base,
      title,
      summary: ko.plain || ko.latex || ""
    };
  }
  return {
    ...base,
    title,
    summary: ko.problem_statement || ko.step_by_step_solution?.[0] || ""
  };
}
__name(mapKnowledgeObjectToRow, "mapKnowledgeObjectToRow");
var precomputeKnowledgeObjects = task({
  id: "precompute-knowledge-objects",
  queue: {
    concurrencyLimit: 1
    // One course at a time
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5e3,
    maxTimeoutInMs: 3e5,
    // 5 minutes for large courses
    randomize: true
  },
  // Classify errors - abort on fatal, retry on transient
  catchError: /* @__PURE__ */ __name(async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Course not found")) {
      throw new AbortTaskRunError("Course does not exist - cannot proceed");
    }
    if (errorMessage.includes("SUPABASE_URL") || errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    return void 0;
  }, "catchError"),
  run: /* @__PURE__ */ __name(async (payload) => {
    const { courseId } = payload;
    logger.info(`[precompute-knowledge-objects] Starting for course ${courseId}`);
    metadata.set("stage", "initializing").set("progress", 0).set("courseId", courseId);
    const hasSupabaseUrl = !!process.env.SUPABASE_URL;
    const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const serviceKeyLength = process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0;
    logger.info("Environment check", {
      hasSupabaseUrl,
      hasServiceKey,
      serviceKeyLength,
      urlPreview: process.env.SUPABASE_URL?.slice(0, 30) + "..."
    });
    if (!hasSupabaseUrl || !hasServiceKey) {
      throw new Error(`Missing environment variables: SUPABASE_URL=${hasSupabaseUrl}, SUPABASE_SERVICE_ROLE_KEY=${hasServiceKey}`);
    }
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    const { data: healthData, error: healthError } = await supabase.from("documents").select("id").limit(1);
    if (healthError) {
      logger.error("Health check failed", { error: healthError });
      throw new Error(`Health check failed: ${healthError.message}`);
    }
    logger.info("Health check passed", { foundDocuments: healthData?.length || 0 });
    const { course, documents } = await getCourseAndDocuments(supabase, courseId);
    logger.info(`Found ${documents.length} documents for ${course.code}`);
    metadata.set("courseCode", course.code).set("totalDocuments", documents.length);
    if (documents.length === 0) {
      logger.warn("No documents found, skipping knowledge object generation");
      metadata.set("stage", "completed_no_docs");
      return { success: false, reason: "no_documents" };
    }
    metadata.set("stage", "web_search");
    let webResults = [];
    try {
      webResults = await fetchCourseWebResults(course.code, course.name);
      logger.info(`Fetched ${webResults.length} web results (reused for all ${documents.length} docs)`);
      metadata.set("webResultsCount", webResults.length);
    } catch (error) {
      logger.warn("Web search failed, continuing without", { error });
      metadata.set("webSearchFailed", true);
    }
    const batchTimestamp = (/* @__PURE__ */ new Date()).toISOString();
    metadata.set("batchTimestamp", batchTimestamp);
    let processedDocs = 0;
    let skippedDocs = 0;
    let totalObjects = 0;
    let conceptCount = 0;
    let formulaCount = 0;
    let exampleCount = 0;
    metadata.set("stage", "processing_documents");
    for (const doc of documents) {
      const docIndex = processedDocs + skippedDocs;
      const progress = Math.round(docIndex / documents.length * 100);
      metadata.set("progress", progress).set("currentDocument", doc.title).set("documentsProcessed", processedDocs).set("documentsSkipped", skippedDocs);
      try {
        logger.info(`Processing document ${docIndex + 1}/${documents.length}: ${doc.title}`);
        const pages = await getDocumentPages(supabase, doc.id);
        if (pages.length === 0) {
          logger.warn(`No pages for document ${doc.title}, skipping`);
          skippedDocs++;
          continue;
        }
        const messages = [
          { role: "system", content: KNOWLEDGE_OBJECTS_SYSTEM_PROMPT },
          {
            role: "user",
            content: JSON.stringify({
              course_id: courseId,
              course_code: course.code,
              course_name: course.name,
              document_title: doc.title,
              document_id: doc.id,
              topic_id: doc.topic_id,
              pages,
              web_results: webResults.slice(0, 3)
              // Only top 3 web results
            })
          },
          { role: "assistant", content: KNOWLEDGE_OBJECTS_FEWSHOT.trim() },
          {
            role: "user",
            content: "Extract knowledge_objects from this SINGLE document. Extract 3-8 concepts, 1-3 formulas, and 1-3 worked examples if the material supports it. Focus on the most exam-relevant content."
          }
        ];
        logger.info(`Calling LLM for document "${doc.title}"...`);
        const raw = await callLLM(messages, {
          temperature: 0.2,
          maxTokens: 4096
          // intensive: false (default) - Groq is fine for extraction
        });
        logger.debug(`LLM raw response preview for "${doc.title}":`, {
          preview: raw.slice(0, 500),
          length: raw.length
        });
        let parsed;
        try {
          parsed = safeParseJSON(raw);
        } catch (parseError) {
          logger.error(`Failed to parse LLM response for "${doc.title}"`, {
            error: parseError,
            rawPreview: raw.slice(0, 1e3)
          });
          skippedDocs++;
          continue;
        }
        if (!parsed || !Array.isArray(parsed.knowledge_objects)) {
          logger.error(`Invalid LLM response structure for "${doc.title}"`, {
            hasKnowledgeObjects: !!parsed?.knowledge_objects,
            isArray: Array.isArray(parsed?.knowledge_objects),
            parsedKeys: parsed ? Object.keys(parsed) : []
          });
          skippedDocs++;
          continue;
        }
        logger.info(`Document "${doc.title}": extracted ${parsed.knowledge_objects.length} objects`);
        const objectsWithContext = parsed.knowledge_objects.map((ko) => ({
          ...ko,
          llm_topic_id: ko.topic_id,
          topic_id: doc.topic_id || null,
          source_refs: [...ko.source_refs || [], `${doc.title}`]
        }));
        const rows = objectsWithContext.map((ko) => mapKnowledgeObjectToRow(ko, courseId, doc.id));
        if (rows.length > 0) {
          const { error: deleteDocError } = await supabase.from("knowledge_objects").delete().eq("course_id", courseId).filter("content->source_document_id", "eq", doc.id);
          if (deleteDocError) {
            logger.debug(`No old objects to delete for ${doc.title}`);
          }
          logger.info(`Inserting ${rows.length} objects for "${doc.title}"...`, {
            types: rows.map((r) => r.object_type),
            titles: rows.map((r) => r.title?.slice(0, 30))
          });
          const { data: insertedData, error: insertError } = await supabase.from("knowledge_objects").insert(rows).select("id, title, object_type");
          if (insertError) {
            logger.error(`Failed to insert objects for ${doc.title}`, {
              error: insertError,
              errorMessage: insertError.message,
              errorDetails: insertError.details,
              errorHint: insertError.hint,
              firstRow: JSON.stringify(rows[0]).slice(0, 500)
            });
          } else {
            logger.info(`✅ Inserted ${insertedData?.length || rows.length} objects`, {
              ids: insertedData?.map((d) => d.id).slice(0, 3)
            });
            totalObjects += rows.length;
            conceptCount += objectsWithContext.filter((ko) => ko.type === "concept").length;
            formulaCount += objectsWithContext.filter((ko) => ko.type === "formula").length;
            exampleCount += objectsWithContext.filter((ko) => ko.type === "worked_example").length;
            logger.info(`✅ Inserted ${rows.length} objects for "${doc.title}" (total: ${totalObjects})`);
          }
        }
        processedDocs++;
        metadata.set("totalObjects", totalObjects).set("conceptCount", conceptCount).set("formulaCount", formulaCount).set("exampleCount", exampleCount);
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        logger.error(`Failed to process document ${doc.title}`, { error });
        skippedDocs++;
      }
    }
    const stats = {
      documents_processed: processedDocs,
      documents_skipped: skippedDocs,
      concepts: conceptCount,
      formulas: formulaCount,
      worked_examples: exampleCount,
      total_objects: totalObjects
    };
    metadata.set("stage", "completed").set("progress", 100).set("stats", stats);
    logger.info(`[precompute-knowledge-objects] Completed for ${course.code}`, stats);
    return {
      success: true,
      courseId,
      stats
    };
  }, "run")
});

export {
  precomputeKnowledgeObjects
};
//# sourceMappingURL=chunk-TVUWXBL3.mjs.map
