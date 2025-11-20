# GRASP Backend Deployment Guide

**Status:** Ready to deploy
**Created:** 2025-11-20

All Edge Functions and Trigger.dev worker code is now written. Follow these steps to deploy.

---

## ✅ What Was Just Created

### 6 Supabase Edge Functions
```
supabase/functions/
├── ingest-document/index.ts       - Trigger PDF processing worker
├── rag-chat/index.ts               - RAG chat with document context
├── generate-compression/index.ts   - AI compression notes
├── next-global-question/index.ts   - Spaced repetition algorithm
├── update-question-history/index.ts - SM-2 question history
└── update-mastery/index.ts         - Topic mastery tracking
```

### 1 Trigger.dev Worker
```
trigger/
├── tasks/embed-pdf-v2.ts    - PDF processing (extract + embed with bge-base-en-v1.5)
├── trigger.config.ts         - Trigger.dev configuration
├── package.json              - Dependencies
└── tsconfig.json             - TypeScript config
```

---

## 🚀 Deployment Steps

### STEP 1: Environment Variables

Create `.env` file in root:
```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Trigger.dev
TRIGGER_API_URL=https://api.trigger.dev
TRIGGER_API_KEY=your-trigger-api-key
TRIGGER_SECRET_KEY=your-trigger-secret-key

# AI Services
JINA_API_KEY=your-jina-api-key        # For bge-base-en-v1.5 embeddings (768d)
OPENAI_API_KEY=your-openai-api-key    # For LLM calls in RAG/compression
```

**Get your keys:**
1. **Supabase Service Role Key**: Dashboard → Settings → API → service_role
2. **Trigger.dev API Key**: https://cloud.trigger.dev → Project → API Keys
3. **Jina API Key**: https://jina.ai/embeddings → Sign up → Get API key
4. **OpenAI API Key**: https://platform.openai.com/api-keys

---

### STEP 2: Deploy Supabase Edge Functions

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Set environment variables for Edge Functions
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
supabase secrets set TRIGGER_API_URL=https://api.trigger.dev
supabase secrets set TRIGGER_API_KEY=your-trigger-key
supabase secrets set JINA_API_KEY=your-jina-key
supabase secrets set OPENAI_API_KEY=your-openai-key

# Deploy all Edge Functions
supabase functions deploy ingest-document
supabase functions deploy rag-chat
supabase functions deploy generate-compression
supabase functions deploy next-global-question
supabase functions deploy update-question-history
supabase functions deploy update-mastery

# Verify deployment
supabase functions list
```

**Testing Edge Functions:**
```bash
# Test ingest-document locally
supabase functions serve ingest-document

# In another terminal, test with curl:
curl -i --location --request POST 'http://localhost:54321/functions/v1/ingest-document' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"document_id":"test-doc-id"}'
```

---

### STEP 3: Deploy Trigger.dev Worker

```bash
# Navigate to trigger directory
cd trigger

# Install dependencies
npm install

# Login to Trigger.dev
npx trigger-cli login

# Initialize project (if not already)
npx trigger-cli init

# Update trigger.config.ts with your project ID
# Edit trigger.config.ts and replace proj_YOUR_PROJECT_ID

# Test locally
npm run dev

# Deploy to Trigger.dev
npm run deploy

# Verify deployment
npx trigger-cli list
```

**Update `trigger.config.ts`:**
```typescript
export const config: TriggerConfig = {
  project: "proj_abc123xyz", // ← Replace with your actual project ID from dashboard
  // ... rest of config
};
```

---

### STEP 4: Database Setup (SQL Migrations)

You need to create/verify these tables and functions in Supabase:

**Required Tables:**
- ✅ `documents` (already exists per user)
- ✅ `document_pages` (already exists per user)
- ✅ `page_embeddings_v2` (user said this exists - verify 768d vectors)
- ❓ `page_chunks` (needs creation)
- ❓ `question_history` (needs creation for SM-2 algorithm)

**Required RPC Functions:**
- ✅ `search_document_pages()` (verify it uses page_embeddings_v2 with 768d)
- ❓ `get_next_spaced_question()` (needs creation)

**Run these SQL migrations in Supabase SQL Editor:**

```sql
-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create page_chunks table (if not exists)
CREATE TABLE IF NOT EXISTS page_chunks (
  id BIGSERIAL PRIMARY KEY,
  page_id UUID REFERENCES document_pages(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768),
  context_tags TEXT[],
  chunk_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search on chunks
CREATE INDEX IF NOT EXISTS page_chunks_embedding_idx
  ON page_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 3. Create question_history table for SM-2 spaced repetition
CREATE TABLE IF NOT EXISTS question_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ,
  times_seen INT DEFAULT 0,
  times_correct INT DEFAULT 0,
  next_review TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- Create index for next_review queries
CREATE INDEX IF NOT EXISTS question_history_next_review_idx
  ON question_history (user_id, next_review);

-- 4. Update search_document_pages RPC function (for 768d embeddings)
CREATE OR REPLACE FUNCTION search_document_pages(
  query_embedding VECTOR(768),
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
    dp.page_number,
    dp.text_content AS content,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    d.title AS doc_title,
    d.doc_type,
    d.storage_path AS public_url
  FROM page_embeddings_v2 pe
  JOIN document_pages dp ON pe.page_id = dp.id
  JOIN documents d ON dp.document_id = d.id
  WHERE
    (1 - (pe.embedding <=> query_embedding)) > match_threshold
    AND (filter_course_id IS NULL OR d.course_id = filter_course_id)
    AND (filter_topic_id IS NULL OR d.topic_id = filter_topic_id)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 5. Create get_next_spaced_question RPC function
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
  difficulty INT,
  source_ref TEXT,
  created_at TIMESTAMPTZ
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
    q.difficulty,
    q.source_ref,
    q.created_at
  FROM questions q
  LEFT JOIN question_history qh
    ON q.id = qh.question_id AND qh.user_id = target_user_id
  WHERE q.topic_id = ANY(target_topic_ids)
    AND (
      qh.next_review IS NULL
      OR qh.next_review <= NOW()
    )
  ORDER BY
    qh.next_review ASC NULLS FIRST,
    RANDOM()
  LIMIT 1;
END;
$$;
```

**Verify tables exist:**
```sql
-- Check page_embeddings_v2 structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'page_embeddings_v2';

-- Should have: embedding VECTOR(768)

-- Check if page_chunks exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'page_chunks'
);
```

---

### STEP 5: Storage Bucket RLS Policies

Ensure your storage buckets have proper Row-Level Security:

```sql
-- RLS policy for user-content bucket
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'user-content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'user-content'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS policy for course-materials bucket (public read)
CREATE POLICY "Anyone can read course materials"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-materials');
```

---

### STEP 6: Test End-to-End Flow

1. **Upload a PDF:**
   ```typescript
   // In your app
   const file = /* File from input */
   const { data } = await uploadDocument(file, courseId, topicId)
   // Should upload to storage + create document record
   ```

2. **Trigger Ingestion:**
   ```typescript
   await ingestDocument(documentId)
   // Should call ingest-document Edge Function
   // Which triggers Trigger.dev worker
   // Worker extracts text, generates embeddings, stores in DB
   ```

3. **Check Processing:**
   ```sql
   -- Check document status
   SELECT id, title, status, processing_step, total_pages
   FROM documents
   WHERE id = 'your-document-id';

   -- Should show: status = 'ready' when complete
   ```

4. **Test RAG Chat:**
   ```typescript
   const response = await sendRAGMessage({
     message: "What is the main topic?",
     topicId: "...",
     courseId: "..."
   })
   // Should return answer with citations
   ```

5. **Test Compression:**
   ```typescript
   const notes = await generateCompression({ topicId: "..." })
   // Should return AI-generated study notes
   ```

---

## 🔍 Troubleshooting

### Edge Function Errors

**Check logs:**
```bash
supabase functions logs ingest-document
supabase functions logs rag-chat
```

**Common issues:**
- Missing environment variables → Set with `supabase secrets set`
- Auth errors → Verify JWT token is being sent correctly
- Timeout → Increase function timeout in dashboard

### Trigger.dev Worker Errors

**Check logs in dashboard:**
https://cloud.trigger.dev → Your Project → Runs

**Common issues:**
- PDF download fails → Check signed URL expiration (set to 3600s)
- Jina API errors → Verify JINA_API_KEY is correct
- Database insert fails → Verify tables exist (page_embeddings_v2, page_chunks)

### Database Errors

**Check RPC functions:**
```sql
-- Test search_document_pages
SELECT * FROM search_document_pages(
  ARRAY[/* 768d test vector */]::vector(768),
  NULL, NULL, NULL, 0.5, 5
);

-- Test get_next_spaced_question
SELECT * FROM get_next_spaced_question(
  'user-uuid'::uuid,
  ARRAY['topic-uuid']::uuid[]
);
```

---

## 📊 Monitoring

### Key Metrics to Track

1. **PDF Processing:**
   - Average processing time per page
   - Success rate (ready vs failed)
   - Queue depth in Trigger.dev

2. **RAG Chat:**
   - Response time
   - Retrieval accuracy (similarity scores)
   - LLM token usage

3. **Storage:**
   - Storage bucket usage
   - Number of documents per user
   - Embedding storage size

### Monitoring Queries

```sql
-- Documents by status
SELECT status, COUNT(*) as count
FROM documents
GROUP BY status;

-- Processing time stats
SELECT
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM (processed_at - created_at))) as max_seconds
FROM documents
WHERE status = 'ready';

-- Embeddings count
SELECT COUNT(*) FROM page_embeddings_v2;
SELECT COUNT(*) FROM page_chunks;

-- User activity
SELECT user_id, COUNT(*) as sessions
FROM study_sessions
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY sessions DESC
LIMIT 10;
```

---

## 🎯 Next Steps After Deployment

1. **Test all features thoroughly**
   - Upload PDFs → Verify ingestion works
   - Chat with docs → Verify RAG works
   - Generate notes → Verify compression works
   - Practice questions → Verify spaced repetition works

2. **Monitor costs**
   - Jina AI embeddings: ~$0.02 per 1M tokens
   - OpenAI GPT-4: ~$10 per 1M tokens
   - Supabase: Free tier → Pro at $25/mo
   - Trigger.dev: Free tier → Pro at $20/mo

3. **Optimize performance**
   - Add more vector indexes if search is slow
   - Batch embedding generation
   - Cache frequently accessed embeddings
   - Use CDN for storage if needed

4. **Scale considerations**
   - Increase Trigger.dev concurrency if needed
   - Add database read replicas for heavy traffic
   - Consider switching to HNSW index for >100k vectors

---

## 📝 Deployment Checklist

- [ ] Set all environment variables in `.env`
- [ ] Deploy all 6 Edge Functions
- [ ] Deploy Trigger.dev worker
- [ ] Run SQL migrations (tables + RPC functions)
- [ ] Set up storage bucket RLS policies
- [ ] Test PDF upload + ingestion
- [ ] Test RAG chat
- [ ] Test compression notes generation
- [ ] Test spaced repetition
- [ ] Monitor logs for errors
- [ ] Set up alerts for failed jobs

---

**Last Updated:** 2025-11-20
**Questions?** Check CODEBASE_AUDIT.md for architecture details
