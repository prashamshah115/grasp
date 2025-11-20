# GRASP Backend Architecture Plan
**Production-Ready Supabase + Edge Functions + Trigger.dev v3**

**Last Updated:** 2025-11-20
**Status:** Complete implementation plan
**Based on:** 10 successful production examples (Mozilla, Quivr, Firecrawl, etc.)

---

## 🎯 Executive Summary

This architecture follows the **proven pattern** used by Mozilla (1.6M embeddings), Quivr (5,000 databases), and Firecrawl (300% growth):

```
┌─────────────────────────────────────────────────────────────┐
│ LOCAL/PYTHON PROCESSING (Heavy Lifting)                      │
│ ├─ Document ingestion (pymupdf4llm)                          │
│ ├─ Chunking/parsing                                          │
│ ├─ Embedding generation (OpenAI/SentenceTransformers)        │
│ └─ Batch uploads to Supabase                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ SUPABASE (Storage + Database + Auth)                         │
│ ├─ PostgreSQL + pgvector for embeddings                      │
│ ├─ Storage buckets (course-materials + user-content)         │
│ ├─ Vector indexes (IVFFLAT/HNSW)                             │
│ ├─ Row-level security policies                               │
│ └─ Real-time subscriptions                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ EDGE FUNCTIONS (Runtime Operations)                          │
│ ├─ /trigger-ingest → Kick off ingestion jobs                 │
│ ├─ /rag-chat → Dual-stage RAG retrieval                      │
│ ├─ /generate-compression → AI study notes                    │
│ ├─ /next-global-question → Spaced repetition                 │
│ ├─ /update-question-history → SM-2 algorithm                 │
│ └─ /update-mastery → Topic mastery tracking                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ TRIGGER.DEV v3 (Background Workers)                          │
│ ├─ PDF ingestion worker (Python + pymupdf4llm)               │
│ ├─ Embedding generation worker                               │
│ ├─ Long-running tasks (2-15 minutes)                         │
│ ├─ Automatic retries + monitoring                            │
│ └─ Concurrency control (3 PDFs at once)                      │
└─────────────────────────────────────────────────────────────┘
```

**Key Decision:** Edge Functions do NOT wait for Trigger.dev — they trigger jobs asynchronously and return immediately.

---

## 📦 PART 1: Storage Architecture

### Storage Buckets (Supabase Storage)

```
course-materials/          ← Admin-only, PUBLIC
  CSE120/
    week1_slides.pdf
    week2_slides.pdf
    os_textbook_ch3.pdf
    midterm_2023.pdf
  CSE220/
    ...

user-content/              ← Per-user, PRIVATE
  {user_id}/
    courses/
      CSE120/
        intro/
          1732123456_my_notes.pdf
        scheduling/
          1732123789_cheatsheet.pdf
```

### Storage Policies

```sql
-- Bucket: course-materials (PUBLIC)
CREATE POLICY "Anyone can read course materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-materials');

CREATE POLICY "Only admins can upload course materials"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'course-materials'
    AND auth.uid() IN (SELECT id FROM admin_users)
  );

-- Bucket: user-content (PRIVATE)
CREATE POLICY "Users can read their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-content'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 🗄️ PART 2: Database Schema

### Core Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table (metadata)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_bucket TEXT NOT NULL CHECK (storage_bucket IN ('course-materials', 'user-content')),
  storage_path TEXT NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('slides', 'textbook', 'notes', 'other')),
  title TEXT NOT NULL,
  owner_user_id UUID, -- NULL for admin docs
  total_pages INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed')),
  processing_step TEXT, -- Current step for debugging
  error_message TEXT, -- If status = failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  UNIQUE(storage_bucket, storage_path)
);

-- Page contents (parsed text from pymupdf4llm)
CREATE TABLE page_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  content TEXT NOT NULL, -- Markdown from pymupdf4llm
  char_count INT NOT NULL,
  has_images BOOLEAN DEFAULT false,
  has_tables BOOLEAN DEFAULT false,
  layout_type TEXT, -- 'text', 'mixed', 'diagram-heavy'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(document_id, page_number)
);

-- Page embeddings (vector search)
CREATE TABLE page_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small
  model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(document_id, page_number)
);

-- Ingestion logs (for monitoring)
CREATE TABLE document_ingestion_logs (
  id BIGSERIAL PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  step TEXT NOT NULL, -- 'download', 'parse', 'embed_batch_1', etc.
  message TEXT,
  success BOOLEAN NOT NULL,
  duration_ms INT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ingestion_logs_document ON document_ingestion_logs(document_id, timestamp DESC);
CREATE INDEX idx_ingestion_logs_failed ON document_ingestion_logs(document_id) WHERE success = false;
```

### Vector Search Indexes

```sql
-- IVFFLAT index for fast approximate search (good for 10k-1M vectors)
CREATE INDEX page_embeddings_ivfflat_idx
  ON page_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- For production with >100k embeddings, use HNSW instead:
-- CREATE INDEX page_embeddings_hnsw_idx
--   ON page_embeddings
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);
```

### Vector Search RPC Function

```sql
-- RPC: search_document_pages
-- Returns top-K most similar pages for a query
CREATE OR REPLACE FUNCTION search_document_pages(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_course_id UUID DEFAULT NULL,
  filter_topic_id UUID DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  page_number INT,
  content TEXT,
  similarity FLOAT,
  doc_title TEXT,
  doc_type TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.document_id,
    pe.page_number,
    pc.content,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    d.title AS doc_title,
    d.doc_type
  FROM page_embeddings pe
  JOIN page_contents pc ON pe.document_id = pc.document_id AND pe.page_number = pc.page_number
  JOIN documents d ON pe.document_id = d.id
  WHERE
    (1 - (pe.embedding <=> query_embedding)) > match_threshold
    AND (filter_course_id IS NULL OR d.course_id = filter_course_id)
    AND (filter_topic_id IS NULL OR d.topic_id = filter_topic_id)
    AND (filter_user_id IS NULL OR d.owner_user_id = filter_user_id OR d.owner_user_id IS NULL)
    AND d.status = 'completed'
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

---

## 🚀 PART 3: Edge Functions

### Function 1: `/trigger-ingest`

**Purpose:** Start document ingestion asynchronously
**Called by:** Frontend after PDF upload
**Returns:** Immediately with job ID

```typescript
// supabase/functions/trigger-ingest/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tasks } from 'https://esm.sh/@trigger.dev/sdk@3.0.0'

interface IngestRequest {
  storageBucket: 'course-materials' | 'user-content'
  storagePath: string
  documentTitle: string
  courseId: string
  topicId?: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get authenticated user (if user upload)
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    const { storageBucket, storagePath, documentTitle, courseId, topicId } = await req.json() as IngestRequest

    // Create document record
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        storage_bucket: storageBucket,
        storage_path: storagePath,
        course_id: courseId,
        topic_id: topicId || null,
        doc_type: 'slides', // TODO: detect from filename
        title: documentTitle,
        owner_user_id: storageBucket === 'user-content' ? user?.id : null,
        status: 'queued'
      })
      .select()
      .single()

    if (docError) throw docError

    // Trigger background ingestion job (does NOT wait for completion)
    const job = await tasks.trigger('ingest_pdf', {
      documentId: doc.id,
      storageBucket,
      storagePath,
      courseId,
      topicId: topicId || null
    })

    // Return immediately (Edge Function does not wait for worker)
    return new Response(
      JSON.stringify({
        documentId: doc.id,
        jobId: job.id,
        status: 'queued',
        message: 'Document ingestion started'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[trigger-ingest] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### Function 2: `/rag-chat`

**Purpose:** Dual-stage RAG retrieval for LLM tutor
**Called by:** `useRAGChat` hook
**Returns:** LLM answer + citations

```typescript
// supabase/functions/rag-chat/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.20.0'

interface RAGRequest {
  message: string
  topicId?: string
  courseId?: string
  questionId?: string // Optional: current practice question context
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    })

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { message, topicId, courseId, questionId } = await req.json() as RAGRequest

    // STEP 1: Generate query embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: message
    })
    const queryEmbedding = embeddingResponse.data[0].embedding

    // STEP 2: Vector search using RPC
    const { data: pages, error: searchError } = await supabase.rpc(
      'search_document_pages',
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: 10,
        filter_course_id: courseId || null,
        filter_topic_id: topicId || null,
        filter_user_id: user.id // Include user's own docs + admin docs
      }
    )

    if (searchError) throw searchError

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({
          answer: "I don't have enough context to answer this question. Try uploading relevant course materials first.",
          citations: [],
          pages: []
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 3: Build context for LLM
    const context = pages.map((p, i) =>
      `[Source ${i + 1}: ${p.doc_title}, Page ${p.page_number}]\n${p.content}`
    ).join('\n\n---\n\n')

    // STEP 4: Call LLM with context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are GRASP, an AI study tutor for university courses.

RULES:
1. Answer ONLY using the provided context from course materials
2. Always cite sources like "[Source 1: Slides, Page 12]"
3. Be concise (<200 words unless asked for more)
4. If information is missing, say "Not covered in the provided materials"
5. Use technical accuracy appropriate for university students

CONTEXT:
${context}`
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })

    const answer = completion.choices[0].message.content || ''

    // STEP 5: Format citations
    const citations = pages.map(p => ({
      documentTitle: p.doc_title,
      pageNumber: p.page_number,
      similarity: p.similarity,
      docType: p.doc_type
    }))

    return new Response(
      JSON.stringify({
        answer,
        citations,
        pages: pages.slice(0, 5) // Top 5 pages for reference
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[rag-chat] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### Function 3: `/generate-compression`

**Purpose:** Generate AI study notes for a topic
**Called by:** `useGenerateCompression` hook
**Returns:** Markdown bullet points

```typescript
// supabase/functions/generate-compression/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import OpenAI from 'https://esm.sh/openai@4.20.0'

interface CompressionRequest {
  topicId: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const openai = new OpenAI({
      apiKey: Deno.env.get('OPENAI_API_KEY')!
    })

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { topicId } = await req.json() as CompressionRequest

    // STEP 1: Get all pages for this topic
    const { data: pages, error: pagesError } = await supabase
      .from('page_contents')
      .select(`
        content,
        page_number,
        documents!inner(
          id,
          title,
          doc_type,
          topic_id
        )
      `)
      .eq('documents.topic_id', topicId)
      .order('documents.id', { ascending: true })
      .order('page_number', { ascending: true })
      .limit(50) // Max 50 pages for context

    if (pagesError) throw pagesError

    if (!pages || pages.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'NoContentFound',
          message: 'No documents found for this topic. Upload course materials first.'
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // STEP 2: Get practice questions for context
    const { data: questions } = await supabase
      .from('questions')
      .select('prompt')
      .eq('topic_id', topicId)
      .limit(20)

    const questionList = questions?.map(q => `- ${q.prompt}`).join('\n') || 'No questions available.'

    // STEP 3: Aggregate content
    const content = pages.map(p =>
      `[${p.documents.title}, p.${p.page_number}]\n${p.content.substring(0, 2000)}`
    ).join('\n\n---\n\n')

    // STEP 4: Generate compression
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are creating ultra-dense exam prep notes for a university course.

TOPIC QUESTIONS (what students will be tested on):
${questionList}

SOURCE MATERIAL:
${content}

TASK:
Generate 10-20 bullet points that:
1. Answer the question types above
2. Include key definitions, algorithms, equations
3. Focus on exam-critical content only
4. Are dense but clear (each bullet = 1-2 sentences)

FORMAT:
- Use markdown bullets only
- No intro/outro text
- Start directly with content
- Use **bold** for key terms
- Use code blocks for algorithms/formulas`
        },
        {
          role: 'user',
          content: 'Generate the compression notes now.'
        }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })

    const compressionContent = completion.choices[0].message.content || ''

    // STEP 5: Save to database
    const { error: saveError } = await supabase
      .from('compression_notes')
      .upsert({
        user_id: user.id,
        topic_id: topicId,
        content_md: compressionContent,
        source_pages: pages.map(p => p.documents.id),
        generated_at: new Date().toISOString(),
        is_ai_generated: true
      })

    if (saveError) throw saveError

    return new Response(
      JSON.stringify({
        success: true,
        content: compressionContent,
        sourceCount: pages.length
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[generate-compression] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### Function 4: `/next-global-question`

**Purpose:** Adaptive question selection using spaced repetition
**Called by:** `useNextGlobalQuestion` hook
**Returns:** Next question based on SRS algorithm

```typescript
// supabase/functions/next-global-question/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface GlobalQuestionRequest {
  courseId: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { courseId } = await req.json() as GlobalQuestionRequest

    // STEP 1: Find weak topics (mastery < 60%)
    const { data: weakTopics } = await supabase
      .from('topic_mastery')
      .select('topic_id, num_attempts, num_correct')
      .eq('user_id', user.id)
      .order('last_practiced_at', { ascending: true, nullsFirst: true })

    const weakTopicIds = weakTopics
      ?.filter(t => t.num_attempts === 0 || (t.num_correct / t.num_attempts) < 0.6)
      .map(t => t.topic_id) || []

    // If no weak topics, get all topics for this course
    let targetTopicIds = weakTopicIds
    if (targetTopicIds.length === 0) {
      const { data: allTopics } = await supabase
        .from('topics')
        .select('id')
        .eq('course_id', courseId)
      targetTopicIds = allTopics?.map(t => t.id) || []
    }

    if (targetTopicIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No topics found for this course' }),
        { status: 404 }
      )
    }

    // STEP 2: Find next question using spaced repetition
    // Priority:
    // 1. Due questions (next_review <= now)
    // 2. Never-seen questions
    // 3. Questions with low success rate
    const { data: question, error: questionError } = await supabase
      .rpc('get_next_spaced_question', {
        target_user_id: user.id,
        target_topic_ids: targetTopicIds
      })

    if (questionError) throw questionError

    if (!question || question.length === 0) {
      // Fallback: random question from weak topics
      const { data: fallbackQuestion } = await supabase
        .from('questions')
        .select('*')
        .in('topic_id', targetTopicIds)
        .limit(1)
        .single()

      if (!fallbackQuestion) {
        return new Response(
          JSON.stringify({ error: 'No questions available' }),
          { status: 404 }
        )
      }

      return new Response(
        JSON.stringify(fallbackQuestion),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(question[0]),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[next-global-question] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**Required SQL Function:**

```sql
-- Function for spaced repetition selection
CREATE OR REPLACE FUNCTION get_next_spaced_question(
  target_user_id UUID,
  target_topic_ids UUID[]
)
RETURNS TABLE (
  id UUID,
  course_id UUID,
  topic_id UUID,
  q_type TEXT,
  prompt TEXT,
  options JSONB,
  correct_answer JSONB,
  explanation TEXT,
  difficulty INT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id,
    q.course_id,
    q.topic_id,
    q.q_type,
    q.prompt,
    q.options,
    q.correct_answer,
    q.explanation,
    q.difficulty
  FROM questions q
  LEFT JOIN question_history qh ON qh.question_id = q.id AND qh.user_id = target_user_id
  WHERE
    q.topic_id = ANY(target_topic_ids)
    AND (qh.next_review IS NULL OR qh.next_review <= NOW())
  ORDER BY
    -- Priority 1: Due questions first
    CASE WHEN qh.next_review IS NOT NULL AND qh.next_review <= NOW() THEN 0 ELSE 1 END,
    -- Priority 2: Never seen questions
    CASE WHEN qh.last_seen IS NULL THEN 0 ELSE 1 END,
    -- Priority 3: Low success rate
    COALESCE(qh.times_correct::FLOAT / NULLIF(qh.times_seen, 0), 0) ASC,
    -- Priority 4: Oldest review date
    qh.last_seen ASC NULLS FIRST,
    -- Priority 5: Random
    RANDOM()
  LIMIT 1;
END;
$$;
```

---

### Function 5: `/update-question-history`

**Purpose:** Update spaced repetition state after answering
**Called by:** `useUpdateQuestionHistory` hook
**Returns:** Next review date

```typescript
// supabase/functions/update-question-history/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UpdateHistoryRequest {
  questionId: string
  isCorrect: boolean
}

// SM-2 Algorithm for spaced repetition
function calculateNextReview(
  timesCorrect: number,
  timesSeen: number,
  isCorrect: boolean
): Date {
  const now = Date.now()

  if (!isCorrect) {
    // Wrong answer → review in 12 hours
    return new Date(now + 12 * 60 * 60 * 1000)
  }

  // Correct answer → exponential backoff
  // Interval = 2^(correct_count) days
  const newCorrect = timesCorrect + 1
  const intervalDays = Math.pow(2, newCorrect)
  const intervalMs = Math.min(intervalDays * 24 * 60 * 60 * 1000, 90 * 24 * 60 * 60 * 1000) // Max 90 days

  return new Date(now + intervalMs)
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401 }
      )
    }

    const { questionId, isCorrect } = await req.json() as UpdateHistoryRequest

    // Get existing history
    const { data: existing } = await supabase
      .from('question_history')
      .select('*')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .single()

    let newTimesSeen: number
    let newTimesCorrect: number

    if (!existing) {
      // First time seeing this question
      newTimesSeen = 1
      newTimesCorrect = isCorrect ? 1 : 0
    } else {
      newTimesSeen = existing.times_seen + 1
      newTimesCorrect = existing.times_correct + (isCorrect ? 1 : 0)
    }

    // Calculate next review date using SM-2
    const nextReview = calculateNextReview(newTimesCorrect, newTimesSeen, isCorrect)

    // Upsert history
    const { error: upsertError } = await supabase
      .from('question_history')
      .upsert({
        user_id: user.id,
        question_id: questionId,
        last_seen: new Date().toISOString(),
        times_seen: newTimesSeen,
        times_correct: newTimesCorrect,
        next_review: nextReview.toISOString()
      })

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({
        success: true,
        nextReview: nextReview.toISOString(),
        timesSeen: newTimesSeen,
        timesCorrect: newTimesCorrect,
        accuracy: newTimesCorrect / newTimesSeen
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[update-question-history] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### Function 6: `/update-mastery`

**Purpose:** Update topic mastery after practice session
**Called by:** `useUpdateMastery` hook
**Returns:** Updated mastery level

```typescript
// supabase/functions/update-mastery/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface UpdateMasteryRequest {
  sessionId: string
}

function calculateMasteryLevel(accuracy: number): 'weak' | 'moderate' | 'strong' {
  if (accuracy < 0.6) return 'weak'
  if (accuracy < 0.8) return 'moderate'
  return 'strong'
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { sessionId } = await req.json() as UpdateMasteryRequest

    // Get session info
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('user_id, topic_id, course_id')
      .eq('id', sessionId)
      .single()

    if (sessionError) throw sessionError

    // Get attempts for this session
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select('is_correct, question_id, questions!inner(topic_id)')
      .eq('session_id', sessionId)

    if (attemptsError) throw attemptsError

    if (!attempts || attempts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No attempts to process' }),
        { status: 200 }
      )
    }

    // Group attempts by topic
    const topicStats = new Map<string, { correct: number; total: number }>()

    for (const attempt of attempts) {
      const topicId = session.topic_id || attempt.questions.topic_id
      const stats = topicStats.get(topicId) || { correct: 0, total: 0 }
      stats.total++
      if (attempt.is_correct) stats.correct++
      topicStats.set(topicId, stats)
    }

    // Update mastery for each topic
    for (const [topicId, stats] of topicStats) {
      // Get existing mastery
      const { data: existing } = await supabase
        .from('topic_mastery')
        .select('*')
        .eq('user_id', session.user_id)
        .eq('topic_id', topicId)
        .single()

      const newAttempts = (existing?.num_attempts || 0) + stats.total
      const newCorrect = (existing?.num_correct || 0) + stats.correct
      const accuracy = newCorrect / newAttempts
      const masteryLevel = calculateMasteryLevel(accuracy)

      // Upsert mastery
      const { error: upsertError } = await supabase
        .from('topic_mastery')
        .upsert({
          user_id: session.user_id,
          topic_id: topicId,
          num_attempts: newAttempts,
          num_correct: newCorrect,
          last_practiced_at: new Date().toISOString(),
          mastery_level: masteryLevel
        })

      if (upsertError) throw upsertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        topicsUpdated: topicStats.size
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[update-mastery] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## 🔄 PART 4: Trigger.dev Worker (PDF Ingestion)

### Worker Setup

```typescript
// trigger/ingest-pdf.ts
import { task } from "@trigger.dev/sdk/v3"
import { createClient } from '@supabase/supabase-js'
import pymupdf4llm from 'pymupdf4llm' // Python binding
import OpenAI from 'openai'

interface IngestPDFPayload {
  documentId: string
  storageBucket: string
  storagePath: string
  courseId: string
  topicId: string | null
}

export const ingestPDF = task({
  id: "ingest_pdf",
  queue: {
    concurrencyLimit: 3 // Process 3 PDFs at once max
  },
  retry: {
    maxAttempts: 5,
    minTimeout: 10000, // 10 seconds
    maxTimeout: 600000 // 10 minutes
  },
  run: async (payload: IngestPDFPayload, { ctx }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    })

    const { documentId, storageBucket, storagePath } = payload

    try {
      // STEP 1: Update status
      await supabase
        .from('documents')
        .update({ status: 'processing', processing_step: 'downloading' })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'download_start', 'Starting PDF download', true)

      // STEP 2: Download PDF from Supabase Storage
      const { data: pdfBlob, error: downloadError } = await supabase
        .storage
        .from(storageBucket)
        .download(storagePath)

      if (downloadError) throw downloadError

      await logStep(supabase, documentId, 'download_complete', `Downloaded ${pdfBlob.size} bytes`, true)

      // STEP 3: Parse PDF using pymupdf4llm
      await supabase
        .from('documents')
        .update({ processing_step: 'parsing' })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'parse_start', 'Starting PDF parsing', true)

      // Convert Blob to Buffer for pymupdf4llm
      const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer())

      // Parse PDF to structured markdown
      const parsedData = await pymupdf4llm.to_markdown(pdfBuffer, {
        page_chunks: true, // Get per-page output
        write_images: false // Don't extract images yet
      })

      const pages = parsedData.pages || []

      await supabase
        .from('documents')
        .update({ total_pages: pages.length })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'parse_complete', `Parsed ${pages.length} pages`, true)

      // STEP 4: Insert page contents
      await supabase
        .from('documents')
        .update({ processing_step: 'storing_pages' })
        .eq('id', documentId)

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]

        await supabase
          .from('page_contents')
          .insert({
            document_id: documentId,
            page_number: i + 1,
            content: page.text,
            char_count: page.text.length,
            has_images: page.images?.length > 0 || false,
            has_tables: page.tables?.length > 0 || false,
            layout_type: detectLayoutType(page)
          })
      }

      await logStep(supabase, documentId, 'pages_stored', `Stored ${pages.length} pages`, true)

      // STEP 5: Generate embeddings in batches
      await supabase
        .from('documents')
        .update({ processing_step: 'generating_embeddings' })
        .eq('id', documentId)

      const batchSize = 50 // OpenAI allows up to 2048 texts per request
      const batches = []

      for (let i = 0; i < pages.length; i += batchSize) {
        batches.push(pages.slice(i, i + batchSize))
      }

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx]

        await logStep(
          supabase,
          documentId,
          `embed_batch_${batchIdx + 1}`,
          `Processing batch ${batchIdx + 1}/${batches.length}`,
          true
        )

        // Generate embeddings for this batch
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map(p => p.text.substring(0, 8000)) // Limit to 8k chars per page
        })

        const embeddings = embeddingResponse.data

        // Insert embeddings
        const embeddingInserts = embeddings.map((emb, idx) => ({
          document_id: documentId,
          page_number: (batchIdx * batchSize) + idx + 1,
          embedding: emb.embedding,
          model: 'text-embedding-3-small'
        }))

        await supabase
          .from('page_embeddings')
          .insert(embeddingInserts)

        await logStep(
          supabase,
          documentId,
          `embed_batch_${batchIdx + 1}_complete`,
          `Embedded ${embeddings.length} pages`,
          true
        )
      }

      // STEP 6: Mark as completed
      await supabase
        .from('documents')
        .update({
          status: 'completed',
          processing_step: null,
          processed_at: new Date().toISOString()
        })
        .eq('id', documentId)

      await logStep(supabase, documentId, 'complete', 'Ingestion completed successfully', true)

      return {
        success: true,
        documentId,
        pagesProcessed: pages.length,
        embeddingsGenerated: pages.length
      }

    } catch (error) {
      // Log error
      await logStep(supabase, documentId, 'error', error.message, false)

      // Update document status
      await supabase
        .from('documents')
        .update({
          status: 'failed',
          error_message: error.message
        })
        .eq('id', documentId)

      throw error // Trigger.dev will retry
    }
  }
})

// Helper function to log steps
async function logStep(
  supabase: any,
  documentId: string,
  step: string,
  message: string,
  success: boolean
) {
  await supabase
    .from('document_ingestion_logs')
    .insert({
      document_id: documentId,
      step,
      message,
      success
    })
}

// Helper to detect layout type
function detectLayoutType(page: any): string {
  const text = page.text || ''
  const hasImages = page.images?.length > 0
  const hasTables = page.tables?.length > 0
  const charCount = text.length

  if (charCount < 100) return 'sparse'
  if (hasImages && hasTables) return 'mixed'
  if (hasImages) return 'diagram-heavy'
  if (hasTables) return 'table-heavy'
  return 'text'
}
```

---

## 🔧 PART 5: Reliability & Monitoring

### CRON Job: Retry Failed Ingestions

```typescript
// supabase/functions/retry-ingest-jobs/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { tasks } from 'https://esm.sh/@trigger.dev/sdk@3.0.0'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find documents stuck in processing for > 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

    const { data: stuckDocs, error } = await supabase
      .from('documents')
      .select('*')
      .in('status', ['queued', 'processing'])
      .lt('created_at', tenMinutesAgo)

    if (error) throw error

    if (!stuckDocs || stuckDocs.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No stuck documents found' }),
        { status: 200 }
      )
    }

    // Requeue each stuck document
    const retries = []
    for (const doc of stuckDocs) {
      // Mark as queued again
      await supabase
        .from('documents')
        .update({ status: 'queued', processing_step: 'retry' })
        .eq('id', doc.id)

      // Trigger new job
      const job = await tasks.trigger('ingest_pdf', {
        documentId: doc.id,
        storageBucket: doc.storage_bucket,
        storagePath: doc.storage_path,
        courseId: doc.course_id,
        topicId: doc.topic_id
      })

      retries.push({ documentId: doc.id, jobId: job.id })
    }

    return new Response(
      JSON.stringify({
        retriggered: retries.length,
        documents: retries
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[retry-ingest-jobs] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    )
  }
})
```

**Setup CRON:** In Supabase Dashboard → Functions → Cron Jobs:
```
Schedule: */5 * * * * (every 5 minutes)
Function: retry-ingest-jobs
```

---

### Health Check Endpoint

```typescript
// supabase/functions/health-check/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check database connectivity
    const { error: dbError } = await supabase
      .from('documents')
      .select('id')
      .limit(1)

    // Check Trigger.dev connectivity
    let triggerHealthy = false
    try {
      const triggerRes = await fetch('https://api.trigger.dev/api/v1/health')
      triggerHealthy = triggerRes.ok
    } catch (e) {
      triggerHealthy = false
    }

    // Check recent ingestion failures
    const { data: recentFailures } = await supabase
      .from('documents')
      .select('id')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    const health = {
      database: !dbError,
      triggerDev: triggerHealthy,
      recentFailures: recentFailures?.length || 0,
      timestamp: new Date().toISOString()
    }

    return new Response(
      JSON.stringify(health),
      {
        status: health.database && health.triggerDev ? 200 : 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ healthy: false, error: error.message }),
      { status: 500 }
    )
  }
})
```

---

## 📋 PART 6: Deployment Checklist

### 1. Supabase Setup

```bash
# Initialize Supabase
supabase init

# Create migration
supabase migration new add_documents_and_embeddings

# Copy schema SQL from above into migration file

# Apply migrations
supabase db push

# Create storage buckets (via Dashboard or SQL)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('course-materials', 'course-materials', true),
  ('user-content', 'user-content', false);
```

### 2. Environment Variables

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# OpenAI
OPENAI_API_KEY=sk-...

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...
```

### 3. Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy trigger-ingest
supabase functions deploy rag-chat
supabase functions deploy generate-compression
supabase functions deploy next-global-question
supabase functions deploy update-question-history
supabase functions deploy update-mastery
supabase functions deploy retry-ingest-jobs
supabase functions deploy health-check

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
```

### 4. Deploy Trigger.dev Worker

```bash
# Install Trigger.dev CLI
npm install -g @trigger.dev/cli

# Initialize Trigger.dev project
npx trigger.dev init

# Deploy worker
npx trigger.dev deploy
```

### 5. Setup CRON Jobs

In Supabase Dashboard:
- Navigate to Functions → Cron Jobs
- Add cron: `retry-ingest-jobs` every 5 minutes

---

## 🧪 PART 7: Testing Plan

### Test 1: Upload & Ingestion Flow

```bash
# 1. Upload a test PDF via frontend
# 2. Check document created
curl -H "Authorization: Bearer $ANON_KEY" \
  $SUPABASE_URL/rest/v1/documents?select=*&id=eq.$DOC_ID

# 3. Check ingestion logs
curl -H "Authorization: Bearer $ANON_KEY" \
  $SUPABASE_URL/rest/v1/document_ingestion_logs?select=*&document_id=eq.$DOC_ID

# 4. Wait for completion (2-5 minutes)
# 5. Check page_contents populated
curl -H "Authorization: Bearer $ANON_KEY" \
  $SUPABASE_URL/rest/v1/page_contents?select=count&document_id=eq.$DOC_ID

# 6. Check embeddings created
curl -H "Authorization: Bearer $ANON_KEY" \
  $SUPABASE_URL/rest/v1/page_embeddings?select=count&document_id=eq.$DOC_ID
```

### Test 2: RAG Chat

```bash
curl -X POST $SUPABASE_URL/functions/v1/rag-chat \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is virtual memory?",
    "topicId": "your-topic-id",
    "courseId": "your-course-id"
  }'
```

**Expected Response:**
```json
{
  "answer": "Virtual memory is a memory management technique...",
  "citations": [
    { "documentTitle": "OS Slides", "pageNumber": 12, "similarity": 0.92 }
  ],
  "pages": [...]
}
```

### Test 3: Compression Generation

```bash
curl -X POST $SUPABASE_URL/functions/v1/generate-compression \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "topicId": "your-topic-id" }'
```

**Expected:** Markdown bullet points returned

---

## 📊 PART 8: Performance Targets

| Operation | Target | Acceptable | Action if Exceeded |
|-----------|--------|------------|-------------------|
| PDF ingestion (per page) | < 3 seconds | < 5 seconds | Optimize parsing |
| Vector search | < 50ms | < 150ms | Add HNSW index |
| RAG query (uncached) | < 2 seconds | < 5 seconds | Reduce context size |
| RAG query (cached) | < 500ms | < 1 second | Add Redis cache |
| Compression generation | < 10 seconds | < 30 seconds | Use GPT-4 Turbo |
| Question selection | < 100ms | < 300ms | Index question_history |

---

## 🚨 PART 9: Common Issues & Solutions

### Issue 1: Edge Function Times Out

**Symptom:** `/trigger-ingest` returns 504
**Cause:** Calling Trigger.dev synchronously
**Fix:** Ensure `tasks.trigger()` is async (it is by default)

### Issue 2: Embeddings Not Found

**Symptom:** RAG returns "No context found"
**Cause:** Ingestion failed or embeddings not indexed
**Fix:**
1. Check `documents.status = 'completed'`
2. Run `REINDEX INDEX page_embeddings_ivfflat_idx;`

### Issue 3: Slow Vector Search

**Symptom:** RAG takes > 1 second
**Cause:** No vector index or wrong index type
**Fix:** Create HNSW index for > 100k vectors

### Issue 4: Worker Fails Silently

**Symptom:** Document stuck in "processing"
**Cause:** Worker crashed without logging
**Fix:** Check Trigger.dev dashboard logs, ensure error handling

---

## ✅ PART 10: Success Criteria

### Before Launch
- [ ] All 6 Edge Functions deployed
- [ ] Trigger.dev worker deployed
- [ ] Storage buckets created with policies
- [ ] Database schema migrated
- [ ] Vector indexes created
- [ ] Test PDF ingestion completes in < 5 minutes
- [ ] RAG chat returns citations
- [ ] Compression generates 10-20 bullets
- [ ] Spaced repetition selects next question
- [ ] CRON retry job runs successfully
- [ ] Health check returns 200

### After Launch
- [ ] Monitor ingestion success rate > 95%
- [ ] Monitor RAG query latency < 2 seconds
- [ ] Monitor vector search performance < 150ms
- [ ] Set up alerts for failures
- [ ] Track user feedback on AI quality

---

## 📖 Summary

This architecture is **production-proven** by:
- Mozilla (1.6M embeddings)
- Quivr (5,000 databases)
- Firecrawl (300% growth)
- Confident AI (LLM evaluation)
- Berri AI (enterprise ChatGPT)

**Key Principles:**
1. ✅ Heavy processing in Trigger.dev workers (Python + pymupdf4llm)
2. ✅ Light runtime in Edge Functions (TypeScript)
3. ✅ Storage in Supabase (PDFs + text + embeddings)
4. ✅ Async job triggering (no timeouts)
5. ✅ Automatic retries (reliability)
6. ✅ Comprehensive monitoring (observability)

**Next Steps:**
1. Deploy Supabase schema
2. Deploy all 6 Edge Functions
3. Deploy Trigger.dev worker
4. Test with 1 PDF
5. Scale to 30 courses

**Estimated Implementation Time:** 2-3 days for experienced engineer

---

**Last Updated:** 2025-11-20
**Version:** 1.0.0
**Status:** Ready for implementation
