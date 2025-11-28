import { tasks, configure } from "@trigger.dev/sdk/v3";
import dotenv from "dotenv";
import path from "path";

// Load env from parent directory
dotenv.config({ path: path.join(__dirname, "../.env") });

// Configure Trigger.dev with secret key
configure({
  secretKey: process.env.TRIGGER_SECRET_KEY,
});

// Trigger the knowledge pipeline for CSE120
const courseId = "634a94de-f71c-4c53-9f5d-e9c8bfc22449";
const documentId = "4fec779a-6f59-41aa-8f33-5f71699b46cd"; // fsimpl.pdf

async function main() {
  console.log("🚀 Triggering full knowledge pipeline for CSE120...\n");
  
  // Trigger finalize-document which chains:
  // 1. precomputeKnowledgeObjects (wait)
  // 2. Then parallel: generateKnowledgeGraph, precomputeFinalPacks, updateRagCache
  const handle = await tasks.trigger("finalize-document", {
    documentId,
    pageCount: 10,
    embeddingCount: 50,
    chunkCount: 50,
    userId: "test-user"
  });
  
  console.log("✅ Pipeline triggered!");
  console.log(`   Run ID: ${handle.id}`);
  console.log(`   View: https://cloud.trigger.dev/projects/v3/proj_gvongxitjrhgfakcmidx/runs/${handle.id}`);
}

main().catch(console.error);
