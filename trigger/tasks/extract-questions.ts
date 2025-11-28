import { task, logger, metadata, AbortTaskRunError } from "@trigger.dev/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { callLLM, type ChatMessage } from "../lib/llm";
import { safeParseJSON } from "../lib/utils";

interface ExtractQuestionsPayload {
  documentId: string;
  courseId: string;
  autoPromote?: boolean; // Auto-promote high-confidence questions to questions table
  confidenceThreshold?: number; // Minimum confidence for auto-promotion (default: 0.8)
}

interface ExtractedQuestionLLM {
  question_number: number;
  raw_text: string;
  q_type: "mcq" | "short_answer" | "long_answer" | "true_false" | "fill_blank" | "calculation";
  prompt: string;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
  difficulty: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard
  topic_hint?: string;
  confidence: number; // 0.0 to 1.0
}

interface ExtractQuestionsLLMResponse {
  document_id: string;
  questions: ExtractedQuestionLLM[];
}

// =====================================================
// SYSTEM PROMPT - Question Extraction
// =====================================================

const EXTRACT_QUESTIONS_SYSTEM_PROMPT = `
You are an expert educational content analyzer specializing in extracting questions from academic documents.

INPUT:
- Pages from an exam, homework, quiz, or solution document.
- Course context (code, name).

TASK:
- Identify and extract all questions from the document.
- For each question, parse its structure.

QUESTION TYPES:
- "mcq": Multiple choice with options
- "short_answer": 1-2 sentence response expected
- "long_answer": Paragraph or multi-step response expected
- "true_false": True/False question
- "fill_blank": Fill in the blank
- "calculation": Numeric computation required

EXTRACTION RULES:
1. Preserve original question numbering if present
2. Extract the FULL question text including any context
3. For MCQs, extract all options (A, B, C, D, etc.)
4. If the document is a solution, extract both question and answer
5. Estimate difficulty: 1=easy (recall), 2=medium (apply), 3=hard (analyze/create)
6. Provide topic_hint if you can infer the topic
7. Set confidence based on extraction clarity:
   - 0.9-1.0: Clear, complete question with all parts
   - 0.7-0.9: Clear question, some parts inferred
   - 0.5-0.7: Question identified but incomplete
   - <0.5: Uncertain if this is actually a question

OUTPUT FORMAT:
- Valid JSON only
- No markdown, comments, or backticks

JSON SCHEMA:
{
  "document_id": string,
  "questions": [
    {
      "question_number": number,
      "raw_text": string,
      "q_type": "mcq" | "short_answer" | "long_answer" | "true_false" | "fill_blank" | "calculation",
      "prompt": string,
      "options": string[] | null,
      "correct_answer": string | null,
      "explanation": string | null,
      "difficulty": 1 | 2 | 3,
      "topic_hint": string | null,
      "confidence": number
    }
  ]
}

CONSTRAINTS:
- Maximum 50 questions per document
- Focus on substantive questions, skip trivial ones
- If no questions found, return empty array
`;

// =====================================================
// FEW-SHOT EXAMPLE
// =====================================================

const EXTRACT_QUESTIONS_FEWSHOT = `
{
  "document_id": "doc_123",
  "questions": [
    {
      "question_number": 1,
      "raw_text": "1. (10 points) Consider the following process scheduling scenario. Four processes P1, P2, P3, P4 arrive at time 0 with burst times 8, 4, 9, 5 respectively. Using SJF scheduling, calculate the average waiting time.",
      "q_type": "calculation",
      "prompt": "Consider the following process scheduling scenario. Four processes P1, P2, P3, P4 arrive at time 0 with burst times 8, 4, 9, 5 respectively. Using SJF scheduling, calculate the average waiting time.",
      "options": null,
      "correct_answer": null,
      "explanation": null,
      "difficulty": 2,
      "topic_hint": "CPU Scheduling",
      "confidence": 0.95
    },
    {
      "question_number": 2,
      "raw_text": "2. Which of the following is NOT a necessary condition for deadlock? A) Mutual Exclusion B) Hold and Wait C) Preemption D) Circular Wait",
      "q_type": "mcq",
      "prompt": "Which of the following is NOT a necessary condition for deadlock?",
      "options": ["A) Mutual Exclusion", "B) Hold and Wait", "C) Preemption", "D) Circular Wait"],
      "correct_answer": "C) Preemption",
      "explanation": "Preemption is actually 'No Preemption' which IS a condition. Option C states just 'Preemption' which is the opposite.",
      "difficulty": 1,
      "topic_hint": "Deadlock",
      "confidence": 0.98
    },
    {
      "question_number": 3,
      "raw_text": "3. True or False: A page fault always results in a disk read.",
      "q_type": "true_false",
      "prompt": "A page fault always results in a disk read.",
      "options": ["True", "False"],
      "correct_answer": "False",
      "explanation": "A page fault may not result in disk read if the page is already in memory (e.g., copy-on-write pages).",
      "difficulty": 2,
      "topic_hint": "Virtual Memory",
      "confidence": 0.92
    }
  ]
}
`;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

interface DocumentMeta {
  id: string;
  title: string;
  doc_type: string;
  course_id: string;
}

interface PageMeta {
  id: string;
  page_number: number;
  text_content: string;
}

async function getDocumentWithPages(
  supabase: any,
  documentId: string,
  courseId: string
): Promise<{ document: DocumentMeta; pages: PageMeta[] }> {
  // Get document metadata
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, title, doc_type, course_id")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    throw new Error(`Document not found: ${documentId}`);
  }

  // Verify course match
  if ((document as DocumentMeta).course_id !== courseId) {
    throw new Error(`Document ${documentId} does not belong to course ${courseId}`);
  }

  // Get pages
  const { data: pages, error: pagesError } = await supabase
    .from("document_pages")
    .select("id, page_number, text_content")
    .eq("document_id", documentId)
    .order("page_number", { ascending: true });

  if (pagesError) {
    throw new Error(`Failed to fetch pages: ${pagesError.message}`);
  }

  return { document: document as DocumentMeta, pages: (pages || []) as PageMeta[] };
}

async function getCourseInfo(supabase: any, courseId: string): Promise<{ id: string; code: string; name: string }> {
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, code, name")
    .eq("id", courseId)
    .single();

  if (error || !course) {
    throw new Error(`Course not found: ${courseId}`);
  }

  return course as { id: string; code: string; name: string };
}

// =====================================================
// MAIN TASK
// =====================================================

export const extractQuestions = task({
  id: "extract-questions",
  queue: {
    concurrencyLimit: 3, // Allow multiple extractions in parallel
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 120000,
    randomize: true,
  },
  catchError: async ({ error }) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes("Document not found") || errorMessage.includes("Course not found")) {
      throw new AbortTaskRunError("Document or course does not exist");
    }
    if (errorMessage.includes("SUPABASE_URL")) {
      throw new AbortTaskRunError("Missing required environment variables");
    }
    
    return undefined; // Allow retry for other errors
  },
  run: async (payload: ExtractQuestionsPayload) => {
    const { 
      documentId, 
      courseId, 
      autoPromote = false, 
      confidenceThreshold = 0.8 
    } = payload;
    
    logger.info(`[extract-questions] Starting for document ${documentId}`);
    
    metadata
      .set("stage", "initializing")
      .set("documentId", documentId)
      .set("courseId", courseId)
      .set("progress", 0);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get document and pages
    metadata.set("stage", "fetching_document");
    const { document, pages } = await getDocumentWithPages(supabase, documentId, courseId);
    const course = await getCourseInfo(supabase, courseId);
    
    logger.info(`Found document "${document.title}" with ${pages.length} pages`);
    
    metadata
      .set("documentTitle", document.title)
      .set("docType", document.doc_type)
      .set("pageCount", pages.length)
      .set("courseCode", course.code)
      .set("progress", 20);

    if (pages.length === 0) {
      logger.warn("No pages found, skipping question extraction");
      metadata.set("stage", "completed_no_pages");
      return { success: false, reason: "no_pages" };
    }

    // Prepare page content for LLM (limit to 30 pages, 2000 chars each)
    const pageContent = pages.slice(0, 30).map(p => ({
      page_number: p.page_number,
      text: (p.text_content || "").slice(0, 2000),
    }));

    // Build LLM messages
    metadata.set("stage", "llm_extraction");
    const messages: ChatMessage[] = [
      { role: "system", content: EXTRACT_QUESTIONS_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          document_id: documentId,
          document_title: document.title,
          doc_type: document.doc_type,
          course_code: course.code,
          course_name: course.name,
          pages: pageContent,
        }),
      },
      { role: "assistant", content: EXTRACT_QUESTIONS_FEWSHOT.trim() },
      {
        role: "user",
        content: "Now extract all questions from this document. Return valid JSON with the questions array.",
      },
    ];

    // Call LLM for question extraction - GPT-5 Mini (primary) with Groq fallback
    logger.info("Calling LLM for question extraction...");
    const raw = await callLLM(messages, {
      temperature: 0.1, // Low temperature for accurate extraction
      maxTokens: 12000, // Increased for GPT-5 models - can extract many questions
    });

    // Debug log
    logger.debug("LLM raw response preview:", { 
      preview: raw.slice(0, 500),
      length: raw.length 
    });
    
    metadata.set("progress", 50);

    // Parse LLM response
    let parsed: ExtractQuestionsLLMResponse;
    try {
      parsed = safeParseJSON<ExtractQuestionsLLMResponse>(raw);
    } catch (parseError) {
      logger.error("Failed to parse LLM response", { 
        error: parseError,
        rawPreview: raw.slice(0, 1000)
      });
      throw new Error("Failed to parse questions from LLM response");
    }

    if (!parsed || !Array.isArray(parsed.questions)) {
      logger.error("Invalid LLM response structure", {
        hasQuestions: !!parsed?.questions,
        isArray: Array.isArray(parsed?.questions),
      });
      throw new Error("LLM response missing questions array");
    }

    logger.info(`Extracted ${parsed.questions.length} questions from document`);
    metadata.set("questionsExtracted", parsed.questions.length).set("progress", 70);

    // Insert into extracted_questions table
    metadata.set("stage", "database_insert");
    const rows = parsed.questions.map(q => ({
      id: randomUUID(),
      document_id: documentId,
      course_id: courseId,
      topic_id: null, // Will be linked later via topic_hint
      raw_text: q.raw_text,
      question_number: q.question_number,
      parsed_question: {
        q_type: q.q_type,
        prompt: q.prompt,
        options: q.options || null,
        correct_answer: q.correct_answer || null,
        explanation: q.explanation || null,
        difficulty: q.difficulty,
        topic_hint: q.topic_hint || null,
      },
      extraction_confidence: q.confidence,
      extraction_model: "llama-3.1-8b",
      is_validated: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Delete existing extractions for this document (re-run safety)
    const { error: deleteError } = await supabase
      .from("extracted_questions")
      .delete()
      .eq("document_id", documentId);

    if (deleteError) {
      logger.debug("No existing extractions to delete");
    }

    // Insert new extractions
    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("extracted_questions")
        .insert(rows);

      if (insertError) {
        logger.error("Failed to insert extracted questions", { 
          error: insertError,
          errorMessage: insertError.message 
        });
        throw new Error(`Failed to insert questions: ${insertError.message}`);
      }

      logger.info(`✅ Inserted ${rows.length} extracted questions`);
    }

    metadata.set("progress", 85);

    // Auto-promote high-confidence questions if enabled
    let promotedCount = 0;
    if (autoPromote) {
      metadata.set("stage", "auto_promote");
      const highConfidenceQuestions = parsed.questions.filter(
        q => q.confidence >= confidenceThreshold && q.prompt
      );

      logger.info(`Auto-promoting ${highConfidenceQuestions.length} high-confidence questions`);

      for (const q of highConfidenceQuestions) {
        try {
          // Insert into main questions table
          const { data: promotedQuestion, error: promoteError } = await supabase
            .from("questions")
            .insert({
              id: randomUUID(),
              course_id: courseId,
              topic_id: null,
              text: q.prompt,
              options: q.options || [],
              correct_answer: q.correct_answer || "",
              explanation: q.explanation || "",
              difficulty: q.difficulty,
              question_type: q.q_type === "mcq" ? "multiple_choice" : 
                            q.q_type === "true_false" ? "true_false" : "short_answer",
              source: `Extracted from ${document.title}`,
              created_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (!promoteError && promotedQuestion) {
            // Update extracted_question with promoted ID
            await supabase
              .from("extracted_questions")
              .update({ 
                promoted_question_id: promotedQuestion.id,
                promoted_at: new Date().toISOString()
              })
              .eq("document_id", documentId)
              .eq("question_number", q.question_number);

            promotedCount++;
          }
        } catch (promoteErr) {
          logger.warn(`Failed to promote question ${q.question_number}`, { error: promoteErr });
        }
      }

      logger.info(`✅ Auto-promoted ${promotedCount} questions to main questions table`);
    }

    const stats = {
      total_extracted: parsed.questions.length,
      by_type: {
        mcq: parsed.questions.filter(q => q.q_type === "mcq").length,
        short_answer: parsed.questions.filter(q => q.q_type === "short_answer").length,
        long_answer: parsed.questions.filter(q => q.q_type === "long_answer").length,
        calculation: parsed.questions.filter(q => q.q_type === "calculation").length,
        true_false: parsed.questions.filter(q => q.q_type === "true_false").length,
        fill_blank: parsed.questions.filter(q => q.q_type === "fill_blank").length,
      },
      by_difficulty: {
        easy: parsed.questions.filter(q => q.difficulty === 1).length,
        medium: parsed.questions.filter(q => q.difficulty === 2).length,
        hard: parsed.questions.filter(q => q.difficulty === 3).length,
      },
      avg_confidence: parsed.questions.length > 0 
        ? parsed.questions.reduce((sum, q) => sum + q.confidence, 0) / parsed.questions.length 
        : 0,
      promoted_count: promotedCount,
    };

    metadata
      .set("stage", "completed")
      .set("progress", 100)
      .set("stats", stats);

    logger.info(`[extract-questions] Completed for document ${documentId}`, stats);

    return {
      success: true,
      documentId,
      courseId,
      stats,
    };
  },
});

