# Codebase Audit Report
**Date:** 2025-11-20
**Purpose:** Identify what code actually EXISTS vs what's only in documentation

---

## Executive Summary

**Frontend Status:** ✅ 95% Complete (file upload fully wired up)
**Backend Status:** ❌ 0% Complete (no Edge Functions, no Trigger.dev workers, no migrations)

**Critical Finding:** Frontend is calling 6 Edge Functions that don't exist. The application will fail when users try to:
- Upload and ingest documents
- Use RAG chat
- Practice with spaced repetition
- Generate compression notes
- Update mastery tracking

---

## ✅ WHAT EXISTS (Actual Code in Codebase)

### Frontend - File Upload & Storage (FULLY IMPLEMENTED)

#### 1. Storage Layer (`src/lib/storage.ts`)
**Status:** ✅ Complete (137 lines)

**Functions Implemented:**
- `getCourseDocumentUrl()` - Get public URL for course materials
- `uploadCourseDocument()` - Upload to course-materials bucket (admin only)
- `listCourseDocuments()` - List course files
- `uploadUserFile()` - Upload to user-content bucket (user-scoped)
- `getUserFileUrl()` - Get signed URL for private files
- `listUserFiles()` - List user's files
- `deleteUserFile()` - Delete user file

**Features:**
- Dual-bucket architecture (course-materials public, user-content private)
- RLS compliant with user scoping
- Signed URL generation for private content
- Proper error handling

#### 2. React Query Hooks (`src/hooks/useStorage.ts`)
**Status:** ✅ Complete (148 lines)

**Hooks Implemented:**
- `useUploadDocument()` - Upload PDF + trigger ingestion
- `useIngestDocument()` - Manual ingestion trigger
- `useUserFiles()` - List user's uploaded files
- `useDeleteUserFile()` - Delete file with cache invalidation
- `useCourseDocuments()` - List course materials
- `useUserFileUrl()` - Get signed URL with auto-refresh

**Features:**
- Query key management integrated
- Optimistic updates and cache invalidation
- Error handling with console logging
- Stale time configuration

#### 3. UI Components

**FileManagement Component** (`src/components/storage/FileManagement.tsx`)
**Status:** ✅ Complete (138 lines)
- List all user files with metadata
- Delete files with confirmation
- Format file sizes and dates
- Loading states and error handling
- Empty state UI

**PDFUploadModal Component** (`src/components/compression/PDFUploadModal.tsx`)
**Status:** ✅ Wired up with hooks
- Drag and drop file upload
- Uses `useUploadDocument()` hook
- Auto-triggers ingestion
- Upload progress and status

#### 4. API Layer (`src/lib/api.ts`)

**uploadDocument() Function** (lines 542-577)
**Status:** ✅ FULLY IMPLEMENTED
```typescript
export async function uploadDocument(file: File, courseId: string, topicId: string)
```
- Uploads to user-content bucket with user scoping
- Creates document record in database
- Returns document metadata
- Path format: `{user_id}/courses/{courseId}/{topicId}/{timestamp}_{filename}`

**ingestDocument() Function** (lines 583-592)
**Status:** ⚠️ Calls non-existent Edge Function
```typescript
export async function ingestDocument(documentId: string)
```
- Calls `supabase.functions.invoke('ingest-document')`
- **PROBLEM:** Edge Function doesn't exist yet!

#### 5. Database Types (`src/types/database.ts`)
**Status:** ✅ Complete (389 lines)

**Tables Defined:**
- courses
- topics
- documents
- document_pages
- questions
- study_sessions
- question_attempts
- topic_mastery
- compression_notes
- exam_sessions

**RPC Functions Defined:**
- `retrieve_pages()` - Vector search for relevant pages
- `retrieve_chunks()` - Chunk-level retrieval
- `get_next_spaced_question()` - SM-2 spaced repetition

**Missing from Types:**
- `page_embeddings_v2` table (user mentioned this exists)
- `page_chunks` table (referenced by retrieve_chunks RPC)

---

## ❌ WHAT DOES NOT EXIST (Needs to be Coded)

### Backend - Completely Missing

#### 1. Supabase Edge Functions (0/6 implemented)

**Directory Check:**
```bash
$ ls /home/user/grasp/supabase/
ls: cannot access '/home/user/grasp/supabase/': No such file or directory
```

**Missing Edge Functions:**

**a) ingest-document** (Called from api.ts:585)
- Purpose: Trigger Trigger.dev worker for PDF processing
- Called by: `ingestDocument()` in api.ts
- Status: ❌ NOT IMPLEMENTED

**b) rag-chat** (Called from api.ts:417)
- Purpose: RAG-based chat with document context
- Called by: `sendRAGMessage()` in api.ts
- Status: ❌ NOT IMPLEMENTED

**c) next-global-question** (Called from api.ts:443)
- Purpose: Get next question using spaced repetition
- Called by: `getNextGlobalQuestion()` in api.ts
- Status: ❌ NOT IMPLEMENTED

**d) update-question-history** (Called from api.ts:470)
- Purpose: Update SM-2 algorithm parameters
- Called by: `updateQuestionHistory()` in api.ts
- Status: ❌ NOT IMPLEMENTED

**e) generate-compression** (Called from api.ts:498)
- Purpose: Generate AI compression notes
- Called by: `generateCompression()` in api.ts
- Status: ❌ NOT IMPLEMENTED

**f) update-mastery** (Called from api.ts:521)
- Purpose: Update topic mastery levels
- Called by: `updateMastery()` in api.ts
- Status: ❌ NOT IMPLEMENTED

#### 2. Trigger.dev Workers (0/1 implemented)

**Directory Check:**
```bash
$ ls /home/user/grasp/trigger/
ls: cannot access '/home/user/grasp/trigger/': No such file or directory
```

**Missing Worker:**

**embed-pdf-v2** worker
- Purpose: Process PDF documents (extract text, generate embeddings)
- Model: bge-base-en-v1.5 (768 dimensions)
- Tasks:
  - Extract text from PDF pages
  - Generate embeddings using Jina AI
  - Chunk text and create chunk embeddings
  - Store in page_embeddings_v2 and page_chunks tables
- Status: ❌ NOT IMPLEMENTED

#### 3. Database Migrations (0 files)

**SQL Files Check:**
```bash
$ find /home/user/grasp -name "*.sql"
(no results)
```

**Missing Migrations:**

**a) Vector Extension Setup**
```sql
-- Enable pgvector extension
create extension if not exists vector;
```
Status: ❌ NOT CREATED

**b) page_embeddings_v2 Table**
```sql
create table page_embeddings_v2 (
  id bigserial primary key,
  page_id uuid references document_pages(id),
  embedding vector(768), -- bge-base-en-v1.5
  model_name text default 'bge-base-en-v1.5',
  created_at timestamptz default now()
);
```
Status: ❌ NOT CREATED

**c) page_chunks Table**
```sql
create table page_chunks (
  id bigserial primary key,
  page_id uuid references document_pages(id),
  content text not null,
  embedding vector(768),
  context_tags text[],
  chunk_index int,
  created_at timestamptz default now()
);
```
Status: ❌ NOT CREATED

**d) RPC Functions**
- `retrieve_pages()` - Vector similarity search
- `retrieve_chunks()` - Chunk-level search
- `get_next_spaced_question()` - SM-2 algorithm
Status: ❌ NOT CREATED (types exist, but SQL doesn't)

**e) Storage Buckets**
```sql
-- Create storage buckets
insert into storage.buckets (id, name, public)
values
  ('course-materials', 'course-materials', true),
  ('user-content', 'user-content', false);

-- RLS policies for user-content bucket
create policy "Users can upload to their own folder"
  on storage.objects for insert
  with check (bucket_id = 'user-content' AND (storage.foldername(name))[1] = auth.uid()::text);
```
Status: ❌ NOT CREATED

**f) Question History Table (for SM-2)**
```sql
create table question_history (
  id bigserial primary key,
  user_id uuid references auth.users(id),
  question_id uuid references questions(id),
  easiness_factor float default 2.5,
  interval_days int default 0,
  repetitions int default 0,
  next_review_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
Status: ❌ NOT CREATED

#### 4. Environment Configuration

**Missing .env Variables:**
```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # Needed for Edge Functions

# Trigger.dev
TRIGGER_API_KEY=
TRIGGER_API_URL=

# AI Services
OPENAI_API_KEY=  # For embeddings/chat (if not using Jina)
JINA_API_KEY=    # For bge-base-en-v1.5 embeddings

# Optional
ANTHROPIC_API_KEY=  # For Claude-based compression
```
Status: ❌ NOT CONFIGURED

---

## 📝 WHAT EXISTS (Documentation Only)

### 1. IMPLEMENTATION_GUIDE.md (1,134 lines)
**Status:** 📝 Documentation only, no code written

**Contains:**
- Complete Edge Function implementations (TypeScript code)
- SQL migrations for 768d embeddings
- Trigger.dev worker architecture
- Integration instructions

**Covered Topics:**
- 5 Edge Functions with full code
- Database schema updates
- Vector search RPC functions
- Trigger.dev worker setup
- Deployment instructions

### 2. BACKEND_ARCHITECTURE.md (1,674 lines)
**Status:** 📝 Architecture plan, no code written

**Contains:**
- 6 Edge Functions with complete TypeScript
- Generic 1536d embeddings (OpenAI)
- Trigger.dev worker architecture
- Database schema with pgvector
- Row-level security policies

### 3. current_status.md (986 lines)
**Status:** 📝 Status comparison document

**Contains:**
- Comparison of implemented vs planned features
- Frontend 95% complete finding
- Backend 5% complete finding
- Detailed feature checklist

---

## 🔍 Detailed Gap Analysis

### Frontend → Backend Call Map

| Frontend Call | File:Line | Backend Endpoint | Status |
|--------------|-----------|------------------|--------|
| `ingestDocument()` | api.ts:585 | `ingest-document` Edge Function | ❌ Missing |
| `sendRAGMessage()` | api.ts:417 | `rag-chat` Edge Function | ❌ Missing |
| `getNextGlobalQuestion()` | api.ts:443 | `next-global-question` Edge Function | ❌ Missing |
| `updateQuestionHistory()` | api.ts:470 | `update-question-history` Edge Function | ❌ Missing |
| `generateCompression()` | api.ts:498 | `generate-compression` Edge Function | ❌ Missing |
| `updateMastery()` | api.ts:521 | `update-mastery` Edge Function | ❌ Missing |

**Impact:** All 6 AI-powered features will fail at runtime.

### Database Type vs Actual Schema

| Type Definition | Exists in Types? | Exists in DB? | Status |
|----------------|------------------|---------------|--------|
| `documents` table | ✅ Yes | ❓ Unknown | User needs to verify |
| `document_pages` table | ✅ Yes | ❓ Unknown | User needs to verify |
| `page_embeddings_v2` table | ❌ No | ✅ Yes (per user) | Needs type update |
| `page_chunks` table | ❌ No | ❓ Unknown | Referenced by RPC |
| `question_history` table | ❌ No | ❓ Unknown | Needed for SM-2 |
| `retrieve_pages()` RPC | ✅ Yes | ❓ Unknown | User needs to verify |
| `retrieve_chunks()` RPC | ✅ Yes | ❓ Unknown | User needs to verify |
| `get_next_spaced_question()` RPC | ✅ Yes | ❓ Unknown | User needs to verify |

### Storage Buckets

| Bucket Name | Exists? | RLS Policies? | Status |
|-------------|---------|---------------|--------|
| `course-materials` | ✅ Yes (per user) | ❓ Unknown | User created manually |
| `user-content` | ✅ Yes (per user) | ❓ Unknown | User created manually |

**Frontend code assumes:**
- Buckets are configured
- RLS policies allow user-scoped access
- Signed URLs work for private content

---

## 🚀 What Needs to Be Coded (Priority Order)

### Phase 1: Core Infrastructure (Required for file upload to work)

**1.1 Database Setup**
- [ ] Create SQL migration file with all tables
- [ ] Enable pgvector extension
- [ ] Create page_embeddings_v2 table (768d vectors)
- [ ] Create page_chunks table
- [ ] Create question_history table for SM-2
- [ ] Add indexes for vector similarity search
- [ ] Create RLS policies

**1.2 Storage Bucket Policies**
- [ ] Create RLS policy for user-content bucket
- [ ] Create RLS policy for course-materials bucket
- [ ] Test file upload/download with policies

**1.3 Environment Setup**
- [ ] Configure Supabase environment variables
- [ ] Get service role key for Edge Functions
- [ ] Set up Trigger.dev project
- [ ] Get API keys (Jina, OpenAI, Anthropic)

### Phase 2: Document Processing Pipeline (Core Feature)

**2.1 Trigger.dev Worker**
- [ ] Create `trigger/` directory
- [ ] Write embed-pdf-v2 worker
  - [ ] PDF text extraction
  - [ ] Jina AI embedding generation (bge-base-en-v1.5)
  - [ ] Text chunking
  - [ ] Database inserts (pages + embeddings + chunks)
- [ ] Test worker locally
- [ ] Deploy to Trigger.dev

**2.2 Ingest Edge Function**
- [ ] Create `supabase/functions/ingest-document/`
- [ ] Write index.ts
  - [ ] Validate document_id
  - [ ] Get document from DB
  - [ ] Get storage file URL
  - [ ] Trigger embed-pdf-v2 worker
  - [ ] Return job ID
- [ ] Test locally with `supabase functions serve`
- [ ] Deploy with `supabase functions deploy ingest-document`

### Phase 3: AI Features (User-facing functionality)

**3.1 RAG Chat Edge Function**
- [ ] Create `supabase/functions/rag-chat/`
- [ ] Write index.ts
  - [ ] Generate query embedding
  - [ ] Call retrieve_pages RPC
  - [ ] Call retrieve_chunks RPC
  - [ ] Build context from chunks
  - [ ] Call LLM with context
  - [ ] Return streaming response
- [ ] Test with real documents
- [ ] Deploy

**3.2 Compression Notes Edge Function**
- [ ] Create `supabase/functions/generate-compression/`
- [ ] Write index.ts
  - [ ] Get all pages for topic
  - [ ] Retrieve relevant chunks
  - [ ] Generate markdown notes with LLM
  - [ ] Store in compression_notes table
  - [ ] Return generated notes
- [ ] Test
- [ ] Deploy

**3.3 Spaced Repetition Edge Functions**

**next-global-question:**
- [ ] Create `supabase/functions/next-global-question/`
- [ ] Write index.ts
  - [ ] Call get_next_spaced_question RPC
  - [ ] Apply SM-2 algorithm
  - [ ] Return next question
- [ ] Test
- [ ] Deploy

**update-question-history:**
- [ ] Create `supabase/functions/update-question-history/`
- [ ] Write index.ts
  - [ ] Update question_history table
  - [ ] Recalculate SM-2 parameters
  - [ ] Update next_review_at
- [ ] Test
- [ ] Deploy

**3.4 Mastery Tracking Edge Function**
- [ ] Create `supabase/functions/update-mastery/`
- [ ] Write index.ts
  - [ ] Update topic_mastery table
  - [ ] Calculate mastery level
  - [ ] Return updated mastery
- [ ] Test
- [ ] Deploy

### Phase 4: Database Functions (Vector Search)

**4.1 retrieve_pages() RPC Function**
- [ ] Write SQL function for page-level vector search
- [ ] Use 768d embeddings from page_embeddings_v2
- [ ] Join with documents table
- [ ] Return results with similarity scores
- [ ] Test with sample queries

**4.2 retrieve_chunks() RPC Function**
- [ ] Write SQL function for chunk-level vector search
- [ ] Filter by page_ids from retrieve_pages()
- [ ] Return chunks with context
- [ ] Test with sample queries

**4.3 get_next_spaced_question() RPC Function**
- [ ] Write SQL function implementing SM-2
- [ ] Join with question_history
- [ ] Calculate next review candidates
- [ ] Return question based on schedule
- [ ] Test with sample user data

---

## 📊 Summary Statistics

### Code vs Documentation Ratio

| Category | Lines of Code | Lines of Docs | Ratio |
|----------|--------------|---------------|-------|
| Frontend | ~500 lines | - | 100% coded |
| Backend | 0 lines | 3,794 lines | 0% coded |
| **Total** | **500 lines** | **3,794 lines** | **12% coded** |

### Feature Completion

| Feature | Frontend | Backend | Overall |
|---------|----------|---------|---------|
| File Upload UI | 100% | 0% | 50% |
| Document Ingestion | 100% | 0% | 50% |
| RAG Chat | 100% | 0% | 50% |
| Compression Notes | 100% | 0% | 50% |
| Spaced Repetition | 100% | 0% | 50% |
| Mastery Tracking | 100% | 0% | 50% |

### Critical Blockers

1. **⚠️ Document Upload Will Fail**
   - User can upload file to storage ✅
   - User can create document record ✅
   - `ingestDocument()` will fail ❌ (Edge Function missing)

2. **⚠️ RAG Chat Will Fail**
   - Chat UI exists ✅
   - `sendRAGMessage()` will fail ❌ (Edge Function missing)

3. **⚠️ Compression Notes Will Fail**
   - UI exists ✅
   - `generateCompression()` will fail ❌ (Edge Function missing)

4. **⚠️ Spaced Repetition Will Fail**
   - Practice UI exists ✅
   - `getNextGlobalQuestion()` will fail ❌ (Edge Function missing)

---

## 🎯 Recommended Next Steps

### For User (You)

1. **Verify Database Schema**
   - Run: `supabase db dump --schema public > schema.sql`
   - Check if page_embeddings_v2 and page_chunks tables exist
   - Share schema.sql for verification

2. **Verify Storage Buckets**
   - Check Supabase dashboard for bucket configuration
   - Verify RLS policies are set up correctly
   - Test manual file upload

3. **Set Up Environment Variables**
   - Get Supabase service role key
   - Set up Trigger.dev account and get API key
   - Get Jina API key for embeddings

4. **Deploy Priority Order**
   - Start with Phase 1 (infrastructure)
   - Then Phase 2 (document processing)
   - Then Phase 3 (AI features)

### For Me (Assistant)

Once you provide:
- ✅ Confirmation on database schema
- ✅ Environment variables
- ✅ Trigger.dev setup details

I will:
1. Create all SQL migration files
2. Write all 6 Edge Functions
3. Write Trigger.dev worker code
4. Create deployment scripts
5. Update database types

---

## 📋 Checklist for Deployment

### Pre-Deployment

- [ ] Verify Supabase project is created
- [ ] Verify storage buckets exist
- [ ] Get service role key
- [ ] Set up Trigger.dev project
- [ ] Get all API keys
- [ ] Review database schema

### Database Setup

- [ ] Run pgvector extension migration
- [ ] Create tables (page_embeddings_v2, page_chunks, question_history)
- [ ] Create RPC functions (retrieve_pages, retrieve_chunks, get_next_spaced_question)
- [ ] Set up RLS policies
- [ ] Add indexes
- [ ] Verify with `supabase db pull`

### Backend Code

- [ ] Write all 6 Edge Functions
- [ ] Write Trigger.dev worker
- [ ] Test locally with `supabase functions serve`
- [ ] Deploy Edge Functions
- [ ] Deploy Trigger.dev worker

### Integration Testing

- [ ] Test file upload → ingestion pipeline
- [ ] Test RAG chat with real documents
- [ ] Test compression note generation
- [ ] Test spaced repetition questions
- [ ] Test mastery tracking updates

### Production Deployment

- [ ] Set environment variables in Supabase
- [ ] Deploy Edge Functions to production
- [ ] Deploy Trigger.dev worker to production
- [ ] Monitor logs for errors
- [ ] Test end-to-end user flow

---

## 🔗 Related Documents

- **IMPLEMENTATION_GUIDE.md** - Full implementation with code samples (1,134 lines)
- **BACKEND_ARCHITECTURE.md** - Architecture documentation (1,674 lines)
- **current_status.md** - Feature comparison (986 lines)
- **project_plan.md** - Original project plan

---

**Last Updated:** 2025-11-20
**Next Review:** After user provides database schema verification
