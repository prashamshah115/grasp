import {
  fetchCourseWebResults
} from "./chunk-BRTLRSKF.mjs";
import {
  callLLM,
  safeParseJSON
} from "./chunk-WKPDEFDT.mjs";
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

// tasks/generate-knowledge-graph.ts
init_esm();
var import_supabase_js = __toESM(require_main());
var KNOWLEDGE_GRAPH_SYSTEM_PROMPT = `
You are building a directed knowledge graph for a university course.

INPUT:
- A list of knowledge objects (concepts, formulas, worked examples) you previously helped create.
- Optional web search snippets (for cross-checking standard prerequisite relationships).

GOAL:
- Infer prerequisite and relationship edges between these objects.

RELATIONSHIP TYPES (DIRECTED):

1) "prerequisite"
   - A -> B if understanding A is normally required before fully understanding B.
   - Example: "Paging basics" -> "TLB effective access time formula".

2) "strengthens"
   - A -> B if A is a worked example that reinforces concept B.

3) "uses"
   - A -> B if worked example A directly uses formula or concept B.

4) "similar_to"
   - UNDIRECTED conceptual similarity; represent as two directed edges A -> B and B -> A.

HEURISTICS:
- Use course-specific naming: earlier lecture concepts often prerequisites for later ones.
- Use web results only to:
  - Validate common prerequisite chains (e.g., mutual exclusion before deadlock).
  - Cross-check typical OS or ML concept hierarchies.
- Do not create edges that contradict the course's actual structure if known.

CONFIDENCE CALIBRATION:
- Each edge must include confidence: 1=low, 2=medium, 3=high.
- High confidence if:
  - Explicitly stated in the docs (e.g., "To understand X, you must know Y").
  - The prerequisite is standard in textbooks.
- Medium confidence if:
  - Strongly implied by ordering or notation.
- Low confidence if:
  - You are inferring from weak cues; these should be few.

OUTPUT:
- Valid JSON only.
- No markdown.

JSON SCHEMA (CONCEPTUAL):
{
  "course_id": string,
  "edges": [
    {
      "from_id": string,
      "to_id": string,
      "type": "prerequisite" | "strengthens" | "uses" | "similar_to",
      "confidence": 1 | 2 | 3,
      "evidence": string[],
      "source_refs": string[]
    }
  ]
}

CONSTRAINTS:
- Generate meaningful edges only. Quality over quantity.
- Maximum 100 edges per run.
- Each edge should have at least one piece of evidence.
`;
var KNOWLEDGE_GRAPH_FEWSHOT = `
{
  "course_id": "cse120",
  "edges": [
    {
      "from_id": "concept_deadlock_definition",
      "to_id": "concept_deadlock_four_conditions",
      "type": "prerequisite",
      "confidence": 3,
      "evidence": [
        "Slides introduce 'What is deadlock?' before the four Coffman conditions.",
        "Textbook: 'To understand the four conditions, we first define deadlock as...'"
      ],
      "source_refs": ["lec10-deadlock.pdf#p2-4"]
    },
    {
      "from_id": "formula_tlb_effective_access_time",
      "to_id": "example_tlb_eat_calculation",
      "type": "uses",
      "confidence": 3,
      "evidence": [
        "The worked example explicitly plugs numbers into the TLB EAT formula."
      ],
      "source_refs": ["lec13-virtual-memory.pdf#p6-7"]
    },
    {
      "from_id": "concept_mutex_lock",
      "to_id": "concept_semaphore",
      "type": "similar_to",
      "confidence": 2,
      "evidence": [
        "Both mutex lock and semaphore are synchronization primitives discussed together; semaphore generalizes binary mutex."
      ],
      "source_refs": ["lec08-sync-primitives.pdf#p3-5"]
    },
    {
      "from_id": "concept_process",
      "to_id": "concept_thread",
      "type": "prerequisite",
      "confidence": 3,
      "evidence": [
        "Threads are introduced as lightweight processes",
        "Process concept must be understood before threads"
      ],
      "source_refs": ["lec02-threads.pdf#p1-3"]
    },
    {
      "from_id": "example_scheduling_sjf",
      "to_id": "concept_sjf_scheduling",
      "type": "strengthens",
      "confidence": 3,
      "evidence": [
        "The worked example demonstrates SJF scheduling calculation"
      ],
      "source_refs": ["lec05-scheduling.pdf#p12"]
    }
  ]
}
`;
async function getCourseAndKnowledgeObjects(supabase, courseId) {
  const { data: course, error: courseError } = await supabase.from("courses").select("id, code, name").eq("id", courseId).single();
  if (courseError || !course) {
    throw new Error(`Course not found for id ${courseId}`);
  }
  const { data: kos, error: kosError } = await supabase.from("knowledge_objects").select("id, course_id, topic_id, object_type, title, summary, content").eq("course_id", courseId);
  if (kosError) {
    logger.warn("Failed to fetch knowledge objects", { error: kosError });
    throw kosError;
  }
  const llmIdToDbId = /* @__PURE__ */ new Map();
  const dbIdToLlmId = /* @__PURE__ */ new Map();
  const knowledgeObjects = (kos || []).map((row, index) => {
    const content = row.content;
    const safeName = (row.title || `item_${index}`).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);
    const llmId = `${row.object_type}_${safeName}`;
    llmIdToDbId.set(llmId, row.id);
    dbIdToLlmId.set(row.id, llmId);
    if (content?.llm_id) {
      llmIdToDbId.set(content.llm_id, row.id);
    }
    return {
      dbId: row.id,
      llmId,
      type: row.object_type,
      title: row.title,
      summary: row.summary || ""
    };
  });
  return { course, knowledgeObjects, llmIdToDbId, dbIdToLlmId };
}
__name(getCourseAndKnowledgeObjects, "getCourseAndKnowledgeObjects");
var generateKnowledgeGraph = task({
  id: "generate-knowledge-graph",
  queue: {
    concurrencyLimit: 1
    // One at a time for graph consistency
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1e4,
    maxTimeoutInMs: 12e4,
    randomize: true
  },
  // Classify errors - abort on fatal, retry on transient
  catchError: /* @__PURE__ */ __name(async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Course not found")) {
      throw new AbortTaskRunError("Course does not exist - cannot proceed");
    }
    if (errorMessage.includes("insufficient_objects")) {
      throw new AbortTaskRunError("Not enough knowledge objects - run precompute-knowledge-objects first");
    }
    if (errorMessage.includes("SUPABASE_URL") || errorMessage.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    return void 0;
  }, "catchError"),
  run: /* @__PURE__ */ __name(async (payload) => {
    const { courseId, forceFresh } = payload;
    logger.info(`[generate-knowledge-graph] Starting for course ${courseId}`);
    metadata.set("stage", "initializing").set("progress", 0).set("courseId", courseId);
    const supabase = (0, import_supabase_js.createClient)(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    metadata.set("stage", "fetching_data");
    const { course, knowledgeObjects, llmIdToDbId, dbIdToLlmId } = await getCourseAndKnowledgeObjects(supabase, courseId);
    logger.info(`Found ${knowledgeObjects.length} knowledge objects for ${course.code}`);
    metadata.set("courseCode", course.code).set("knowledgeObjectsCount", knowledgeObjects.length).set("progress", 10);
    if (knowledgeObjects.length < 2) {
      logger.warn("Not enough knowledge objects for graph generation");
      metadata.set("stage", "insufficient_objects");
      return { success: false, reason: "insufficient_objects" };
    }
    metadata.set("stage", "web_search");
    let webResults = [];
    try {
      webResults = await fetchCourseWebResults(course.code, course.name);
      logger.info(`Fetched ${webResults.length} web results`);
      metadata.set("webResultsCount", webResults.length);
    } catch (error) {
      logger.warn("Web search failed, continuing without", { error });
      metadata.set("webSearchFailed", true);
    }
    metadata.set("progress", 30);
    metadata.set("stage", "llm_inference");
    const messages = [
      { role: "system", content: KNOWLEDGE_GRAPH_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          course_id: courseId,
          course_code: course.code,
          course_name: course.name,
          knowledge_objects: knowledgeObjects.map((ko) => ({
            id: ko.llmId,
            // Use LLM-friendly ID
            type: ko.type,
            name: ko.title,
            summary: ko.summary?.slice(0, 200)
          })),
          web_results: webResults.slice(0, 5).map((w) => ({
            title: w.title,
            snippet: w.snippet?.slice(0, 300)
          }))
        })
      },
      { role: "assistant", content: KNOWLEDGE_GRAPH_FEWSHOT.trim() },
      {
        role: "user",
        content: "Now infer edges between these knowledge_objects in the same JSON format. Use the exact IDs from the knowledge_objects list. Focus on prerequisite relationships and worked example connections."
      }
    ];
    logger.info("Calling LLM for knowledge graph edge inference...");
    const raw = await callLLM(messages, {
      temperature: 0.2,
      maxTokens: 8192
      // Increased for GPT-5 models - graph edges can be large
    });
    logger.debug("LLM raw response preview:", {
      preview: raw.slice(0, 500),
      length: raw.length
    });
    let parsed;
    try {
      parsed = safeParseJSON(raw);
    } catch (parseError) {
      logger.error("Failed to parse LLM response for knowledge graph", {
        error: parseError,
        rawPreview: raw.slice(0, 1e3)
      });
      throw new Error("Failed to parse knowledge graph from LLM response");
    }
    if (!parsed || !Array.isArray(parsed.edges)) {
      logger.error("Invalid LLM response structure", {
        hasEdges: !!parsed?.edges,
        isArray: Array.isArray(parsed?.edges),
        parsedKeys: parsed ? Object.keys(parsed) : []
      });
      throw new Error("LLM response missing edges array");
    }
    logger.info(`Parsed ${parsed.edges.length} graph edges from LLM`);
    metadata.set("progress", 60).set("edgesGenerated", parsed.edges.length);
    const edgeRows = [];
    let skippedEdges = 0;
    for (const e of parsed.edges) {
      const fromDbId = llmIdToDbId.get(e.from_id);
      const toDbId = llmIdToDbId.get(e.to_id);
      if (!fromDbId) {
        logger.debug(`Skipping edge: from_id "${e.from_id}" not found in knowledge objects`);
        skippedEdges++;
        continue;
      }
      if (!toDbId) {
        logger.debug(`Skipping edge: to_id "${e.to_id}" not found in knowledge objects`);
        skippedEdges++;
        continue;
      }
      const validTypes = ["prerequisite", "strengthens", "uses", "similar_to"];
      const edgeType = validTypes.includes(e.type) ? e.type : "prerequisite";
      edgeRows.push({
        course_id: courseId,
        from_object_id: fromDbId,
        // Use actual UUID
        to_object_id: toDbId,
        // Use actual UUID
        edge_type: edgeType,
        confidence: typeof e.confidence === "number" ? Math.min(3, Math.max(1, e.confidence)) : 2,
        evidence: Array.isArray(e.evidence) ? e.evidence : [],
        source_refs: Array.isArray(e.source_refs) ? e.source_refs : []
      });
    }
    logger.info(`Mapped ${edgeRows.length} edges to DB UUIDs (${skippedEdges} skipped due to missing IDs)`);
    metadata.set("stage", "database_update");
    if (forceFresh) {
      const { error: delError } = await supabase.from("course_graph_edges").delete().eq("course_id", courseId);
      if (delError) {
        logger.warn("Failed to delete existing edges", { error: delError });
      }
    }
    if (edgeRows.length > 0) {
      const BATCH_SIZE = 50;
      let insertedCount = 0;
      let failedCount = 0;
      for (let i = 0; i < edgeRows.length; i += BATCH_SIZE) {
        const batch = edgeRows.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(edgeRows.length / BATCH_SIZE);
        metadata.set("insertBatch", `${batchNumber}/${totalBatches}`).set("progress", 60 + Math.round(i / edgeRows.length * 35));
        const { error: insertError } = await supabase.from("course_graph_edges").upsert(batch, {
          onConflict: "course_id,from_object_id,to_object_id",
          ignoreDuplicates: true
        });
        if (insertError) {
          logger.warn(`Failed to insert batch ${batchNumber}/${totalBatches}`, { error: insertError });
          failedCount += batch.length;
        } else {
          insertedCount += batch.length;
          logger.info(`✅ Inserted batch ${batchNumber}/${totalBatches} (${batch.length} edges)`);
        }
      }
      metadata.set("insertedEdges", insertedCount).set("failedEdges", failedCount);
    }
    const stats = {
      prerequisite: parsed.edges.filter((e) => e.type === "prerequisite").length,
      strengthens: parsed.edges.filter((e) => e.type === "strengthens").length,
      uses: parsed.edges.filter((e) => e.type === "uses").length,
      similar_to: parsed.edges.filter((e) => e.type === "similar_to").length
    };
    metadata.set("stage", "completed").set("progress", 100).set("stats", stats);
    logger.info(`[generate-knowledge-graph] Completed for ${course.code}`, stats);
    return {
      success: true,
      courseId,
      edgeCount: edgeRows.length,
      stats
    };
  }, "run")
});

export {
  generateKnowledgeGraph
};
//# sourceMappingURL=chunk-XBLKO5NY.mjs.map
