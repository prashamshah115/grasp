# GRASP - Quick Start Guide
**Get up and running in 10 minutes**

---

## ⚡ 1-Minute Setup

```bash
# 1. Set environment variables
export SUPABASE_URL="https://xxxxxxxxxxxxx.supabase.co"
export USER_TOKEN="eyJhbGciOiJIUzI1..."  # Get from login

# 2. Test health
curl -X POST $SUPABASE_URL/functions/v1/health-check

# 3. Done! ✅
```

---

## 🚀 Deploy Everything (5 minutes)

```bash
# Deploy all Edge Functions
cd /home/user/grasp

supabase functions deploy rag-chat && \
supabase functions deploy generate-compression && \
supabase functions deploy next-global-question && \
supabase functions deploy update-question-history && \
supabase functions deploy update-mastery && \
supabase functions deploy trigger-ingest && \
supabase functions deploy health-check

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TRIGGER_SECRET_KEY=tr_dev_...
supabase secrets set TRIGGER_API_URL=https://api.trigger.dev

# Deploy Trigger.dev worker
npx trigger.dev deploy

# Load seed data (via Supabase SQL Editor)
# Copy-paste: supabase/seed/01_sample_course_data.sql

echo "✅ Deployment complete!"
```

---

## 🧪 Test All Functions (3 minutes)

```bash
# Test 1: Health Check
curl -X POST $SUPABASE_URL/functions/v1/health-check

# Test 2: RAG Chat
curl -X POST "$SUPABASE_URL/functions/v1/rag-chat" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is a process?",
    "courseId": "11111111-1111-1111-1111-111111111111"
  }'

# Test 3: Compression
curl -X POST "$SUPABASE_URL/functions/v1/generate-compression" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topicId": "22222222-1111-1111-1111-111111111111"}'

# Test 4: Next Question
curl -X POST "$SUPABASE_URL/functions/v1/next-global-question" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId": "11111111-1111-1111-1111-111111111111"}'

# Test 5: Update History
curl -X POST "$SUPABASE_URL/functions/v1/update-question-history" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"questionId": "33333333-1111-1111-1111-111111111111", "isCorrect": true}'

echo "✅ All tests passed!"
```

---

## 🏗️ Architecture at a Glance

```
Frontend (React + TypeScript)
    ↓
Edge Functions (Deno)
    ├─ /rag-chat → RAG with BGE embeddings
    ├─ /generate-compression → AI study notes
    ├─ /next-global-question → Spaced repetition
    ├─ /update-question-history → SM-2 algorithm
    ├─ /update-mastery → Topic mastery
    ├─ /trigger-ingest → Start PDF processing
    └─ /health-check → System status
    ↓
Trigger.dev Worker (Python + BGE)
    └─ ingest_pdf_bge → Parse PDF + 768d embeddings
    ↓
Supabase Postgres + pgvector
    └─ page_embeddings_v2 → vector(768) for BGE
```

---

## 📂 File Locations

```
/home/user/grasp/
├── supabase/
│   ├── functions/
│   │   ├── rag-chat/index.ts              ← RAG with citations
│   │   ├── generate-compression/index.ts  ← AI study notes
│   │   ├── next-global-question/index.ts  ← Spaced repetition
│   │   ├── update-question-history/index.ts ← SM-2 algorithm
│   │   ├── update-mastery/index.ts        ← Mastery tracking
│   │   ├── trigger-ingest/index.ts        ← Start ingestion
│   │   └── health-check/index.ts          ← System health
│   └── seed/
│       └── 01_sample_course_data.sql      ← Test data
├── trigger/
│   ├── ingest-pdf.ts                      ← BGE worker (768d)
│   └── trigger.config.ts                  ← Trigger.dev config
├── src/
│   ├── lib/
│   │   └── api.ts                         ← API calls to Edge Functions
│   └── hooks/
│       ├── useRAGChat.ts                  ← RAG hook
│       ├── useCompression.ts              ← Compression hook
│       ├── useGlobalPractice.ts           ← Practice hook
│       └── ...
├── DEPLOYMENT_AND_TESTING.md              ← Full guide (this!)
└── QUICK_START.md                         ← This file
```

---

## 🔑 Key IDs (from seed data)

Use these for testing:

```bash
# Course
export COURSE_ID="11111111-1111-1111-1111-111111111111"  # CSE 120

# Topics
export TOPIC_INTRO="22222222-1111-1111-1111-111111111111"     # Intro & Processes
export TOPIC_SCHED="22222222-2222-1111-1111-111111111111"     # Scheduling
export TOPIC_MEMORY="22222222-3333-1111-1111-111111111111"    # Virtual Memory
export TOPIC_FILES="22222222-4444-1111-1111-111111111111"     # File Systems
export TOPIC_IO="22222222-5555-1111-1111-111111111111"        # I/O

# Question (sample)
export QUESTION_ID="33333333-1111-1111-1111-111111111111"     # "What is a process?"

# Exam
export EXAM_ID="44444444-1111-1111-1111-111111111111"         # CSE 120 Midterm
```

---

## 🚨 Troubleshooting One-Liners

```bash
# Check if functions are deployed
supabase functions list

# Check database connection
curl "$SUPABASE_URL/rest/v1/courses?select=*" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY"

# Check Edge Function logs
supabase functions logs rag-chat --tail

# Check document ingestion status
curl "$SUPABASE_URL/rest/v1/documents?select=id,title,status&order=created_at.desc&limit=5" \
  -H "apikey: $SUPABASE_ANON_KEY"

# Restart failed ingestion
# (Get DOCUMENT_ID from above query, then)
curl -X POST "$SUPABASE_URL/functions/v1/trigger-ingest" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"document_id\": \"$DOCUMENT_ID\"}"
```

---

## 📊 Expected Response Times

| Endpoint | Expected | Max |
|----------|----------|-----|
| health-check | 100ms | 500ms |
| rag-chat (no docs) | 300ms | 1s |
| rag-chat (with docs) | 1.5s | 5s |
| generate-compression | 8s | 30s |
| next-global-question | 50ms | 300ms |
| update-question-history | 100ms | 500ms |
| update-mastery | 150ms | 1s |
| trigger-ingest | 200ms | 1s |
| PDF ingestion (10 pages) | 30s | 2min |

---

## ✅ Success Checklist

- [ ] Health check returns `200 OK`
- [ ] All 7 Edge Functions show as `deployed`
- [ ] Trigger.dev shows `ingest_pdf_bge` task
- [ ] Seed data loaded (1 course, 5 topics, 15+ questions)
- [ ] RAG query returns answer (even if "no context")
- [ ] Compression generates bullets
- [ ] Next question returns question object
- [ ] Question history updates successfully
- [ ] Mastery updates successfully
- [ ] Frontend connects without 404 errors

---

## 🆘 Get Help

1. **Check logs first:**
   - Edge Functions: `supabase functions logs <name> --tail`
   - Trigger.dev: https://cloud.trigger.dev → Runs
   - Database: `SELECT * FROM document_ingestion_logs ORDER BY timestamp DESC LIMIT 10;`

2. **Common fixes:**
   - `401 Unauthorized` → Get fresh token (login again)
   - `404 Function not found` → Re-deploy: `supabase functions deploy <name>`
   - `500 OpenAI error` → Check secrets: `supabase secrets list`
   - Document stuck → Check Trigger.dev logs

3. **Full docs:** See `DEPLOYMENT_AND_TESTING.md`

---

**Version:** 1.0
**Last Updated:** 2025-11-20
**Status:** Ready to deploy ✅
