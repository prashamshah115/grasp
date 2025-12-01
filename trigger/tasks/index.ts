/**
 * Export all tasks for easy importing
 * 
 * PIPELINE FLOW:
 * ingestDocument → generateEmbeddings → finalizeDocument
 *   ↓
 *   precomputeKnowledgeObjects (blocking)
 *   ↓ (parallel)
 *   ├── generateKnowledgeGraph
 *   ├── precomputeFinalPacks
 *   ├── updateRagCache
 *   ├── embedWebResults (NEW - embeds external search results)
 *   └── extractQuestions (NEW - only for exam/homework docs)
 */

// Core ingestion pipeline
export { ingestDocument } from './ingest-document';
export { generateEmbeddings } from './generate-embeddings';
export { finalizeDocument } from './finalize-document';
export { batchIngestStorage } from './batch-ingest-storage';

// Knowledge extraction and graph tasks
export { precomputeKnowledgeObjects } from './precompute-knowledge-objects';
export { generateKnowledgeGraph } from './generate-knowledge-graph';

// Final pack and RAG tasks
export { precomputeFinalPacks } from './precompute-final-packs';
export { updateRagCache } from './update-rag-cache';

// NEW: Web search, question extraction, and study planning tasks
export { embedWebResults } from './embed-web-results';
export { extractQuestions } from './extract-questions';
export { generateStudyPlan } from './generate-study-plan';

// NEW: Precision Engine tasks (December 2024)
export { extractParagraphs } from './extract-paragraphs';
export { generatePersonalizedStudyPack } from './generate-personalized-study-pack';

// Scheduled tasks
export { dailyKnowledgeGraphRefresh } from './scheduled/daily-knowledge-graph';
export { dailyFinalPacksRefresh } from './scheduled/daily-final-packs';

// Legacy task (deprecated, kept for reference)
export { embedPDFv2 } from './embed-pdf-v2';

