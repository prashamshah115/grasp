# GRASP — Generalized Retrieval-Augmented Study Platform

**Production-grade AI tutor for university courses**

GRASP transforms course materials (slides, textbooks) into an adaptive learning system with intelligent question practice, AI-generated study notes, and contextual tutoring.

---

## 🎯 Features

### Core Learning Features

1. **Topic-Based Practice** — 10-15 questions per topic with instant feedback
2. **Global Practice** — Adaptive question selection using spaced repetition (SM-2 algorithm)
3. **Compression Summaries** — AI-generated 10-20 line study notes per topic
4. **Exam Simulation** — Timed midterms/finals with resume capability
5. **LLM Tutor** — Chat interface with page-level citations from course materials

### Key Innovation: Dual-Stage RAG

Instead of naive "chunk → LLM" retrieval, GRASP uses:

1. **Stage 1:** Retrieve relevant *pages* using full-page embeddings
2. **Stage 2:** Retrieve specific *chunks* from those pages
3. **Result:** LLM gets "Slide 12, VM Lecture" not "chunk #47"

---

## 🏗️ Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite with SWC
- **Styling:** Tailwind CSS v4
- **Components:** shadcn/ui (Radix primitives)
- **Icons:** Lucide React
- **Charts:** Recharts
- **State Management:** Zustand + persist middleware
- **Routing:** No router (screen-based state management)

### Backend
- **Database:** Supabase (PostgreSQL + pgvector)
- **Vector Search:** pgvector with IVFFLAT indexes
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Serverless Functions:** Supabase Edge Functions (Deno)
- **LLM:** OpenAI (GPT-4, text-embedding-3-small)

### Architecture

```
┌─────────────────┐
│   React SPA     │
│ (Vite + TS +    │
│ Tailwind +      │
│ shadcn/ui)      │
└────────┬────────┘
         │
┌────────▼─────────────────┐
│   Supabase Cloud         │
├──────────────────────────┤
│ • PostgreSQL             │
│ • pgvector               │
│ • Auth                   │
│ • Storage                │
│ • Edge Functions         │
└────────┬─────────────────┘
         │
┌────────▼──────────┐
│   LLM APIs        │
│ (OpenAI/Together) │
└───────────────────┘
```

---

## 📊 Database Schema

### Core Tables

- **courses** — Course metadata (code, name, term)
- **topics** — Weekly modules within courses
- **documents** — PDF documents (slides, textbooks)
- **document_pages** — Individual pages with embeddings (unit of retrieval)
- **document_chunks** — Fine-grained chunks for Stage 2 retrieval
- **questions** — Question bank (MCQ, short, long answer)
- **exams** — Exam definitions (midterm, final)
- **study_sessions** — User practice sessions
- **question_attempts** — Individual question responses
- **question_history** — Spaced repetition tracking (SM-2)
- **topic_mastery** — User mastery per topic (weak/moderate/strong)
- **exam_sessions** — Resumable exam attempts
- **compression_notes** — AI-generated study notes
- **rag_cache** — Query result caching

### Key Design Decisions

- **BCNF-compliant** — No redundant foreign keys
- **Materialized view** (`chunk_metadata`) for efficient topic filtering
- **Vector indexes** on `document_pages` and `document_chunks` using IVFFLAT
- **Automatic cache invalidation** via triggers on document upload

See `project_plan.md` for full schema definitions.

---

## 🔧 API Endpoints (Edge Functions)

All endpoints are Supabase Edge Functions running on Deno.

### 1. Document Ingestion
**POST** `/ingest-document`
- Extracts text from PDFs
- Generates page-level and chunk-level embeddings
- Computes importance scores
- Creates document_pages and document_chunks records

### 2. Dual-Stage RAG
**POST** `/rag-chat`
- Stage 1: Page-level retrieval (5 pages)
- Stage 2: Chunk-level retrieval from those pages (10 chunks)
- Returns LLM response with citations
- Caches results by query hash

### 3. Global Practice
**POST** `/next-global-question`
- Identifies weak topics (mastery < 60%)
- Uses spaced repetition to select next question
- Prioritizes unseen questions

### 4. Question History
**POST** `/update-question-history`
- Implements SM-2 spaced repetition algorithm
- Calculates next review date based on performance

### 5. Compression Generation
**POST** `/generate-compression`
- Retrieves top 10 most important pages
- Uses question bank to make compression question-aware
- Generates 10-20 bullet point study notes via LLM

### 6. Mastery Update
**POST** `/update-mastery`
- Aggregates question attempts by topic
- Calculates mastery level (weak/moderate/strong)
- Updates topic_mastery table

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI
- OpenAI API key

### Setup

```bash
# Clone repository
git clone <repo>
cd grasp

# Install dependencies
npm install

# Setup Supabase
supabase init
supabase start
supabase db push

# Create .env file
cp .env.example .env

# Add your keys:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key

# Run development server
npm run dev
```

### Database Commands

```bash
# Create new migration
supabase migration new add_new_feature

# Apply migrations
supabase db push

# Reset database (WARNING: destroys data)
supabase db reset

# Refresh materialized views
supabase db execute "REFRESH MATERIALIZED VIEW CONCURRENTLY chunk_metadata;"
```

---

## 🎨 Frontend Architecture

### State Management

Uses Zustand with persistence for:
- Current screen navigation
- Active study session
- User answers
- Topic mastery data

**Screen Types:**
- `landing` — Course catalog
- `catalog` — Course selection
- `course-home` — Course overview
- `practice` — Topic-based practice
- `global` — Global practice mode
- `compression` — Study notes view
- `exam` — Exam simulation
- `chat` — LLM tutor

### Component Structure

```
src/
├── components/
│   ├── blocks/          # Practice mode components
│   │   ├── Compression.tsx
│   │   ├── ExamSimulation.tsx
│   │   ├── KillZone.tsx
│   │   ├── MistakeReplay.tsx
│   │   └── Warmup.tsx
│   ├── ui/              # shadcn/ui components
│   ├── CourseCard.tsx
│   ├── CourseCatalog.tsx
│   ├── CourseHome.tsx
│   ├── LandingPage.tsx
│   ├── PracticeSession.tsx
│   └── WorkoutFrame.tsx
├── lib/
│   ├── store.ts         # Zustand store
│   └── errors.ts        # Error handling
└── data/
    └── courses.ts       # Course data
```

---

## 🧪 Testing

### Backend Testing

Test Edge Functions in isolation (never through frontend first):

```bash
# Start local functions
supabase functions serve

# Test ingestion
curl -X POST http://localhost:54321/functions/v1/ingest-document \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "your-document-uuid"}'

# Test RAG
curl -X POST http://localhost:54321/functions/v1/rag-chat \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "topic_id": "your-topic-uuid",
    "user_id": "your-user-uuid",
    "message": "What is a page fault?"
  }'
```

### Frontend Testing

```bash
# Run Playwright E2E tests
npx playwright test
npx playwright test --headed
npx playwright test --debug
```

### Performance Benchmarks

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Page retrieval (Stage 1) | < 50ms | < 100ms |
| Chunk retrieval (Stage 2) | < 50ms | < 150ms |
| Full RAG query (cached) | < 50ms | < 100ms |
| Full RAG query (uncached) | < 200ms | < 300ms |
| LLM response | 1-3s | < 5s |
| Compression generation | 3-5s | < 10s |

---

## 📈 Performance Optimizations

### Vector Search
- **pgvector IVFFLAT indexes** with `lists=100` for 10k+ vectors
- **Materialized view** (`chunk_metadata`) for topic filtering without joins
- **RAG cache** table with automatic invalidation on new uploads

### Caching Strategy
1. RAG queries cached by `(query_hash, topic_id)`
2. Cache invalidated on new document upload (trigger)
3. Hit count tracked for cache warming
4. TTL: 7 days for active topics

---

## 🔑 Key Algorithms

### Spaced Repetition (SM-2)
- First correct: 3 days until next review
- First incorrect: 1 day until next review
- Subsequent: Exponential backoff (2^n days for correct, 12 hours for incorrect)

### Page Importance Scoring
- Keyword density (definitions, algorithms, summaries)
- Content density (token count)
- Visual content (diagrams + text)
- Numbered lists (key points)

### Dual-Stage RAG Relevance
- 50% vector similarity
- 30% importance score
- 20% user familiarity boost (if page in compression notes)

---

## 📝 LLM Prompts

### System Prompt (Tutor)
```
You are GRASP, an AI study tutor for university courses.

RULES:
1. Answer ONLY using the provided context (slides, textbook excerpts)
2. Always cite sources: "Slides p.12" or "Textbook Ch.5 p.102"
3. Be concise (<200 words unless asked for more)
4. If information is missing: "Not covered in provided materials"
5. Use technical accuracy appropriate for a 2nd-year CS student
```

### Compression Prompt
Generates 10-20 bullet points based on:
- Topic questions (what students need to know)
- Top 10 most important pages
- Focus on exam-critical content only

---

## 🎯 Project Status

**MVP Complete** ✅

### Implemented
- [x] BCNF-compliant database schema
- [x] Document ingestion with page-level tracking
- [x] Dual-stage RAG (page → chunk retrieval)
- [x] Topic-based practice mode
- [x] Global practice with spaced repetition
- [x] Compression note generation
- [x] Exam simulation with resume capability
- [x] LLM tutor with page citations
- [x] Topic mastery tracking
- [x] RAG query caching

### Roadmap
- [ ] Multi-modal retrieval (image/diagram extraction)
- [ ] Vision model integration
- [ ] Mobile app (React Native)
- [ ] Offline mode with SQLite sync
- [ ] Export notes as PDF

---

## 📚 Documentation

- **Full project plan:** See `project_plan.md` for complete architecture, schema, and implementation details
- **Database schema:** All table definitions and SQL functions in `project_plan.md`
- **Edge functions:** Complete TypeScript implementations in `project_plan.md`

---

## 🛠️ Development Workflow

1. **Database changes:** Create migration → `supabase migration new <name>`
2. **Edge functions:** Edit in `supabase/functions/` → Test locally with `supabase functions serve`
3. **Frontend:** Edit React components → Hot reload via Vite
4. **Testing:** Test backend functions first, then frontend integration

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- **SimpleDoc** — Page-aware retrieval architecture
- **Supabase** — Backend infrastructure
- **pgvector** — Vector similarity search
- **shadcn/ui** — Component library
- **OpenAI** — Embeddings and LLM
