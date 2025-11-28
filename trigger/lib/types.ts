// trigger/lib/types.ts
// Shared types for AI-generated educational content

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  raw_content?: string; // Full page content from Tavily
};

// =====================================================
// FINAL PACKS TYPES
// =====================================================

export type BloomLevel = "remember" | "understand" | "apply" | "analyze";

export type FinalPackItem = {
  topic_id: string | null;
  title: string;
  bloom_level: BloomLevel;
  prompt: string;
  short_answer: string | null;
  common_mistakes: string[];
  difficulty: 1 | 2 | 3;
  exam_relevance: 1 | 2 | 3;
  source_refs: string[];
};

export type FinalPacksLLMResponse = {
  course_id: string;
  source_documents: string[];
  packs: {
    essentials: FinalPackItem[];
    must_solve: FinalPackItem[];
    drills: FinalPackItem[];
  };
};

// =====================================================
// KNOWLEDGE OBJECTS TYPES
// =====================================================

export type KnowledgeConcept = {
  type: "concept";
  id: string;
  course_id: string;
  topic_id: string | null;
  name: string;
  short_definition: string;
  detailed_explanation: string;
  bloom_primary: BloomLevel;
  prerequisites?: string[];
  common_mistakes?: string[];
  source_refs?: string[];
  notes?: string | null;
};

export type FormulaVariable = {
  symbol: string;
  name: string;
  units: string | null;
  description: string;
};

export type KnowledgeFormula = {
  type: "formula";
  id: string;
  course_id: string;
  topic_id: string | null;
  name: string;
  latex: string;
  plain: string;
  variables: FormulaVariable[];
  conditions?: string[];
  common_mistakes?: string[];
  example_usage?: string | null;
  source_refs?: string[];
  notes?: string | null;
};

export type KnowledgeWorkedExample = {
  type: "worked_example";
  id: string;
  course_id: string;
  topic_id: string | null;
  title: string;
  problem_statement: string;
  step_by_step_solution: string[];
  final_answer: string;
  concept_ids?: string[];
  common_mistakes?: string[];
  difficulty: 1 | 2 | 3;
  source_refs?: string[];
  notes?: string | null;
};

export type KnowledgeObject =
  | KnowledgeConcept
  | KnowledgeFormula
  | KnowledgeWorkedExample;

export type KnowledgeObjectsLLMResponse = {
  course_id: string;
  knowledge_objects: KnowledgeObject[];
};

// =====================================================
// KNOWLEDGE GRAPH TYPES
// =====================================================

export type EdgeType = "prerequisite" | "strengthens" | "uses" | "similar_to";

export type GraphEdgeLLM = {
  from_id: string;
  to_id: string;
  type: EdgeType;
  confidence: 1 | 2 | 3;
  evidence: string[];
  source_refs: string[];
};

export type KnowledgeGraphLLMResponse = {
  course_id: string;
  edges: GraphEdgeLLM[];
};

// =====================================================
// DATABASE ROW TYPES
// =====================================================

export type KnowledgeObjectRow = {
  id: string;
  course_id: string;
  topic_id: string | null;
  object_type: "concept" | "formula" | "worked_example";
  title: string;
  summary: string;
  bloom_primary: BloomLevel | null;
  prerequisites: string[];
  common_mistakes: string[];
  source_refs: string[];
  payload: KnowledgeObject;
};

export type GraphEdgeRow = {
  course_id: string;
  from_object_id: string;
  to_object_id: string;
  relation: "prerequisite" | "overlap" | "dependent"; // Database column name - maps from EdgeType
  confidence: number; // 0.0 to 1.0 (numeric) - converted from 1-3 scale
  evidence: string[];
  source_refs: string[];
};

