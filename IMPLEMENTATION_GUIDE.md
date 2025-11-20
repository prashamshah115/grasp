# GRASP Backend Implementation Guide
**Adapted for Your Existing PDF Pipeline**

**Status:** Ready to implement
**Your existing setup:** ✅ Trigger.dev worker, ✅ bge-base-en-v1.5 embeddings, ✅ PDF viewer
**What's needed:** Edge Functions for RAG, compression, spaced repetition, mastery

---

## 🎯 What You Already Have (Working)

✅ **PDF Ingestion Pipeline**
- Trigger.dev worker: `embed-pdf-v2`
- Model: bge-base-en-v1.5 (768 dimensions)
- Storage: Supabase Storage (course-materials + user-content)
- Database: documents, document_pages, page_embeddings_v2

✅ **Next.js API Routes**
- `/api/documents/upload` - Upload PDF
- `/api/documents/[id]/status` - Check processing status
- `/api/documents/search` - Semantic search

✅ **Frontend Components**
- PDFUploadViewer - Upload, view, search PDFs
- Status tracking and polling
- PDF.js integration

---

## 🚀 What You Need to Implement

### **4 Edge Functions** (for AI features):
1. `/rag-chat` - LLM tutor with citations
2. `/generate-compression` - AI study notes
3. `/next-global-question` - Spaced repetition
4. `/update-question-history` - SM-2 algorithm
5. `/update-mastery` - Topic mastery tracking

### **1 Updated RPC Function** (for 768d embeddings)

---

## 📋 PART 1: Supabase Setup Checklist

### Step 1: Update RPC Function for 768d Embeddings

Your existing `search_document_pages` needs to be updated to use `page_embeddings_v2`:

```sql
-- Drop old function if exists
DROP FUNCTION IF EXISTS search_document_pages;

-- Create new function for 768d embeddings
CREATE OR REPLACE FUNCTION search_document_pages(
  query_embedding vector(768),
  filter_course_id UUID DEFAULT NULL,
  filter_topic_id UUID DEFAULT NULL,
  filter_user_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  document_id UUID,
  page_number INT,
  content TEXT,
  similarity FLOAT,
  doc_title TEXT,
  doc_type TEXT,
  public_url TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.document_id,
    pe.page_number,
    dp.content,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    d.title AS doc_title,
    d.doc_type,
    d.public_url
  FROM page_embeddings_v2 pe
  JOIN document_pages dp ON pe.document_id = dp.document_id AND pe.page_number = dp.page_number
  JOIN documents d ON pe.document_id = d.id
  WHERE
    (1 - (pe.embedding <=> query_embedding)) > match_threshold
    AND (filter_course_id IS NULL OR d.course_id = filter_course_id)
    AND (filter_topic_id IS NULL OR d.topic_id = filter_topic_id)
    AND (filter_user_id IS NULL OR d.owner_user_id = filter_user_id OR d.owner_user_id IS NULL)
    AND d.status = 'ready'
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
```

### Step 2: Ensure Vector Index Exists

```sql
-- Check if index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'page_embeddings_v2'
AND indexname LIKE '%embedding%';

-- If not, create IVFFLAT index (good for < 1M vectors)
CREATE INDEX IF NOT EXISTS page_embeddings_v2_embedding_idx
  ON page_embeddings_v2
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- For larger datasets (> 100k vectors), use HNSW instead:
-- CREATE INDEX page_embeddings_v2_hnsw_idx
--   ON page_embeddings_v2
--   USING hnsw (embedding vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64);
```

### Step 3: Add Spaced Repetition SQL Function

```sql
-- Function for adaptive question selection
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

## 🔧 PART 2: Edge Functions Implementation

### Create Functions Directory

```bash
mkdir -p supabase/functions/{rag-chat,generate-compression,next-global-question,update-question-history,update-mastery}
```

### Function 1: `/rag-chat`

**File:** `supabase/functions/rag-chat/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RAGRequest {
  message: string
  topicId?: string
  courseId?: string
}

// Helper to generate embeddings via Trigger.dev
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(process.env.TRIGGER_API_URL + '/embed-text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.TRIGGER_SECRET_KEY}`
    },
    body: JSON.stringify({ text })
  })
  const data = await response.json()
  return data.embedding // 768d vector from bge-base-en-v1.5
}

// Helper to call OpenAI (or any LLM)
async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 500
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

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

    const { message, topicId, courseId } = await req.json() as RAGRequest

    console.log('[rag-chat] Request:', { userId: user.id, topicId, courseId, message: message.substring(0, 100) })

    // STEP 1: Generate query embedding
    console.log('[rag-chat] Generating embedding...')
    const queryEmbedding = await generateEmbedding(message)

    // STEP 2: Vector search
    console.log('[rag-chat] Searching documents...')
    const { data: pages, error: searchError } = await supabase.rpc(
      'search_document_pages',
      {
        query_embedding: queryEmbedding,
        filter_course_id: courseId || null,
        filter_topic_id: topicId || null,
        filter_user_id: user.id,
        match_threshold: 0.7,
        match_count: 10
      }
    )

    if (searchError) {
      console.error('[rag-chat] Search error:', searchError)
      throw searchError
    }

    console.log('[rag-chat] Found', pages?.length || 0, 'matching pages')

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
      `[Source ${i + 1}: ${p.doc_title}, Page ${p.page_number} (similarity: ${(p.similarity * 100).toFixed(1)}%)]\n${p.content}`
    ).join('\n\n---\n\n')

    // STEP 4: Build system prompt
    const systemPrompt = `You are GRASP, an AI study tutor for university courses.

RULES:
1. Answer ONLY using the provided context from course materials
2. Always cite sources like "[Source 1]" or "[Source 2]"
3. Be concise (<200 words unless asked for more)
4. If information is missing, say "Not covered in the provided materials"
5. Use technical accuracy appropriate for university students

CONTEXT FROM COURSE MATERIALS:
${context}`

    // STEP 5: Call LLM
    console.log('[rag-chat] Calling LLM...')
    const answer = await callLLM(systemPrompt, message)

    // STEP 6: Format citations
    const citations = pages.map(p => ({
      documentTitle: p.doc_title,
      pageNumber: p.page_number,
      similarity: p.similarity,
      docType: p.doc_type,
      publicUrl: p.public_url
    }))

    console.log('[rag-chat] Success')

    return new Response(
      JSON.stringify({
        answer,
        citations,
        pages: pages.slice(0, 5) // Top 5 for reference
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

### Function 2: `/generate-compression`

**File:** `supabase/functions/generate-compression/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface CompressionRequest {
  topicId: string
}

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.3,
      max_tokens: 1500
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
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

    const { topicId } = await req.json() as CompressionRequest

    console.log('[generate-compression] Request:', { userId: user.id, topicId })

    // STEP 1: Get all pages for this topic (user's + admin docs)
    const { data: pages, error: pagesError } = await supabase
      .from('document_pages')
      .select(`
        content,
        page_number,
        documents!inner(
          id,
          title,
          doc_type,
          topic_id,
          owner_user_id
        )
      `)
      .eq('documents.topic_id', topicId)
      .or(`owner_user_id.is.null,owner_user_id.eq.${user.id}`, { foreignTable: 'documents' })
      .order('documents.id', { ascending: true })
      .order('page_number', { ascending: true })
      .limit(50) // Max 50 pages for context

    if (pagesError) {
      console.error('[generate-compression] Pages error:', pagesError)
      throw pagesError
    }

    console.log('[generate-compression] Found', pages?.length || 0, 'pages')

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

    console.log('[generate-compression] Found', questions?.length || 0, 'questions')

    // STEP 3: Aggregate content
    const content = pages.map(p =>
      `[${p.documents.title}, p.${p.page_number}]\n${p.content.substring(0, 2000)}`
    ).join('\n\n---\n\n')

    // STEP 4: Build prompt
    const systemPrompt = `You are creating ultra-dense exam prep notes for a university course.

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

    // STEP 5: Generate compression
    console.log('[generate-compression] Calling LLM...')
    const compressionContent = await callLLM(systemPrompt, 'Generate the compression notes now.')

    // STEP 6: Save to database
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

    if (saveError) {
      console.error('[generate-compression] Save error:', saveError)
      throw saveError
    }

    console.log('[generate-compression] Success')

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

### Function 3: `/next-global-question`

**File:** `supabase/functions/next-global-question/index.ts`

```typescript
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

    console.log('[next-global-question] Request:', { userId: user.id, courseId })

    // STEP 1: Find weak topics (mastery < 60%)
    const { data: weakTopics } = await supabase
      .from('topic_mastery')
      .select('topic_id, num_attempts, num_correct')
      .eq('user_id', user.id)
      .order('last_practiced_at', { ascending: true, nullsFirst: true })

    const weakTopicIds = weakTopics
      ?.filter(t => t.num_attempts === 0 || (t.num_correct / t.num_attempts) < 0.6)
      .map(t => t.topic_id) || []

    console.log('[next-global-question] Weak topics:', weakTopicIds.length)

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

    // STEP 2: Get next question using spaced repetition
    const { data: question, error: questionError } = await supabase
      .rpc('get_next_spaced_question', {
        target_user_id: user.id,
        target_topic_ids: targetTopicIds
      })

    if (questionError) {
      console.error('[next-global-question] Error:', questionError)
      throw questionError
    }

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

      console.log('[next-global-question] Using fallback question')

      return new Response(
        JSON.stringify(fallbackQuestion),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('[next-global-question] Success, question ID:', question[0].id)

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

### Function 4: `/update-question-history`

**File:** `supabase/functions/update-question-history/index.ts`

```typescript
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

    console.log('[update-question-history] Request:', { userId: user.id, questionId, isCorrect })

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

    if (upsertError) {
      console.error('[update-question-history] Error:', upsertError)
      throw upsertError
    }

    console.log('[update-question-history] Success, next review:', nextReview.toISOString())

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

### Function 5: `/update-mastery`

**File:** `supabase/functions/update-mastery/index.ts`

```typescript
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

    console.log('[update-mastery] Request:', { sessionId })

    // Get session info
    const { data: session, error: sessionError } = await supabase
      .from('study_sessions')
      .select('user_id, topic_id, course_id')
      .eq('id', sessionId)
      .single()

    if (sessionError) {
      console.error('[update-mastery] Session error:', sessionError)
      throw sessionError
    }

    // Get attempts for this session
    const { data: attempts, error: attemptsError } = await supabase
      .from('question_attempts')
      .select('is_correct, question_id, questions!inner(topic_id)')
      .eq('session_id', sessionId)

    if (attemptsError) {
      console.error('[update-mastery] Attempts error:', attemptsError)
      throw attemptsError
    }

    if (!attempts || attempts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No attempts to process' }),
        { status: 200 }
      )
    }

    console.log('[update-mastery] Processing', attempts.length, 'attempts')

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

      if (upsertError) {
        console.error('[update-mastery] Upsert error:', upsertError)
        throw upsertError
      }

      console.log('[update-mastery] Updated topic', topicId, ':', masteryLevel, `(${(accuracy * 100).toFixed(1)}%)`)
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

## 🔧 PART 3: Trigger.dev Enhancement (Optional)

If you want to generate embeddings for RAG chat queries via Trigger.dev instead of calling OpenAI:

**File:** `trigger/embed-text.ts`

```typescript
import { task } from "@trigger.dev/sdk/v3"
import { SentenceTransformer } from 'sentence-transformers'

export const embedText = task({
  id: "embed_text",
  machine: {
    preset: "small-1x" // Fast for single queries
  },
  run: async (payload: { text: string }, { ctx }) => {
    // Load model
    const model = new SentenceTransformer('BAAI/bge-base-en-v1.5')

    // Generate embedding
    const embedding = await model.encode([payload.text])

    return {
      embedding: Array.from(embedding[0]),
      dimensions: 768,
      model: 'bge-base-en-v1.5'
    }
  }
})
```

Then in `/rag-chat`, replace the `generateEmbedding` function with:

```typescript
async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(Deno.env.get('TRIGGER_API_URL') + '/tasks/embed_text/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('TRIGGER_SECRET_KEY')}`
    },
    body: JSON.stringify({ text })
  })
  const job = await response.json()

  // Wait for job to complete (usually <500ms)
  const result = await waitForJob(job.id)
  return result.embedding
}
```

---

## 📦 PART 4: Environment Variables

Add these to your Supabase Edge Functions:

```bash
# Deploy secrets to Supabase
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TRIGGER_SECRET_KEY=tr_dev_...
supabase secrets set TRIGGER_API_URL=https://api.trigger.dev

# If using Trigger.dev for embeddings
supabase secrets set TRIGGER_EMBED_ENDPOINT=/tasks/embed_text/trigger
```

---

## 🚀 PART 5: Deployment Steps

### 1. Deploy Edge Functions

```bash
# Deploy all functions
cd /home/user/grasp

supabase functions deploy rag-chat
supabase functions deploy generate-compression
supabase functions deploy next-global-question
supabase functions deploy update-question-history
supabase functions deploy update-mastery
```

### 2. Test Each Function

**Test RAG Chat:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/rag-chat \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is virtual memory?",
    "courseId": "your-course-id",
    "topicId": "your-topic-id"
  }'
```

**Expected Response:**
```json
{
  "answer": "Virtual memory is...",
  "citations": [
    {
      "documentTitle": "OS Slides",
      "pageNumber": 12,
      "similarity": 0.89,
      "publicUrl": "https://..."
    }
  ],
  "pages": [...]
}
```

**Test Compression:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/generate-compression \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "topicId": "your-topic-id" }'
```

**Test Global Question:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/next-global-question \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "courseId": "your-course-id" }'
```

---

## ✅ PART 6: Frontend Integration

Your existing hooks in `src/hooks/useRAGChat.ts`, `useCompression.ts`, etc. should work immediately once Edge Functions are deployed. They're already calling the right endpoints!

**Example - RAG Chat is ready:**
```typescript
// src/hooks/useRAGChat.ts already calls:
const { data, error } = await supabase.functions.invoke('rag-chat', {
  body: { message, topicId, courseId }
})
```

**Example - Compression is ready:**
```typescript
// src/hooks/useCompression.ts already calls:
const { data, error } = await supabase.functions.invoke('generate-compression', {
  body: { topicId }
})
```

---

## 🎯 What You Need From Me

I need you to:

### 1. ✅ Supabase Dashboard Access
- Go to https://app.supabase.com
- Create project (if not already created)
- Get project URL and keys

### 2. ✅ Run SQL Migrations
Copy the SQL from Part 1 and run in Supabase SQL Editor:
- Updated `search_document_pages` function (768d)
- Vector index check/creation
- `get_next_spaced_question` function

### 3. ✅ Set Environment Variables
In Supabase Dashboard → Settings → Edge Functions → Secrets:
- `OPENAI_API_KEY`
- `TRIGGER_SECRET_KEY`
- `TRIGGER_API_URL`

### 4. ✅ Deploy Edge Functions
```bash
supabase login
supabase link --project-ref your-project-ref
# Then deploy functions (commands above)
```

---

## 📊 Implementation Timeline

| Task | Time | Status |
|------|------|--------|
| Run SQL migrations | 10 min | ⏳ Waiting |
| Create Edge Function files | 20 min | ✅ Ready (code above) |
| Deploy functions | 15 min | ⏳ Waiting |
| Set secrets | 5 min | ⏳ Waiting |
| Test RAG chat | 10 min | ⏳ Waiting |
| Test compression | 10 min | ⏳ Waiting |
| Test spaced repetition | 10 min | ⏳ Waiting |
| Frontend integration | 5 min | ✅ Already done |

**Total:** ~1.5 hours

---

## 🚨 Common Issues

**Issue 1: "Embedding dimension mismatch"**
- Cause: Using wrong dimension (1536 instead of 768)
- Fix: Ensure all RPC calls use `vector(768)`

**Issue 2: "Function not found"**
- Cause: Function not deployed or wrong name
- Fix: Run `supabase functions list` to check

**Issue 3: "Unauthorized"**
- Cause: Missing or invalid auth token
- Fix: Check `Authorization: Bearer` header

**Issue 4: "No context found"**
- Cause: No documents ingested yet
- Fix: Upload PDFs via your existing uploader

---

## ✅ Success Checklist

- [ ] SQL migrations run successfully
- [ ] Vector index exists on `page_embeddings_v2`
- [ ] All 5 Edge Functions deployed
- [ ] Environment variables set
- [ ] RAG chat returns citations
- [ ] Compression generates bullets
- [ ] Spaced repetition selects questions
- [ ] Frontend hooks work without changes

---

**Status:** Ready for implementation
**Next Step:** Run SQL migrations in Supabase, then deploy Edge Functions
**Estimated Time:** 1.5 hours total

Let me know when you're ready to deploy!
