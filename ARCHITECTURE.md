# GRASP - Complete System Architecture & Implementation Status

**Last Updated:** 2025-11-20
**Version:** 1.0
**Status:** Backend Complete ✅ | Frontend 95% ✅ | Ready for Deployment

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (React + TypeScript)                           │
│ ├─ Components: 40+ React components (shadcn/ui)        │
│ ├─ State: Zustand + React Query                        │
│ ├─ Routing: React Router v7                            │
│ └─ API Layer: Typed Supabase client                    │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ EDGE FUNCTIONS (Supabase + Deno)                        │
│ ├─ /rag-chat → RAG with BGE 768d embeddings + LLM     │
│ ├─ /generate-compression → AI study notes (10-20)      │
│ ├─ /next-global-question → Spaced repetition (SM-2)    │
│ ├─ /update-question-history → SRS schedule             │
│ ├─ /update-mastery → Topic mastery tracking            │
│ ├─ /trigger-ingest → PDF processing orchestration      │
│ └─ /health-check → System health monitoring            │
└────────────────────────┬────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────────┐    ┌──────────────────────────┐
│ TRIGGER.DEV WORKER   │    │ SUPABASE POSTGRES        │
│ (Python + BGE)       │    │ + pgvector               │
├──────────────────────┤    ├──────────────────────────┤
│ • PDF Parsing        │    │ • courses, topics        │
│   (pymupdf4llm)      │    │ • questions, exams       │
│ • BGE Embeddings     │    │ • documents              │
│   (768 dimensions)   │    │ • document_pages         │
│ • Batch Storage      │    │ • page_embeddings_v2     │
│                      │    │   - vector(768) for BGE  │
│ Tasks:               │    │ • question_history       │
│ - ingest_pdf_bge     │    │ • topic_mastery          │
│ - embed_text_bge     │    │ • compression_notes      │
└──────────────────────┘    │ • study_sessions         │
                            │ • question_attempts      │
                            └──────────────────────────┘
```

---

## 📊 Implementation Status

### ✅ **Backend - 100% Complete**

| Component | Status | Lines | Files |
|-----------|--------|-------|-------|
| Edge Functions | ✅ Complete | ~1,200 | 7 functions |
| Trigger.dev Worker | ✅ Complete | ~250 | 2 tasks |
| Database Schema | ✅ Deployed (Phase 1) | N/A | Via Supabase |
| Vector Indexes | ✅ Deployed | N/A | IVFFLAT for 768d |
| RPC Functions | ✅ Deployed | N/A | search_document_pages, etc. |
| Storage Buckets | ✅ Configured | N/A | course-materials, user-content |
| Health Monitoring | ✅ Complete | ~200 | 1 endpoint |

### ✅ **Frontend - 95% Complete**

| Component | Status | Count | Notes |
|-----------|--------|-------|-------|
| React Components | ✅ Complete | 40+ | All UI built |
| React Query Hooks | ✅ Complete | 23 hooks | All connected |
| API Layer | ✅ Complete | 20 functions | All Edge Functions called |
| State Management | ✅ Complete | 1 store | Zustand |
| Routing | ✅ Complete | 10+ routes | React Router |
| UI Components | ✅ Complete | 30+ | shadcn/ui |
| Auth System | ⚠️ Mock Only | N/A | Need Login/Signup UI |

**Missing (5%):**
- LoginForm.tsx
- SignupForm.tsx
- Real auth integration (currently mock user)

### ✅ **Data - 20% Complete**

| Component | Status | Count | Notes |
|-----------|--------|-------|-------|
| Courses | ✅ Seed data ready | 1 | CSE 120 |
| Topics | ✅ Seed data ready | 5 | Per course |
| Questions | ⚠️ Partial | 15 | Need 60 more |
| Documents/PDFs | ❌ None | 0 | Need to upload |
| Embeddings | ❌ None | 0 | Generated after PDF upload |

---

## 🔧 What's Implemented

### **Backend Edge Functions (Ready to Deploy)**

#### 1. `/rag-chat` - RAG with Citations
**Purpose:** Answer questions using course materials with BGE embeddings

**Request:**
```typescript
{
  message: string
  courseId?: string
  topicId?: string
}
```

**Response:**
```typescript
{
  answer: string
  citations: Array<{
    documentTitle: string
    pageNumber: number
    similarity: number
  }>
  pages: Array<PageInfo>
}
```

**Features:**
- BGE embedding generation (768d)
- Vector similarity search
- OpenAI GPT-4 Turbo
- Citation tracking
- Error handling + retries

---

#### 2. `/generate-compression` - AI Study Notes
**Purpose:** Generate 10-20 bullet study notes for a topic

**Request:**
```typescript
{
  topicId: string
}
```

**Response:**
```typescript
{
  success: boolean
  content: string // Markdown bullets
  sourceCount: number
}
```

**Features:**
- Aggregates all pages for topic
- Uses practice questions for context
- GPT-4 Turbo for quality
- Saves to compression_notes table

---

#### 3. `/next-global-question` - Spaced Repetition
**Purpose:** Select next question using SM-2 algorithm

**Request:**
```typescript
{
  courseId: string
}
```

**Response:**
```typescript
{
  id: string
  prompt: string
  options: string[]
  q_type: 'mcq' | 'short_answer'
  difficulty: number
}
```

**Features:**
- Prioritizes weak topics (< 60% mastery)
- SM-2 spaced repetition
- Due date scheduling
- Success rate tracking

---

#### 4. `/update-question-history` - SRS Schedule
**Purpose:** Update review schedule after answer

**Request:**
```typescript
{
  questionId: string
  isCorrect: boolean
}
```

**Response:**
```typescript
{
  success: boolean
  nextReview: string
  timesSeen: number
  timesCorrect: number
  accuracy: number
}
```

**Features:**
- SM-2 algorithm implementation
- Exponential backoff (2^n days)
- 12-hour retry for wrong answers
- 90-day max interval

---

#### 5. `/update-mastery` - Topic Mastery
**Purpose:** Update topic mastery after practice session

**Request:**
```typescript
{
  sessionId: string
}
```

**Response:**
```typescript
{
  success: boolean
  topicsUpdated: number
}
```

**Features:**
- Groups attempts by topic
- Calculates mastery level (weak/moderate/strong)
- Updates topic_mastery table
- Per-topic accuracy tracking

---

#### 6. `/trigger-ingest` - PDF Processing
**Purpose:** Trigger PDF ingestion via Trigger.dev

**Request:**
```typescript
{
  document_id: string
}
```

**Response:**
```typescript
{
  success: boolean
  documentId: string
  jobId: string
  status: 'queued'
}
```

**Features:**
- Ownership verification
- Async job triggering
- Status tracking
- Progress logging

---

#### 7. `/health-check` - System Health
**Purpose:** Monitor all system components

**Response:**
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: { status: 'pass', responseTime: number }
    embeddings: { status: 'pass', dimension: 768 }
    ingestion: { status: 'pass', recentSuccessRate: number }
    auth: { status: 'pass' }
  }
  edgeFunctions: Record<string, 'deployed' | 'missing'>
}
```

**Features:**
- Database connectivity check
- BGE embedding dimension verification (768d)
- Recent ingestion success rate
- Edge Function deployment status

---

### **Trigger.dev Worker (Ready to Deploy)**

#### `ingest_pdf_bge` - PDF → BGE Embeddings (768d)

**Pipeline:**
1. Download PDF from Supabase Storage
2. Parse with pymupdf4llm → markdown per page
3. Generate BGE embeddings (BAAI/bge-base-en-v1.5, 768d)
4. Store pages in `document_pages`
5. Store embeddings in `page_embeddings_v2`
6. Update document status: pending → processing → ready

**Features:**
- Python extension (pymupdf4llm, sentence-transformers)
- Batch processing (50 pages at once)
- Automatic retries (5 attempts)
- Progress logging
- Concurrency limit (3 PDFs at once)

#### `embed_text_bge` - Single Query Embedding

**Purpose:** Generate 768d embedding for RAG queries

**Input:** `{ text: string }`
**Output:** `{ embedding: number[], dimensions: 768 }`

---

### **Frontend Components (All Built)**

#### **Main Views**

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| CourseCatalog | `CourseCatalog.tsx` | Browse courses | ✅ |
| CourseHome | `CourseHome.tsx` | Course overview with topics | ✅ |
| PracticeView | `practice/PracticeView.tsx` | Topic practice mode | ✅ |
| GlobalPractice | `GlobalPractice.tsx` | Spaced repetition practice | ✅ |
| ExamView | `exam/ExamView.tsx` | Exam simulation | ✅ |
| CompressionView | `compression/CompressionView.tsx` | AI study notes | ✅ |
| AIAssistant | `shared/AIAssistant.tsx` | RAG chat tutor | ✅ |

#### **Supporting Components**

| Component | Purpose | Status |
|-----------|---------|--------|
| MasteryRing | Visual mastery indicator | ✅ |
| QuestionCard | MCQ/short answer display | ✅ |
| PDFUploadModal | File upload with drag-drop | ✅ |
| FileManagement | Browse/delete user files | ✅ |
| ExamTimer | Countdown timer for exams | ✅ |
| QuestionNavigator | Exam question navigation | ✅ |

#### **React Query Hooks (All Connected)**

| Hook | Edge Function | Status |
|------|---------------|--------|
| useRAGChat | `/rag-chat` | ✅ |
| useGenerateCompression | `/generate-compression` | ✅ |
| useNextGlobalQuestion | `/next-global-question` | ✅ |
| useUpdateQuestionHistory | `/update-question-history` | ✅ |
| useUpdateMastery | `/update-mastery` | ✅ |
| useUploadDocument | Storage + `/trigger-ingest` | ✅ |
| useCourses | Direct DB | ✅ |
| useQuestions | Direct DB | ✅ |

---

## 🚀 What's Left To Do

### **1. Deployment (1 hour)**

#### Deploy Edge Functions (15 min)
```bash
cd /home/user/grasp

# Deploy all 7 functions
supabase functions deploy rag-chat
supabase functions deploy generate-compression
supabase functions deploy next-global-question
supabase functions deploy update-question-history
supabase functions deploy update-mastery
supabase functions deploy trigger-ingest
supabase functions deploy health-check

# Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TRIGGER_SECRET_KEY=tr_dev_...
supabase secrets set TRIGGER_API_URL=https://api.trigger.dev
```

#### Deploy Trigger.dev Worker (15 min)
```bash
# Install CLI
npm install -g @trigger.dev/cli

# Update trigger/trigger.config.ts with project ID

# Deploy
npx trigger.dev deploy
```

#### Load Seed Data (10 min)
```bash
# Via Supabase Dashboard → SQL Editor
# Copy-paste: supabase/seed/01_sample_course_data.sql
# Run query
```

#### Test Deployment (20 min)
```bash
# Test health check
curl -X POST https://your-project.supabase.co/functions/v1/health-check

# Test each function (see Testing section below)
```

---

### **2. Data Population (2-4 hours)**

#### Add Remaining Questions (1 hour)
- **Current:** 15 questions (Topic 1 only)
- **Needed:** 60 more questions (12 per remaining topic)
- **File:** Extend `supabase/seed/01_sample_course_data.sql`
- **Template:** Use existing questions as template

#### Upload Sample PDFs (1 hour)
- **Needed:** 10 PDFs (2 per topic)
- **Location:** Supabase Storage → `course-materials/CSE120/`
- **Types:** Slides, textbook chapters, notes
- **Size:** Keep under 10MB each

#### Trigger Ingestion (1-2 hours)
```bash
# For each uploaded PDF:
# 1. Create document record
# 2. Call /trigger-ingest
# 3. Wait for status = 'ready' (2-5 min per PDF)
# 4. Verify embeddings created
```

---

### **3. Auth Implementation (2-3 hours)**

#### Create Auth Components
- **File:** `src/components/auth/LoginForm.tsx`
- **File:** `src/components/auth/SignupForm.tsx`
- **Features:**
  - Email/password login
  - Email verification flow
  - Password reset
  - Error handling

#### Integrate AuthProvider
```typescript
// src/components/auth/AuthProvider.tsx
export function AuthProvider({ children }) {
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
  }, [])
  return children
}
```

#### Update LandingPage
- Replace mock user with real login
- Add signup link
- Add "Forgot password" link

---

### **4. Optional Enhancements (Future)**

#### Short Term (This Week)
- [ ] Add OAuth (Google, GitHub)
- [ ] Document browser by topic
- [ ] Mastery dashboard (all courses)
- [ ] Export notes as PDF
- [ ] Real-time exam answer saving

#### Medium Term (This Month)
- [ ] Collaborative study rooms
- [ ] Question authoring UI (for admins)
- [ ] Analytics dashboard
- [ ] Mobile responsive improvements
- [ ] Performance optimization (caching)

#### Long Term (Future Sprints)
- [ ] Multi-tenant support (multiple universities)
- [ ] Mobile app (React Native)
- [ ] Video integration
- [ ] Discussion forums
- [ ] Gamification (badges, leaderboards)

---

## 🧪 Testing Guide

### **Backend Tests (curl)**

#### Test 1: Health Check
```bash
export SUPABASE_URL="https://xxxxx.supabase.co"

curl -X POST $SUPABASE_URL/functions/v1/health-check
```

**Expected:** `{"status": "healthy", ...}`

---

#### Test 2: RAG Chat
```bash
export USER_TOKEN="<from-login>"

curl -X POST "$SUPABASE_URL/functions/v1/rag-chat" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is a process?",
    "courseId": "11111111-1111-1111-1111-111111111111"
  }'
```

**Expected:** `{"answer": "...", "citations": [...]}`

---

#### Test 3: Generate Compression
```bash
curl -X POST "$SUPABASE_URL/functions/v1/generate-compression" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topicId": "22222222-1111-1111-1111-111111111111"}'
```

**Expected:** `{"success": true, "content": "- **Process**: ..."}`

---

#### Test 4: Next Question
```bash
curl -X POST "$SUPABASE_URL/functions/v1/next-global-question" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"courseId": "11111111-1111-1111-1111-111111111111"}'
```

**Expected:** `{"id": "...", "prompt": "...", "options": [...]}`

---

#### Test 5: Update Question History
```bash
curl -X POST "$SUPABASE_URL/functions/v1/update-question-history" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "questionId": "33333333-1111-1111-1111-111111111111",
    "isCorrect": true
  }'
```

**Expected:** `{"success": true, "nextReview": "...", "accuracy": 1.0}`

---

### **Frontend Tests (Manual)**

1. **Start frontend:** `npm run dev`
2. **Open:** http://localhost:5173
3. **Test flows:**
   - [ ] Browse courses (should show CSE 120)
   - [ ] View course home (should show 5 topics)
   - [ ] Start practice (should show questions)
   - [ ] Answer question (mastery ring should update)
   - [ ] Open AI tutor (should respond)
   - [ ] Generate compression (should create bullets)
   - [ ] Upload PDF (should trigger ingestion)

---

## 📂 Project Structure

```
/home/user/grasp/
│
├── supabase/
│   ├── functions/                    # 7 Edge Functions
│   │   ├── rag-chat/
│   │   ├── generate-compression/
│   │   ├── next-global-question/
│   │   ├── update-question-history/
│   │   ├── update-mastery/
│   │   ├── trigger-ingest/
│   │   └── health-check/
│   └── seed/
│       └── 01_sample_course_data.sql # Initial data
│
├── trigger/                          # Trigger.dev worker
│   ├── ingest-pdf.ts                 # BGE ingestion (768d)
│   └── trigger.config.ts
│
├── src/
│   ├── components/                   # 40+ React components
│   │   ├── CourseCatalog.tsx
│   │   ├── CourseHome.tsx
│   │   ├── practice/
│   │   ├── exam/
│   │   ├── compression/
│   │   ├── shared/AIAssistant.tsx
│   │   └── storage/FileManagement.tsx
│   ├── hooks/                        # 23 React Query hooks
│   │   ├── useRAGChat.ts
│   │   ├── useCompression.ts
│   │   ├── useGlobalPractice.ts
│   │   └── ...
│   ├── lib/
│   │   ├── api.ts                    # Edge Function calls
│   │   ├── supabase.ts               # Client config
│   │   ├── store.ts                  # Zustand state
│   │   └── queryClient.ts            # React Query config
│   └── types/
│       └── database.ts               # TypeScript types
│
├── README.md                         # Project overview
└── ARCHITECTURE.md                   # This file
```

---

## 🔑 Environment Variables

### **Backend (.env for Supabase)**
```bash
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...
OPENAI_API_KEY=sk-...
TRIGGER_API_URL=https://api.trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...
```

### **Frontend (.env.local)**
```bash
VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

---

## 🚨 Troubleshooting

### **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid/expired token | Re-login to get fresh token |
| `404 Function not found` | Edge Function not deployed | Run `supabase functions deploy <name>` |
| `500 OPENAI_API_KEY not configured` | Missing env var | `supabase secrets set OPENAI_API_KEY=sk-...` |
| `500 Trigger.dev not configured` | Missing Trigger vars | Set TRIGGER_API_URL and TRIGGER_SECRET_KEY |
| `404 No documents found` | No PDFs uploaded | Upload PDFs and trigger ingestion |
| `Invalid embedding dimension` | Wrong model used | Verify BGE (768d) in Trigger.dev |
| Document stuck in `processing` | Worker crashed | Check Trigger.dev logs, retry ingestion |

### **Logs**

```bash
# Edge Function logs
supabase functions logs rag-chat --tail

# Database logs
SELECT * FROM document_ingestion_logs
WHERE document_id = 'YOUR_DOC_ID'
ORDER BY timestamp DESC;

# Trigger.dev logs
# Go to https://cloud.trigger.dev → Runs → Select job
```

---

## 📊 Success Metrics

After deployment, you should have:

✅ All 7 Edge Functions deployed (verify via `supabase functions list`)
✅ Health check returns `200 OK` with all checks `pass`
✅ Trigger.dev shows 2 tasks: `ingest_pdf_bge`, `embed_text_bge`
✅ Seed data loaded: 1 course, 5 topics, 15+ questions
✅ Frontend loads without 404 errors
✅ RAG query returns answer (even if "no context" before PDFs)
✅ Compression generates bullets
✅ Questions can be practiced with mastery updates
✅ PDF upload → ingestion → embeddings pipeline works

---

## 🎯 Quick Start Commands

```bash
# 1. Deploy backend (15 min)
supabase functions deploy rag-chat && \
supabase functions deploy generate-compression && \
supabase functions deploy next-global-question && \
supabase functions deploy update-question-history && \
supabase functions deploy update-mastery && \
supabase functions deploy trigger-ingest && \
supabase functions deploy health-check

# 2. Set secrets
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set TRIGGER_SECRET_KEY=tr_dev_...

# 3. Deploy worker
npx trigger.dev deploy

# 4. Test
curl -X POST https://your-project.supabase.co/functions/v1/health-check

# 5. Start frontend
npm run dev
```

---

## 📞 Support

**Files:**
- This file: `ARCHITECTURE.md` (you are here)
- Overview: `README.md`

**Get Help:**
1. Check logs (Edge Functions, Trigger.dev, Database)
2. Verify environment variables
3. Test health check endpoint
4. Review implementation status above

---

**Version:** 1.0
**Last Updated:** 2025-11-20
**Status:** Backend ✅ Complete | Frontend ✅ 95% | Ready to Deploy 🚀
