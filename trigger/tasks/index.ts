/**
 * Export all tasks for easy importing
 */
export { ingestDocument } from './ingest-document';
export { generateEmbeddings } from './generate-embeddings';
export { finalizeDocument } from './finalize-document';
export { batchIngestStorage } from './batch-ingest-storage';

// Finals OS precomputation tasks
export { precomputeFinalPacks } from './precompute-final-packs';
export { generateKnowledgeGraph } from './generate-knowledge-graph';
export { precomputeKnowledgeObjects } from './precompute-knowledge-objects';

// Legacy task (deprecated, kept for reference)
export { embedPDFv2 } from './embed-pdf-v2';

