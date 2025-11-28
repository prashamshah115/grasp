// Test script to process a SINGLE document for knowledge objects
// Run: npx tsx test-single-doc.ts

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Single document to test
const DOCUMENT_ID = "fa6b91c6-8efa-4e0e-a730-e3cd96481265";
const COURSE_ID = "634a94de-f71c-4c53-9f5d-e9c8bfc22449";

async function testSingleDoc() {
  console.log("🧪 Testing single document knowledge extraction...\n");

  // 1. Get document info
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, title, topic_id, course_id")
    .eq("id", DOCUMENT_ID)
    .single();

  if (docErr || !doc) {
    console.error("❌ Document not found:", docErr);
    return;
  }

  console.log(`📄 Document: ${doc.title}`);

  // 2. Get pages
  const { data: pages, error: pagesErr } = await supabase
    .from("document_pages")
    .select("page_number, text_content")
    .eq("document_id", DOCUMENT_ID)
    .order("page_number")
    .limit(10); // Just first 10 pages

  if (pagesErr || !pages?.length) {
    console.error("❌ No pages found:", pagesErr);
    return;
  }

  console.log(`📑 Pages: ${pages.length}\n`);

  // 3. Build prompt content
  const pageTexts = pages.map(p => ({
    page_number: p.page_number,
    text: (p.text_content || "").slice(0, 1500),
  }));

  // 4. Call OpenAI directly
  const systemPrompt = `You are an expert educational data designer. Extract knowledge objects from this course document.

OUTPUT FORMAT: Valid JSON only, no markdown.
{
  "knowledge_objects": [
    {
      "type": "concept" | "formula" | "worked_example",
      "id": "concept_xxx",
      "name": "...",
      "short_definition": "...",
      "common_mistakes": [],
      "source_refs": []
    }
  ]
}

Extract 3-5 concepts, 1-2 formulas if any, 1 worked example if any.`;

  const userPrompt = JSON.stringify({
    document_title: doc.title,
    pages: pageTexts,
  });

  console.log("🤖 Calling GPT-5 Nano...");
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // GPT-5 Nano only supports temperature=1 (default), so we omit it
      max_completion_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("❌ OpenAI error:", err);
    return;
  }

  const data = await response.json();
  const rawContent = data.choices[0].message.content;
  
  console.log("\n📝 Raw LLM Response:\n", rawContent.slice(0, 500), "...\n");

  // 5. Parse and insert
  let parsed;
  try {
    // Clean JSON if wrapped in markdown
    let jsonStr = rawContent;
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    }
    parsed = JSON.parse(jsonStr.trim());
  } catch (e) {
    console.error("❌ JSON parse error:", e);
    console.log("Raw content:", rawContent);
    return;
  }

  console.log(`✅ Extracted ${parsed.knowledge_objects?.length || 0} objects\n`);

  // 6. Map and insert with proper UUIDs
  // Note: DB constraint expects 'example' not 'worked_example'
  const mapType = (t: string) => t === "worked_example" ? "example" : t;
  
  const rows = (parsed.knowledge_objects || []).map((ko: any) => ({
    id: randomUUID(),
    course_id: COURSE_ID,
    topic_id: null,
    object_type: mapType(ko.type),
    title: ko.name || ko.title || "Untitled",
    summary: ko.short_definition || ko.problem_statement || "",
    content: ko,
    bloom_primary: ko.bloom_primary || null,
    prerequisites: ko.prerequisites || [],
    common_mistakes: ko.common_mistakes || [],
    source_refs: [...(ko.source_refs || []), doc.title],
  }));

  if (rows.length > 0) {
    const { error: insertErr } = await supabase
      .from("knowledge_objects")
      .insert(rows);

    if (insertErr) {
      console.error("❌ Insert error:", insertErr);
    } else {
      console.log(`✅ Inserted ${rows.length} knowledge objects!`);
      
      // Print what was inserted
      for (const row of rows) {
        console.log(`   - [${row.object_type}] ${row.title}`);
      }
    }
  }

  // 7. Verify
  const { count } = await supabase
    .from("knowledge_objects")
    .select("*", { count: "exact", head: true })
    .eq("course_id", COURSE_ID);

  console.log(`\n📊 Total knowledge objects for CSE120: ${count}`);
}

testSingleDoc().catch(console.error);

