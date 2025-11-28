#!/usr/bin/env npx ts-node
/**
 * End-to-End Test Script for GRASP v4 Pipeline
 * 
 * Tests the complete knowledge pipeline on a single course:
 * 1. Document ingestion (if document provided)
 * 2. Knowledge object extraction
 * 3. Knowledge graph generation
 * 4. Final packs precomputation
 * 5. Web search embedding
 * 6. RAG cache update
 * 
 * Run with: npx tsx test-single-course.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Handle VITE_ prefixed vars
if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
  process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
}

import { createClient } from '@supabase/supabase-js';
import { precomputeKnowledgeObjects } from './tasks/precompute-knowledge-objects';
import { generateKnowledgeGraph } from './tasks/generate-knowledge-graph';
import { precomputeFinalPacks } from './tasks/precompute-final-packs';
import { embedWebResults } from './tasks/embed-web-results';
import { updateRagCache } from './tasks/update-rag-cache';

// Configuration
const CSE120_COURSE_ID = '634a94de-f71c-4c53-9f5d-e9c8bfc22449';
const TEST_COURSE_ID = process.env.TEST_COURSE_ID || CSE120_COURSE_ID;

// Initialize Supabase client for verification
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PipelineStats {
  knowledge_objects: number;
  course_graph_edges: number;
  final_packs: number;
  external_search_results: number;
  rag_chunks: number;
  documents: number;
  document_pages: number;
}

async function verifyPipelineState(courseId: string): Promise<PipelineStats> {
  console.log('\n📊 Verifying pipeline state...\n');
  
  const stats: PipelineStats = {
    knowledge_objects: 0,
    course_graph_edges: 0,
    final_packs: 0,
    external_search_results: 0,
    rag_chunks: 0,
    documents: 0,
    document_pages: 0,
  };

  // Check knowledge_objects
  const { count: koCount } = await supabase
    .from('knowledge_objects')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);
  stats.knowledge_objects = koCount || 0;
  console.log(`  📚 Knowledge Objects: ${stats.knowledge_objects}`);

  // Check course_graph_edges
  const { count: edgeCount } = await supabase
    .from('course_graph_edges')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);
  stats.course_graph_edges = edgeCount || 0;
  console.log(`  🔗 Graph Edges: ${stats.course_graph_edges}`);

  // Check final_packs
  const { count: packCount } = await supabase
    .from('final_packs')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);
  stats.final_packs = packCount || 0;
  console.log(`  📦 Final Packs: ${stats.final_packs}`);

  // Check external_search_results
  const { count: webCount } = await supabase
    .from('external_search_results')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);
  stats.external_search_results = webCount || 0;
  console.log(`  🌐 External Results: ${stats.external_search_results}`);

  // Check rag_chunks
  const { count: ragCount } = await supabase
    .from('rag_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId);
  stats.rag_chunks = ragCount || 0;
  console.log(`  💾 RAG Chunks: ${stats.rag_chunks}`);

  // Check documents
  const { count: docCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('course_id', courseId)
    .eq('status', 'ready');
  stats.documents = docCount || 0;
  console.log(`  📄 Documents (ready): ${stats.documents}`);

  // Check document_pages
  const { data: docs } = await supabase
    .from('documents')
    .select('id')
    .eq('course_id', courseId);
  
  if (docs && docs.length > 0) {
    const docIds = docs.map(d => d.id);
    const { count: pageCount } = await supabase
      .from('document_pages')
      .select('*', { count: 'exact', head: true })
      .in('document_id', docIds);
    stats.document_pages = pageCount || 0;
  }
  console.log(`  📃 Document Pages: ${stats.document_pages}`);

  return stats;
}

async function runPipeline(courseId: string, runAll: boolean = true) {
  console.log('🚀 Starting GRASP v4 Pipeline Test\n');
  console.log(`📍 Course ID: ${courseId}\n`);
  
  // Get initial state
  const initialStats = await verifyPipelineState(courseId);
  
  if (initialStats.documents === 0) {
    console.log('\n⚠️  No documents found for this course!');
    console.log('   Upload a document first or use a different course ID.');
    return;
  }

  try {
    // Step 1: Extract knowledge objects
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📚 Step 1: Extracting Knowledge Objects');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Triggering and waiting...');
    
    const koResult = await precomputeKnowledgeObjects.triggerAndWait({
      courseId,
    });
    if (koResult.ok) {
      console.log('   ✅ Success:', koResult.output?.stats || koResult.output);
    } else {
      console.log('   ❌ Failed:', koResult.error);
    }

    // Step 2: Generate knowledge graph
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔗 Step 2: Generating Knowledge Graph');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Triggering and waiting...');
    
    const kgResult = await generateKnowledgeGraph.triggerAndWait({
      courseId,
      forceFresh: true, // Force regeneration
    });
    if (kgResult.ok) {
      console.log('   ✅ Success:', kgResult.output?.stats || kgResult.output);
    } else {
      console.log('   ❌ Failed:', kgResult.error);
    }

    // Step 3: Embed web results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 Step 3: Embedding Web Search Results');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Triggering and waiting...');
    
    const webResult = await embedWebResults.triggerAndWait({
      courseId,
      forceFresh: false, // Use cache if available
    });
    if (webResult.ok) {
      console.log('   ✅ Success:', webResult.output?.stats || webResult.output);
    } else {
      console.log('   ❌ Failed:', webResult.error);
    }

    // Step 4: Generate final packs
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Step 4: Generating Final Packs');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Triggering and waiting...');
    
    const fpResult = await precomputeFinalPacks.triggerAndWait({
      courseId,
    });
    if (fpResult.ok) {
      console.log('   ✅ Success:', fpResult.output?.stats || fpResult.output);
    } else {
      console.log('   ❌ Failed:', fpResult.error);
    }

    // Step 5: Update RAG cache (needs a document ID)
    const { data: sampleDoc } = await supabase
      .from('documents')
      .select('id')
      .eq('course_id', courseId)
      .eq('status', 'ready')
      .limit(1)
      .single();

    if (sampleDoc) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💾 Step 5: Updating RAG Cache');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('   Triggering and waiting...');
      
      const ragResult = await updateRagCache.triggerAndWait({
        courseId,
        documentId: sampleDoc.id,
      });
      if (ragResult.ok) {
        console.log('   ✅ Success:', ragResult.output?.stats || ragResult.output);
      } else {
        console.log('   ❌ Failed:', ragResult.error);
      }
    }

    // Final verification
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Final Verification');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const finalStats = await verifyPipelineState(courseId);
    
    // Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 Pipeline Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Knowledge Objects: ${initialStats.knowledge_objects} → ${finalStats.knowledge_objects}`);
    console.log(`   Graph Edges:       ${initialStats.course_graph_edges} → ${finalStats.course_graph_edges}`);
    console.log(`   Final Packs:       ${initialStats.final_packs} → ${finalStats.final_packs}`);
    console.log(`   Web Results:       ${initialStats.external_search_results} → ${finalStats.external_search_results}`);
    console.log(`   RAG Chunks:        ${initialStats.rag_chunks} → ${finalStats.rag_chunks}`);
    
    // Success criteria check
    const success = 
      finalStats.knowledge_objects > 0 &&
      finalStats.course_graph_edges > 0 &&
      finalStats.final_packs >= 3 &&
      finalStats.rag_chunks > 0;
    
    if (success) {
      console.log('\n🎉 Pipeline test PASSED! All core components populated.');
    } else {
      console.log('\n⚠️  Pipeline test completed with warnings:');
      if (finalStats.knowledge_objects === 0) console.log('   - No knowledge objects extracted');
      if (finalStats.course_graph_edges === 0) console.log('   - No graph edges created');
      if (finalStats.final_packs < 3) console.log('   - Missing final pack tiers');
      if (finalStats.rag_chunks === 0) console.log('   - RAG cache empty');
    }

    return { success, initialStats, finalStats };
    
  } catch (error) {
    console.error('\n❌ Pipeline error:', error);
    throw error;
  }
}

// Run the pipeline
runPipeline(TEST_COURSE_ID)
  .then(result => {
    if (result?.success) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
