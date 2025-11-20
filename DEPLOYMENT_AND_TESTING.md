# GRASP - Complete Deployment & Testing Guide
**Backend with BGE Embeddings (768d)**

Last Updated: 2025-11-20
Status: Ready for deployment

---

## 🎯 Prerequisites Checklist

Before you begin, ensure you have:

- [x] Supabase project created (Phase 1 complete)
- [x] Database schema deployed (Phase 1 complete)
- [ ] Environment variables configured
- [ ] Trigger.dev account created
- [ ] OpenAI API key obtained
- [ ] Supabase CLI installed
- [ ] curl or Postman for testing

---

## 📦 PART 1: Environment Setup

### 1.1 Required Environment Variables

Create a `.env` file for Supabase Edge Functions:

```bash
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (for LLM responses)
OPENAI_API_KEY=sk-...

# Trigger.dev (for PDF ingestion)
TRIGGER_API_URL=https://api.trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...
```

### 1.2 Set Supabase Secrets

```bash
# Deploy secrets to Edge Functions
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TRIGGER_SECRET_KEY=tr_dev_...
supabase secrets set TRIGGER_API_URL=https://api.trigger.dev
```

### 1.3 Frontend Environment (.env.local)

```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🚀 PART 2: Deploy Edge Functions

### 2.1 Deploy All Functions

```bash
cd /home/user/grasp

# Deploy all 7 Edge Functions
supabase functions deploy rag-chat
supabase functions deploy generate-compression
supabase functions deploy next-global-question
supabase functions deploy update-question-history
supabase functions deploy update-mastery
supabase functions deploy trigger-ingest
supabase functions deploy health-check
```

### 2.2 Verify Deployment

```bash
# List all deployed functions
supabase functions list

# Expected output:
# rag-chat (deployed)
# generate-compression (deployed)
# next-global-question (deployed)
# update-question-history (deployed)
# update-mastery (deployed)
# trigger-ingest (deployed)
# health-check (deployed)
```

---

## 🔧 PART 3: Deploy Trigger.dev Worker

### 3.1 Initialize Trigger.dev

```bash
# Install Trigger.dev CLI
npm install -g @trigger.dev/cli

# Initialize project (if not already done)
cd /home/user/grasp
npx trigger.dev init

# Follow prompts:
# - Project name: grasp-pdf-ingestion
# - Choose framework: Other
# - Directory: ./trigger
```

### 3.2 Configure trigger.config.ts

Update `trigger/trigger.config.ts` with your project ID:

```typescript
export default defineConfig({
  project: "proj_YOUR_ACTUAL_PROJECT_ID", // Get from dashboard
  // ... rest of config
});
```

### 3.3 Deploy Worker

```bash
# Deploy to Trigger.dev
npx trigger.dev deploy

# This will:
# 1. Build the worker
# 2. Upload to Trigger.dev
# 3. Enable Python extension
# 4. Install BGE model dependencies
```

### 3.4 Verify Worker Deployment

1. Go to https://cloud.trigger.dev
2. Navigate to your project
3. Check "Tasks" tab
4. You should see: `ingest_pdf_bge` and `embed_text_bge`

---

## 🌱 PART 4: Seed Database

### 4.1 Run Seed Script

```bash
# Connect to your database
psql postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres

# Or via Supabase SQL Editor (Dashboard → SQL Editor)
# Copy and paste content from: supabase/seed/01_sample_course_data.sql
```

### 4.2 Verify Seed Data

```sql
-- Should return 1 course
SELECT * FROM courses;

-- Should return 5 topics
SELECT * FROM topics;

-- Should return 15+ questions
SELECT COUNT(*) FROM questions;

-- Should return 1 exam
SELECT * FROM exams;
```

---

## ✅ PART 5: Health Check & Smoke Tests

### 5.1 Test Health Check Endpoint

```bash
# Set your Supabase URL
export SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"

# Test health check
curl -X POST $SUPABASE_URL/functions/v1/health-check \
  -H "Content-Type: application/json"
```

**Expected Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-20T...",
  "checks": {
    "database": { "status": "pass", "responseTime": 45 },
    "embeddings": { "status": "pass", "count": 0, "dimension": 768 },
    "ingestion": { "status": "pass" },
    "auth": { "status": "pass" }
  },
  "edgeFunctions": {
    "rag-chat": "deployed",
    "generate-compression": "deployed",
    ...
  }
}
```

### 5.2 Test Database Connectivity

```bash
# Get anon key
export SUPABASE_ANON_KEY="eyJhbG..."

# Fetch courses
curl "$SUPABASE_URL/rest/v1/courses?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

**Expected Response (200 OK):**
```json
[
  {
    "id": "11111111-1111-1111-1111-111111111111",
    "code": "CSE 120",
    "name": "Operating Systems",
    "term": "Fall 2024"
  }
]
```

---

## 🧪 PART 6: Edge Function Tests

### 6.1 Prerequisites for Testing

You need:
1. A valid user token (create test user via Supabase Auth)
2. Course/topic/question IDs from seed data

#### Create Test User

```bash
# Via Supabase Dashboard:
# 1. Go to Authentication → Users
# 2. Click "Add user"
# 3. Email: test@grasp.dev
# 4. Password: TestPassword123!
# 5. Click "Create user"

# OR via SQL:
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES (
  'test@grasp.dev',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW()
);
```

#### Get User Token

```bash
# Login to get token
curl -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@grasp.dev",
    "password": "TestPassword123!"
  }'

# Extract access_token from response
export USER_TOKEN="eyJhbG..."
```

---

### 6.2 Test 1: RAG Chat (LLM Tutor)

**Purpose:** Query course materials using RAG

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rag-chat" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is a process?",
    "courseId": "11111111-1111-1111-1111-111111111111",
    "topicId": "22222222-1111-1111-1111-111111111111"
  }'
```

**Expected Response (200 OK):**
```json
{
  "answer": "A process is a program in execution...",
  "citations": [
    {
      "documentTitle": "OS Slides",
      "pageNumber": 5,
      "similarity": 0.89,
      "docType": "slides"
    }
  ],
  "pages": [...]
}
```

**Possible Errors:**
- `401 Unauthorized` → Check token
- `404 No context found` → No documents uploaded yet (expected if no PDFs)
- `500 Embedding failed` → Trigger.dev not configured

---

### 6.3 Test 2: Generate Compression Notes

**Purpose:** AI-generate 10-20 bullet study notes

```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-compression" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "topicId": "22222222-1111-1111-1111-111111111111"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "content": "- **Process**: A program in execution...\n- **Context Switch**: ...",
  "sourceCount": 3
}
```

**Possible Errors:**
- `404 NoContentFound` → No documents for this topic (upload PDFs first)
- `500` → OpenAI API key not configured

---

### 6.4 Test 3: Next Global Question (Spaced Repetition)

**Purpose:** Get next question based on SM-2 algorithm

```bash
curl -X POST "$SUPABASE_URL/functions/v1/next-global-question" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": "11111111-1111-1111-1111-111111111111"
  }'
```

**Expected Response (200 OK):**
```json
{
  "id": "33333333-1111-1111-1111-111111111111",
  "prompt": "What is a process?",
  "options": ["A program in execution", "A file on disk", ...],
  "q_type": "mcq",
  "difficulty": 1
}
```

---

### 6.5 Test 4: Update Question History

**Purpose:** Record answer and update spaced repetition schedule

```bash
curl -X POST "$SUPABASE_URL/functions/v1/update-question-history" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "33333333-1111-1111-1111-111111111111",
    "isCorrect": true
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "nextReview": "2025-11-22T10:30:00Z",
  "timesSeen": 1,
  "timesCorrect": 1,
  "accuracy": 1.0
}
```

---

### 6.6 Test 5: Update Mastery

**Purpose:** Update topic mastery after practice session

**Prerequisites:** Create a study session first

```bash
# 1. Create session
curl -X POST "$SUPABASE_URL/rest/v1/study_sessions" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "user_id": "YOUR_USER_ID",
    "course_id": "11111111-1111-1111-1111-111111111111",
    "topic_id": "22222222-1111-1111-1111-111111111111",
    "mode": "topic_practice",
    "started_at": "2025-11-20T10:00:00Z"
  }'

# Get session_id from response

# 2. Submit some answers
curl -X POST "$SUPABASE_URL/rest/v1/question_attempts" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "SESSION_ID",
    "user_id": "YOUR_USER_ID",
    "question_id": "33333333-1111-1111-1111-111111111111",
    "is_correct": true,
    "user_answer": "A program in execution",
    "time_taken_seconds": 10
  }'

# 3. Update mastery
curl -X POST "$SUPABASE_URL/functions/v1/update-mastery" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "topicsUpdated": 1
}
```

---

### 6.7 Test 6: Trigger Ingestion (Upload & Process PDF)

**Purpose:** Upload PDF and trigger BGE embedding generation

**Prerequisites:** PDF file and document record

```bash
# 1. Upload PDF to Supabase Storage
# (Do this via Dashboard or API)

# 2. Create document record
curl -X POST "$SUPABASE_URL/rest/v1/documents" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "course_id": "11111111-1111-1111-1111-111111111111",
    "topic_id": "22222222-1111-1111-1111-111111111111",
    "storage_bucket": "course-materials",
    "storage_path": "CSE120/week1_slides.pdf",
    "title": "Week 1 Slides",
    "doc_type": "slides",
    "status": "pending"
  }'

# Get document_id from response

# 3. Trigger ingestion
curl -X POST "$SUPABASE_URL/functions/v1/trigger-ingest" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "DOCUMENT_ID"
  }'
```

**Expected Response (200 OK):**
```json
{
  "success": true,
  "documentId": "...",
  "jobId": "...",
  "status": "queued",
  "message": "Document ingestion started. This may take 2-5 minutes."
}
```

**Monitor Progress:**

```bash
# Check document status
curl "$SUPABASE_URL/rest/v1/documents?id=eq.DOCUMENT_ID&select=status,processing_step" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN"

# Expected progression:
# pending → queued → processing → ready
```

**Check Ingestion Logs:**

```bash
curl "$SUPABASE_URL/rest/v1/document_ingestion_logs?document_id=eq.DOCUMENT_ID&select=*&order=timestamp.desc" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## 🔬 PART 7: Integration Tests

### 7.1 Full Practice Loop Test

**Goal:** User takes practice question → submits answer → mastery updates

```bash
# 1. Get next question
QUESTION=$(curl -s -X POST "$SUPABASE_URL/functions/v1/next-global-question" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId": "11111111-1111-1111-1111-111111111111"}')

QUESTION_ID=$(echo $QUESTION | jq -r '.id')

# 2. Create session
SESSION=$(curl -s -X POST "$SUPABASE_URL/rest/v1/study_sessions" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"course_id\": \"11111111-1111-1111-1111-111111111111\",
    \"mode\": \"global_practice\",
    \"started_at\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
  }")

SESSION_ID=$(echo $SESSION | jq -r '.[0].id')

# 3. Submit answer
curl -X POST "$SUPABASE_URL/rest/v1/question_attempts" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"user_id\": \"$USER_ID\",
    \"question_id\": \"$QUESTION_ID\",
    \"is_correct\": true,
    \"user_answer\": \"Test answer\",
    \"time_taken_seconds\": 15
  }"

# 4. Update question history
curl -X POST "$SUPABASE_URL/functions/v1/update-question-history" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"questionId\": \"$QUESTION_ID\",
    \"isCorrect\": true
  }"

# 5. Update mastery
curl -X POST "$SUPABASE_URL/functions/v1/update-mastery" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\"
  }"

echo "✅ Full practice loop completed successfully!"
```

---

### 7.2 Upload → Ingest → RAG Test

**Goal:** Upload PDF → Process with BGE → Query via RAG

```bash
# 1. Upload PDF (via Dashboard)
# 2. Create document + trigger ingestion (see 6.7)
# 3. Wait for status = 'ready' (poll every 30s)
# 4. Test RAG query (see 6.2)

# Automation script:
while true; do
  STATUS=$(curl -s "$SUPABASE_URL/rest/v1/documents?id=eq.$DOCUMENT_ID&select=status" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $USER_TOKEN" | jq -r '.[0].status')

  echo "Document status: $STATUS"

  if [ "$STATUS" = "ready" ]; then
    echo "✅ Ingestion complete!"
    break
  elif [ "$STATUS" = "failed" ]; then
    echo "❌ Ingestion failed!"
    exit 1
  fi

  sleep 30
done

# Now test RAG
curl -X POST "$SUPABASE_URL/functions/v1/rag-chat" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Summarize this document",
    "courseId": "11111111-1111-1111-1111-111111111111",
    "topicId": "22222222-1111-1111-1111-111111111111"
  }'
```

---

## 🚨 PART 8: Troubleshooting

### 8.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired token | Re-login to get fresh token |
| `404 Function not found` | Edge Function not deployed | Run `supabase functions deploy` |
| `500 OPENAI_API_KEY not configured` | Missing env var | Run `supabase secrets set OPENAI_API_KEY=sk-...` |
| `500 Trigger.dev not configured` | Missing Trigger vars | Set `TRIGGER_API_URL` and `TRIGGER_SECRET_KEY` |
| `404 No documents found` | No PDFs uploaded | Upload and ingest at least 1 PDF |
| `Invalid embedding dimension` | Wrong model used | Ensure Trigger.dev uses BGE (768d) |
| Document stuck in `processing` | Worker crashed | Check Trigger.dev logs, retry ingestion |

### 8.2 Check Logs

**Edge Function Logs:**
```bash
# Real-time logs
supabase functions logs rag-chat --tail

# Or via Dashboard: Functions → Select function → Logs
```

**Trigger.dev Logs:**
1. Go to https://cloud.trigger.dev
2. Select your project
3. Go to "Runs" tab
4. Click on specific job run

**Database Logs:**
```sql
-- Check ingestion logs
SELECT * FROM document_ingestion_logs
WHERE document_id = 'YOUR_DOC_ID'
ORDER BY timestamp DESC;

-- Check for errors
SELECT * FROM document_ingestion_logs
WHERE success = false
ORDER BY timestamp DESC
LIMIT 10;
```

### 8.3 Reset & Retry

**Reset Document for Retry:**
```sql
UPDATE documents
SET status = 'pending', processing_step = NULL, error_message = NULL
WHERE id = 'DOCUMENT_ID';
```

Then trigger ingestion again.

---

## 📊 PART 9: Performance Benchmarks

Expected performance after optimization:

| Operation | Target | Acceptable | Action if Exceeded |
|-----------|--------|------------|-------------------|
| Health check | < 200ms | < 500ms | Check DB connectivity |
| RAG query (no docs) | < 300ms | < 1s | Optimize query embedding |
| RAG query (with docs) | < 2s | < 5s | Reduce context size |
| Compression generation | < 10s | < 30s | Use GPT-4 Turbo |
| Next question (SRS) | < 100ms | < 300ms | Add indexes on question_history |
| PDF ingestion (per page) | < 3s | < 5s | Optimize parsing |
| Embedding generation (per page) | < 1s | < 2s | Batch requests |

---

## ✅ PART 10: Deployment Checklist

Use this checklist before going to production:

### Backend
- [ ] All 7 Edge Functions deployed
- [ ] Health check returns `200 OK`
- [ ] Trigger.dev worker deployed
- [ ] BGE model (768d) working
- [ ] All environment variables set
- [ ] Seed data loaded
- [ ] At least 1 PDF ingested successfully
- [ ] RAG query returns citations
- [ ] Compression generates bullets
- [ ] Spaced repetition selects questions

### Database
- [ ] Schema deployed (vector(768) for BGE)
- [ ] Vector indexes created (IVFFLAT)
- [ ] RLS policies enabled
- [ ] Storage buckets created with policies
- [ ] Functions `search_document_pages` and `get_next_spaced_question` exist

### Frontend
- [ ] Environment variables configured
- [ ] All hooks connect to Edge Functions
- [ ] No 404 errors in browser console
- [ ] Auth flow works (login/signup)
- [ ] Practice loop works end-to-end
- [ ] Compression notes display
- [ ] Mastery rings update after practice

### Testing
- [ ] All 6 Edge Function curl tests pass
- [ ] Integration test (practice loop) passes
- [ ] Upload → Ingest → RAG test passes
- [ ] Performance benchmarks met
- [ ] Error handling tested (invalid inputs)

---

## 🎉 Success Criteria

Your deployment is successful when:

1. ✅ Health check shows all systems `healthy`
2. ✅ User can upload PDF → ingestion completes in < 5 min
3. ✅ RAG query returns answer with citations
4. ✅ User can practice questions → mastery updates
5. ✅ Compression notes generate in < 30s
6. ✅ Spaced repetition schedules next review
7. ✅ Frontend displays data without errors

---

## 📞 Next Steps

After successful deployment:

1. **Monitor health endpoint daily**
   ```bash
   curl $SUPABASE_URL/functions/v1/health-check
   ```

2. **Set up alerts** (Supabase Dashboard → Alerts)
   - Alert if health check fails
   - Alert if ingestion success rate < 80%
   - Alert if Edge Function errors spike

3. **Optimize performance**
   - Add HNSW index if > 100k embeddings
   - Cache common RAG queries
   - Add CDN for PDFs

4. **Scale Trigger.dev**
   - Increase concurrency if > 10 PDFs/hour
   - Enable autoscaling

5. **Add more seed data**
   - Complete 75 questions (only 15 in seed now)
   - Add 10+ sample PDFs per course
   - Create multiple exams

---

**Last Updated:** 2025-11-20
**Version:** 1.0
**Status:** Production Ready

Need help? Check logs first:
- Edge Functions: `supabase functions logs <name> --tail`
- Trigger.dev: https://cloud.trigger.dev → Runs
- Database: SQL Editor → `SELECT * FROM document_ingestion_logs`
