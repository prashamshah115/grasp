# 🚀 GRASP — COMPLETE IMPLEMENTATION PLAN

**Generated:** 2025-11-21
**Purpose:** Comprehensive gap analysis and implementation roadmap based on system design spec

---

## 📊 EXECUTIVE SUMMARY

### Status Overview

| Module | Backend | Frontend | Testing | Status |
|--------|---------|----------|---------|--------|
| **Authentication** | ✅ Complete | ✅ Complete | ✅ Manual | 🟢 DONE |
| **Course Management** | ✅ Complete | ✅ Complete | ✅ Manual | 🟢 DONE |
| **Material Ingestion** | ✅ Complete | ✅ Complete | ⚠️ Partial | 🟢 DONE |
| **Practice/Adaptive** | ✅ Complete | ✅ Complete | ⚠️ Partial | 🟢 DONE |
| **Compression** | ✅ Complete | ✅ Complete | ⚠️ Partial | 🟢 DONE |
| **Exam Module** | ⚠️ 90% | ✅ Complete | ❌ None | 🟡 NEARLY DONE |
| **AI Assistant** | ✅ Complete | ✅ Complete | ⚠️ Partial | 🟢 DONE |
| **Document Viewer** | ✅ Complete | ✅ Complete | ❌ None | 🟢 DONE |

### Critical Findings

✅ **What's Working:**
- All 28 database tables exist and have proper RLS policies
- 11 edge functions deployed and functional
- Comprehensive frontend with 40+ components
- Full RAG pipeline with BGE embeddings (768d)
- Spaced repetition with SM-2 algorithm
- User course enrollment system
- Exam UI is fully built

⚠️ **What Needs Work:**
- Exam module missing dedicated edge functions (currently client-side)
- No formal testing infrastructure (only manual curl tests)
- Some edge functions lack comprehensive test coverage
- Optional enhancements (exam hints, page search) not implemented

❌ **What's NOT Built:**
- Formal test suite (unit, integration, e2e)
- CI/CD pipeline
- Performance monitoring beyond health check
- Error reporting/logging dashboard

---

## 🔍 DETAILED GAP ANALYSIS

### 1. Authentication Module ✅ COMPLETE

**Backend:**
- ✅ Supabase Auth fully integrated
- ✅ RLS policies on all tables
- ✅ Service role key for edge functions
- ✅ User token validation in protected routes

**Frontend:**
- ✅ AuthProvider context
- ✅ ProtectedRoute wrapper
- ✅ Login/signup modals
- ✅ Session management

**Status:** NO ACTION NEEDED

---

### 2. Course Management Module ✅ COMPLETE

**Backend:**
- ✅ `courses` table
- ✅ `topics` table
- ✅ `user_courses` junction table
- ✅ API functions in `/lib/api.ts`:
  - `fetchCourses()`
  - `fetchCourse(courseId)`
  - `fetchTopics(courseId)`
  - `enrollUserInCourse()`
  - `removeUserFromCourse()`

**Frontend:**
- ✅ `CourseCatalog.tsx` - Browse courses
- ✅ `CourseHome.tsx` - Course overview
- ✅ Course enrollment UI

**Status:** NO ACTION NEEDED

---

### 3. Course Material Ingestion Module ✅ COMPLETE

**Backend:**
- ✅ **Edge Functions:**
  - `trigger-ingest` - Orchestrates ingestion via Trigger.dev
  - `ingest-document` - Direct ingestion (backup)
  - `batch-ingest-storage` - Bulk processing
  - `test-ingest` - Dev testing

- ✅ **Trigger.dev Tasks:**
  - `ingest-document.ts` - PDF parsing
  - `generate-embeddings.ts` - BGE 768d embeddings
  - `finalize-document.ts` - Mark complete
  - `embed-pdf-v2.ts` - Full pipeline
  - `batch-ingest-storage.ts` - Batch processor

- ✅ **Tables:**
  - `documents` - Metadata
  - `document_pages` - Page text
  - `document_chunks` - Sub-page fragments
  - `page_embeddings_v2` - Full-page vectors
  - `course_uploads` - User uploads

**Frontend:**
- ✅ `PDFUploadModal.tsx` - File upload
- ✅ File management components

**Testing Gaps:**
- ⚠️ No automated tests for ingestion pipeline
- ⚠️ No validation tests for embedding dimensions
- ⚠️ No error recovery tests

**Status:** FUNCTIONAL - Testing improvements recommended

---

### 4. Practice / Adaptive Learning Module ✅ COMPLETE

**Backend:**
- ✅ **Edge Functions:**
  - `next-global-question` - Spaced repetition with SM-2
  - `update-question-history` - Update review schedule
  - `update-mastery` - Topic mastery tracking

- ✅ **Database RPC:**
  - `get_next_spaced_question` - Core SR algorithm

- ✅ **Tables:**
  - `questions` - Question bank
  - `study_sessions` - Practice sessions
  - `question_attempts` - Answer history
  - `topic_mastery` - Long-term learning
  - `question_history` - Spaced repetition state

**Frontend:**
- ✅ `GlobalPractice.tsx` - Main practice interface
- ✅ `PracticeSession.tsx` - Active session
- ✅ `PracticeView.tsx` - Question display
- ✅ `ExplanationDrawer.tsx` - Feedback
- ✅ `WeakTopicPanel.tsx` - Recommendations

**Testing Gaps:**
- ⚠️ No tests for SM-2 algorithm correctness
- ⚠️ No edge case tests (no questions, all mastered)

**Status:** FUNCTIONAL - Testing improvements recommended

---

### 5. Compression / Cheatsheet Module ✅ COMPLETE

**Backend:**
- ✅ **Edge Function:**
  - `generate-compression` - AI study notes generator

- ✅ **Tables:**
  - `compression_notes` - User-generated notes
  - `topic_cheatsheets` - Canonical summaries

- ✅ Uses OpenAI GPT-4 Turbo

**Frontend:**
- ✅ `CompressionView.tsx` - Notes viewer
- ✅ Markdown rendering
- ✅ Source page citations

**Testing Gaps:**
- ⚠️ No tests for LLM response validation
- ⚠️ No tests for RAG context retrieval

**Status:** FUNCTIONAL - Testing improvements recommended

---

### 6. Exam Module ⚠️ 90% COMPLETE

**Backend:**

✅ **Tables (All Exist):**
- `exams` - Exam metadata
- `exam_questions` - Question lists
- `exam_sessions` - User attempts
- `exam_answers` - Individual answers

✅ **Client-Side API Functions (in `/lib/api.ts`):**
- `fetchExams(courseId)` - List exams
- `fetchExam(examId)` - Single exam
- `fetchExamSession(sessionId)` - Session details
- `createExamSession(request)` - Start exam (CLIENT-SIDE)
- `submitExam(request)` - Submit exam (CLIENT-SIDE)

✅ **Additional Functions (in `/lib/api-extensions.ts`):**
- `submitExamAnswer(sessionId, questionId, answer)` - Save answer
- `fetchExamAnswers(sessionId)` - Get all answers
- `fetchUserExamSessions(userId, examId?)` - History

**Frontend:**
- ✅ `ExamView.tsx` - Exam listing
- ✅ `ExamSimulation.tsx` - Full exam UI
- ✅ `MultiStepExamSimulation.tsx` - Multi-step handler
- ✅ `ExamTimer.tsx` - Countdown timer
- ✅ `QuestionNavigator.tsx` - Question grid
- ✅ `SubmitExamModal.tsx` - Submit confirmation
- ✅ `ExamResults.tsx` - Results display

**Current Implementation:**
The exam module is **functional** but handles session creation and scoring **client-side** using direct Supabase calls. This works but has potential issues:

1. **Scoring Logic Client-Side** - `submitExam()` in `api.ts` line 364:
   ```typescript
   // Calculate score
   for (const answer of answers || []) {
     const question = await fetchQuestion(answer.question_id)
     if (JSON.stringify(question.correct_answer) === JSON.stringify(answer.user_answer)) {
       correctCount++
     }
   }
   ```

   **Issues:**
   - Exposed correct answers to client
   - Multiple sequential DB queries (N+1 problem)
   - No server-side validation
   - Vulnerable to manipulation

2. **Session Creation Client-Side** - `createExamSession()` in `api.ts` line 341:
   ```typescript
   const { data, error } = await supabase
     .from('exam_sessions')
     .insert({
       user_id: user.id,
       exam_id: request.exam_id,
       started_at: new Date().toISOString(),
       is_completed: false,
     })
   ```

   **Issues:**
   - No validation of exam eligibility
   - No loading of exam questions
   - No initialization of time tracking

**What's Missing:**

❌ **Edge Functions (Recommended for Security):**

1. **`start-exam-session`** (RECOMMENDED)
   - Purpose: Securely initialize exam with validation
   - Why: Validate user eligibility, load questions server-side
   - Priority: MEDIUM (current client-side approach works)

2. **`submit-exam`** (RECOMMENDED)
   - Purpose: Server-side scoring and validation
   - Why: Hide correct answers, prevent manipulation
   - Priority: MEDIUM-HIGH (security concern)

3. **`get-exam-hint`** (OPTIONAL)
   - Purpose: RAG-based contextual help during exam
   - Why: Enhanced learning experience
   - Priority: LOW (nice-to-have)

**Testing Gaps:**
- ❌ No tests for exam flow
- ❌ No tests for scoring accuracy
- ❌ No tests for timer logic
- ❌ No security tests (manipulation attempts)

**Status:** FUNCTIONAL BUT INSECURE - See "Exam Module Implementation" section below

---

### 7. AI Assistant / RAG Chat Module ✅ COMPLETE

**Backend:**
- ✅ **Edge Function:**
  - `rag-chat` - Dual-stage retrieval + GPT-4

- ✅ **Embeddings:**
  - Jina API (BGE-compatible, 768d)
  - pgvector for similarity search

- ✅ **LLM:**
  - OpenAI GPT-4 Turbo
  - Contextual system prompts

**Frontend:**
- ✅ `AIAssistant.tsx` - Floating chat widget
- ✅ `ChatPanel.tsx` - Chat interface
- ✅ Message threading
- ✅ Source citations

**Testing Gaps:**
- ⚠️ No tests for RAG retrieval accuracy
- ⚠️ No tests for citation correctness

**Status:** FUNCTIONAL - Testing improvements recommended

---

### 8. Document Viewer Module ✅ COMPLETE

**Backend:**
- ✅ Supabase Storage integration
- ✅ Signed URL generation
- ✅ `course-materials` bucket

**Frontend:**
- ✅ `NotesViewer.tsx` - PDF viewer
- ✅ Uses pdf.js for rendering

**Testing Gaps:**
- ❌ No tests for signed URL generation
- ❌ No tests for access control

**Status:** FUNCTIONAL - Testing improvements recommended

---

## 🏗️ RECOMMENDED IMPLEMENTATIONS

### Option A: Keep Current Client-Side Exam Flow (FASTEST)

**Pros:**
- Already working
- No new code needed
- Faster time to market

**Cons:**
- Security vulnerability (client can see correct answers)
- Performance issues (N+1 queries)
- No server-side validation

**Recommendation:** Use for MVP, plan migration later

---

### Option B: Implement Edge Functions for Exam (RECOMMENDED)

**Pros:**
- Secure scoring (hide correct answers)
- Better performance (single transaction)
- Server-side validation
- Audit trail

**Cons:**
- Requires new edge functions
- More testing needed
- Slightly longer implementation

**Recommendation:** Implement before production launch

---

## 🔧 MISSING EDGE FUNCTIONS - DETAILED SPECS

### 1. `start-exam-session` (RECOMMENDED)

**Purpose:**
Securely initialize an exam session with validation and question loading.

**Route:** `/functions/v1/start-exam-session`

**Authentication:** Required (user token)

**Request:**
```typescript
interface StartExamSessionRequest {
  exam_id: string
}
```

**Response:**
```typescript
interface StartExamSessionResponse {
  session_id: string
  exam: {
    id: string
    title: string
    duration_minutes: number
    total_questions: number
  }
  questions: Array<{
    id: string
    question_number: number
    prompt: string
    q_type: string
    options?: any // For MCQ
    difficulty: number
    // NOTE: correct_answer NOT included
  }>
  started_at: string
  ends_at: string
}
```

**Logic:**
1. Validate user authentication
2. Check exam exists and user has access
3. Create `exam_sessions` row
4. Load exam questions in order (from `exam_questions`)
5. Strip `correct_answer` from questions
6. Calculate end time
7. Return session + questions

**Error Handling:**
- 401: Unauthorized
- 403: User not enrolled in course
- 404: Exam not found
- 409: User has active session already
- 500: Server error

**Example Implementation Pattern:**
```typescript
// supabase/functions/start-exam-session/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface StartExamSessionRequest {
  exam_id: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { exam_id } = await req.json() as StartExamSessionRequest
    console.log('[start-exam-session] Request:', { userId: user.id, exam_id })

    // Validate exam exists
    const { data: exam, error: examError } = await supabase
      .from('exams')
      .select('*, courses!inner(id)')
      .eq('id', exam_id)
      .single()

    if (examError || !exam) {
      return new Response(
        JSON.stringify({ error: 'Exam not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check user enrolled in course
    const { data: enrollment } = await supabase
      .from('user_courses')
      .select('*')
      .eq('user_id', user.id)
      .eq('course_id', exam.course_id)
      .single()

    if (!enrollment) {
      return new Response(
        JSON.stringify({ error: 'Not enrolled in course' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check for existing active session
    const { data: activeSession } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('exam_id', exam_id)
      .eq('is_completed', false)
      .single()

    if (activeSession) {
      return new Response(
        JSON.stringify({
          error: 'Active session exists',
          session_id: activeSession.id
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create session
    const startedAt = new Date()
    const endsAt = new Date(startedAt.getTime() + exam.duration_min * 60 * 1000)

    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .insert({
        user_id: user.id,
        exam_id: exam_id,
        started_at: startedAt.toISOString(),
        time_remaining_sec: exam.duration_min * 60,
        is_completed: false,
      })
      .select()
      .single()

    if (sessionError) {
      throw sessionError
    }

    // Load exam questions (ordered)
    const { data: examQuestions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('question_id, order_index, questions(*)')
      .eq('exam_id', exam_id)
      .order('order_index', { ascending: true })

    if (questionsError) {
      throw questionsError
    }

    // Strip correct answers for security
    const questions = examQuestions.map((eq, index) => ({
      id: eq.questions.id,
      question_number: index + 1,
      prompt: eq.questions.prompt,
      q_type: eq.questions.q_type,
      options: eq.questions.options,
      difficulty: eq.questions.difficulty,
      source_ref: eq.questions.source_ref,
      // correct_answer intentionally omitted
    }))

    console.log('[start-exam-session] Success:', session.id)

    return new Response(
      JSON.stringify({
        session_id: session.id,
        exam: {
          id: exam.id,
          title: exam.name,
          duration_minutes: exam.duration_min,
          total_questions: questions.length,
        },
        questions,
        started_at: startedAt.toISOString(),
        ends_at: endsAt.toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      }
    )

  } catch (error: any) {
    console.error('[start-exam-session] Error:', error)
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**CORS Handler:**
```typescript
// Add to the bottom of index.ts
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  // ... rest of handler
})
```

---

### 2. `submit-exam` (RECOMMENDED)

**Purpose:**
Securely score exam and finalize session server-side.

**Route:** `/functions/v1/submit-exam`

**Authentication:** Required (user token)

**Request:**
```typescript
interface SubmitExamRequest {
  session_id: string
}
```

**Response:**
```typescript
interface SubmitExamResponse {
  success: true
  session_id: string
  score: number // 0-100
  total_questions: number
  correct_count: number
  time_taken_sec: number
  breakdown: Array<{
    question_id: string
    is_correct: boolean
    user_answer: any
    correct_answer: any // NOW safe to show
    explanation: string
  }>
}
```

**Logic:**
1. Validate user authentication
2. Load exam session (ensure belongs to user)
3. Check session not already submitted
4. Load all exam answers
5. Load correct answers securely server-side
6. Calculate score (iterate answers, compare to correct)
7. Update `exam_sessions` (score, submitted_at, is_completed)
8. Record in `question_attempts` for spaced repetition
9. Return detailed breakdown

**Error Handling:**
- 401: Unauthorized
- 403: Session doesn't belong to user
- 404: Session not found
- 409: Session already submitted
- 422: Incomplete exam (missing answers)
- 500: Server error

**Example Implementation:**
```typescript
// supabase/functions/submit-exam/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface SubmitExamRequest {
  session_id: string
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('PUBLIC_SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { session_id } = await req.json() as SubmitExamRequest
    console.log('[submit-exam] Request:', { userId: user.id, session_id })

    // Load session
    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found or access denied' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (session.is_completed) {
      return new Response(
        JSON.stringify({ error: 'Session already submitted' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Load user answers
    const { data: answers, error: answersError } = await supabase
      .from('exam_answers')
      .select('*')
      .eq('session_id', session_id)

    if (answersError) {
      throw answersError
    }

    // Load exam questions with correct answers (server-side only)
    const { data: examQuestions, error: questionsError } = await supabase
      .from('exam_questions')
      .select('question_id, questions(*)')
      .eq('exam_id', session.exam_id)

    if (questionsError) {
      throw questionsError
    }

    // Build question map for fast lookup
    const questionMap = new Map()
    examQuestions.forEach(eq => {
      questionMap.set(eq.question_id, eq.questions)
    })

    // Calculate score
    let correctCount = 0
    const breakdown = []

    for (const answer of answers || []) {
      const question = questionMap.get(answer.question_id)
      if (!question) continue

      const isCorrect = JSON.stringify(question.correct_answer) ===
                       JSON.stringify(answer.user_answer)

      if (isCorrect) correctCount++

      breakdown.push({
        question_id: question.id,
        is_correct: isCorrect,
        user_answer: answer.user_answer,
        correct_answer: question.correct_answer,
        explanation: question.explanation || '',
      })
    }

    const totalQuestions = examQuestions.length
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0

    // Calculate time taken
    const startedAt = new Date(session.started_at)
    const submittedAt = new Date()
    const timeTakenSec = Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000)

    // Update session
    const { error: updateError } = await supabase
      .from('exam_sessions')
      .update({
        submitted_at: submittedAt.toISOString(),
        is_completed: true,
        score,
        time_remaining_sec: Math.max(0, (session.time_remaining_sec || 0) - timeTakenSec),
      })
      .eq('id', session_id)

    if (updateError) {
      throw updateError
    }

    // TODO: Optionally record in question_attempts for spaced repetition

    console.log('[submit-exam] Success:', { session_id, score, correctCount })

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        score: Math.round(score * 100) / 100,
        total_questions: totalQuestions,
        correct_count: correctCount,
        time_taken_sec: timeTakenSec,
        breakdown,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      }
    )

  } catch (error: any) {
    console.error('[submit-exam] Error:', error)
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

---

### 3. `get-exam-hint` (OPTIONAL - LOW PRIORITY)

**Purpose:**
Provide RAG-based contextual help during exams.

**Route:** `/functions/v1/get-exam-hint`

**Authentication:** Required (user token)

**Request:**
```typescript
interface GetExamHintRequest {
  session_id: string
  question_id: string
  hint_level: 'gentle' | 'moderate' | 'direct'
}
```

**Response:**
```typescript
interface GetExamHintResponse {
  hint: string
  hint_level: string
  citations: Array<{
    document_title: string
    page_number: number
  }>
}
```

**Logic:**
1. Validate user + session
2. Load question
3. Use RAG to find relevant context
4. Generate hint based on level:
   - gentle: "Consider reviewing concept X"
   - moderate: "Think about the relationship between X and Y"
   - direct: Partial answer with gaps
5. Return hint + citations

**Priority:** LOW - Nice-to-have feature

**Estimated Effort:** 4-6 hours

---

## 🧪 COMPREHENSIVE TESTING STRATEGY

### Current State:
- ✅ Manual curl tests documented in `ARCHITECTURE.md`
- ✅ `health-check` edge function for monitoring
- ❌ No automated test suite
- ❌ No CI/CD pipeline

### Recommended Testing Approach:

#### 1. Edge Function Tests (curl)

**Test File:** `scripts/test-edge-functions.sh`

```bash
#!/bin/bash
# GRASP Edge Function Test Suite
# Usage: ./scripts/test-edge-functions.sh

set -e

# Load environment
export SUPABASE_URL="https://xxxxx.supabase.co"
export ANON_KEY="your-anon-key"
export USER_TOKEN="" # Set after login

echo "🧪 GRASP Edge Function Tests"
echo "=============================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Test counter
PASSED=0
FAILED=0

# Helper function
test_endpoint() {
  local name=$1
  local url=$2
  local method=$3
  local data=$4
  local expected_status=$5

  echo -n "Testing $name... "

  response=$(curl -s -w "\n%{http_code}" -X $method "$url" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$data")

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" -eq "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} ($http_code)"
    PASSED=$((PASSED + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (expected $expected_status, got $http_code)"
    echo "Response: $body"
    FAILED=$((FAILED + 1))
    return 1
  fi
}

# ==================== TEST SUITE ====================

echo ""
echo "1. Health Check"
echo "---------------"
test_endpoint \
  "health-check" \
  "$SUPABASE_URL/functions/v1/health-check" \
  "POST" \
  "{}" \
  200

echo ""
echo "2. Practice Module"
echo "------------------"
test_endpoint \
  "next-global-question" \
  "$SUPABASE_URL/functions/v1/next-global-question" \
  "POST" \
  '{"courseId":"your-course-id"}' \
  200

test_endpoint \
  "update-question-history" \
  "$SUPABASE_URL/functions/v1/update-question-history" \
  "POST" \
  '{"questionId":"q-id","userId":"u-id","isCorrect":true}' \
  200

echo ""
echo "3. RAG Chat"
echo "-----------"
test_endpoint \
  "rag-chat" \
  "$SUPABASE_URL/functions/v1/rag-chat" \
  "POST" \
  '{"message":"Explain sorting algorithms","topicId":"topic-id"}' \
  200

echo ""
echo "4. Compression"
echo "--------------"
test_endpoint \
  "generate-compression" \
  "$SUPABASE_URL/functions/v1/generate-compression" \
  "POST" \
  '{"topicId":"topic-id"}' \
  200

echo ""
echo "5. Exam Module (NEW)"
echo "--------------------"
test_endpoint \
  "start-exam-session" \
  "$SUPABASE_URL/functions/v1/start-exam-session" \
  "POST" \
  '{"exam_id":"exam-id"}' \
  200

test_endpoint \
  "submit-exam" \
  "$SUPABASE_URL/functions/v1/submit-exam" \
  "POST" \
  '{"session_id":"session-id"}' \
  200

echo ""
echo "=============================="
echo "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}"
echo "=============================="

if [ $FAILED -gt 0 ]; then
  exit 1
fi
```

**Usage:**
```bash
chmod +x scripts/test-edge-functions.sh

# Set user token (from browser console after login)
export USER_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Run tests
./scripts/test-edge-functions.sh
```

---

#### 2. Individual Edge Function Tests

**Test: `start-exam-session`**

```bash
#!/bin/bash
# Test: start-exam-session

export SUPABASE_URL="https://xxxxx.supabase.co"
export USER_TOKEN="your-token"

# Get exam ID (replace with real ID)
export EXAM_ID="11111111-2222-3333-4444-555555555555"

echo "Testing start-exam-session..."

curl -v -X POST "$SUPABASE_URL/functions/v1/start-exam-session" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"exam_id\": \"$EXAM_ID\"
  }"

# Expected response:
# {
#   "session_id": "...",
#   "exam": {
#     "id": "...",
#     "title": "Midterm Exam 1",
#     "duration_minutes": 60,
#     "total_questions": 20
#   },
#   "questions": [
#     {
#       "id": "...",
#       "question_number": 1,
#       "prompt": "What is...",
#       "q_type": "multiple_choice",
#       "options": {...},
#       "difficulty": 2
#     }
#   ],
#   "started_at": "2025-11-21T10:30:00Z",
#   "ends_at": "2025-11-21T11:30:00Z"
# }
```

**Test: `submit-exam`**

```bash
#!/bin/bash
# Test: submit-exam

export SUPABASE_URL="https://xxxxx.supabase.co"
export USER_TOKEN="your-token"

# Get session ID from start-exam-session response
export SESSION_ID="22222222-3333-4444-5555-666666666666"

echo "Testing submit-exam..."

curl -v -X POST "$SUPABASE_URL/functions/v1/submit-exam" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\"
  }"

# Expected response:
# {
#   "success": true,
#   "session_id": "...",
#   "score": 85.5,
#   "total_questions": 20,
#   "correct_count": 17,
#   "time_taken_sec": 2400,
#   "breakdown": [
#     {
#       "question_id": "...",
#       "is_correct": true,
#       "user_answer": "A",
#       "correct_answer": "A",
#       "explanation": "..."
#     }
#   ]
# }
```

---

#### 3. Error Case Tests

```bash
#!/bin/bash
# Test: Error cases for exam functions

export SUPABASE_URL="https://xxxxx.supabase.co"

echo "Testing error cases..."

# Test 1: Missing auth
echo "1. No auth token (should be 401)"
curl -X POST "$SUPABASE_URL/functions/v1/start-exam-session" \
  -H "Content-Type: application/json" \
  -d '{"exam_id":"fake-id"}'

# Test 2: Invalid exam ID
echo "2. Invalid exam ID (should be 404)"
curl -X POST "$SUPABASE_URL/functions/v1/start-exam-session" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exam_id":"00000000-0000-0000-0000-000000000000"}'

# Test 3: Not enrolled in course
echo "3. Not enrolled (should be 403)"
curl -X POST "$SUPABASE_URL/functions/v1/start-exam-session" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"exam_id":"other-user-exam"}'

# Test 4: Double submission
echo "4. Already submitted (should be 409)"
curl -X POST "$SUPABASE_URL/functions/v1/submit-exam" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"session_id":"already-submitted-session"}'
```

---

#### 4. Integration Tests (Frontend → Backend)

**Recommended:** Use Playwright or Cypress for full e2e tests

```typescript
// tests/e2e/exam-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Exam Flow', () => {
  test('should complete full exam flow', async ({ page }) => {
    // 1. Login
    await page.goto('/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // 2. Navigate to course
    await page.goto('/course/your-course-id')

    // 3. Click "Exam" pillar
    await page.click('text=Exam')

    // 4. Start exam
    await page.click('text=Start Exam')

    // 5. Verify timer started
    await expect(page.locator('[data-testid="exam-timer"]')).toBeVisible()

    // 6. Answer first question
    await page.click('[data-testid="option-A"]')
    await page.click('text=Next')

    // 7. Submit exam
    await page.click('text=Submit Exam')
    await page.click('text=Confirm')

    // 8. Verify results
    await expect(page.locator('text=Your Score')).toBeVisible()
  })
})
```

---

### Testing Checklist

#### Before Production Launch:

**Backend:**
- [ ] All edge functions have curl tests
- [ ] Error cases tested (401, 403, 404, 409, 500)
- [ ] Load testing (concurrent users)
- [ ] Database query performance profiling
- [ ] RLS policies validated

**Frontend:**
- [ ] Critical paths tested (signup, practice, exam)
- [ ] Error states handled gracefully
- [ ] Loading states implemented
- [ ] Mobile responsive tested
- [ ] Browser compatibility (Chrome, Firefox, Safari)

**Security:**
- [ ] Exam answers never exposed to client before submission
- [ ] User can only access own sessions
- [ ] Rate limiting on edge functions
- [ ] Input validation on all endpoints
- [ ] SQL injection tests

**Performance:**
- [ ] Edge functions respond < 2s
- [ ] RAG retrieval < 3s
- [ ] Compression generation < 10s
- [ ] Frontend loads < 1s

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Exam Security (HIGH PRIORITY)

**Goal:** Secure exam scoring server-side

**Tasks:**
1. Create `supabase/functions/submit-exam/index.ts`
2. Migrate scoring logic from client to edge function
3. Update frontend to use new endpoint
4. Test with curl
5. Deploy to production

**Files to Create:**
- `supabase/functions/submit-exam/index.ts`

**Files to Modify:**
- `src/lib/api.ts` - Update `submitExam()` to call edge function
- `src/components/exam/ExamSimulation.tsx` - Use new API

**Testing:**
- [ ] curl test for submit-exam
- [ ] Verify correct answers not exposed to client
- [ ] Test error cases

**Estimated Effort:** 4-6 hours

---

### Phase 2: Exam Initialization (MEDIUM PRIORITY)

**Goal:** Server-side exam session management

**Tasks:**
1. Create `supabase/functions/start-exam-session/index.ts`
2. Add validation logic
3. Update frontend to use new endpoint
4. Test with curl
5. Deploy

**Files to Create:**
- `supabase/functions/start-exam-session/index.ts`

**Files to Modify:**
- `src/lib/api.ts` - Update `createExamSession()`
- `src/components/exam/ExamView.tsx` - Use new API

**Testing:**
- [ ] curl test for start-exam-session
- [ ] Test duplicate session prevention
- [ ] Test course enrollment validation

**Estimated Effort:** 4-6 hours

---

### Phase 3: Testing Infrastructure (HIGH PRIORITY)

**Goal:** Automated testing for all edge functions

**Tasks:**
1. Create `scripts/test-edge-functions.sh`
2. Add individual test scripts for each function
3. Document testing process in README
4. Set up CI/CD (GitHub Actions)

**Files to Create:**
- `scripts/test-edge-functions.sh`
- `scripts/tests/test-submit-exam.sh`
- `scripts/tests/test-start-exam-session.sh`
- `.github/workflows/test-edge-functions.yml`

**Testing:**
- [ ] All edge functions pass automated tests
- [ ] CI runs tests on every PR
- [ ] Tests run in < 5 minutes

**Estimated Effort:** 6-8 hours

---

### Phase 4: Optional Enhancements (LOW PRIORITY)

**Goal:** Nice-to-have features

**Tasks:**
1. Implement `get-exam-hint` edge function
2. Add exam pause/resume functionality
3. Add exam analytics dashboard
4. Implement question bookmarking

**Estimated Effort:** 12-16 hours

---

## 📁 FILE STRUCTURE REFERENCE

### Current Structure:
```
grasp/
├── supabase/
│   ├── functions/
│   │   ├── health-check/index.ts ✅
│   │   ├── rag-chat/index.ts ✅
│   │   ├── generate-compression/index.ts ✅
│   │   ├── next-global-question/index.ts ✅
│   │   ├── update-question-history/index.ts ✅
│   │   ├── update-mastery/index.ts ✅
│   │   ├── trigger-ingest/index.ts ✅
│   │   ├── ingest-document/index.ts ✅
│   │   ├── batch-ingest-storage/index.ts ✅
│   │   ├── batch-reingest-documents/index.ts ✅
│   │   ├── test-ingest/index.ts ✅
│   │   ├── start-exam-session/index.ts ❌ TO CREATE
│   │   └── submit-exam/index.ts ❌ TO CREATE
│   ├── migrations/
│   └── seed/
├── src/
│   ├── components/
│   │   ├── exam/ ✅
│   │   ├── practice/ ✅
│   │   ├── compression/ ✅
│   │   ├── shared/ ✅
│   │   └── ui/ ✅
│   ├── hooks/ ✅
│   ├── lib/
│   │   ├── api.ts ✅ (may need updates)
│   │   ├── api-extensions.ts ✅
│   │   ├── supabase.ts ✅
│   │   └── errors.ts ✅
│   ├── types/ ✅
│   └── pages/ ✅
├── trigger/ ✅
├── scripts/
│   ├── test-edge-functions.sh ❌ TO CREATE
│   └── tests/ ❌ TO CREATE
└── ARCHITECTURE.md ✅
```

---

## 🎯 QUICK START: NEXT STEPS

### If you want to implement missing edge functions:

1. **Start with `submit-exam` (highest priority):**
   ```bash
   mkdir -p supabase/functions/submit-exam
   # Copy implementation from section above

   # Deploy
   supabase functions deploy submit-exam

   # Test
   export USER_TOKEN="your-token"
   curl -X POST "$SUPABASE_URL/functions/v1/submit-exam" \
     -H "Authorization: Bearer $USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"session_id":"test-id"}'
   ```

2. **Then implement `start-exam-session`:**
   ```bash
   mkdir -p supabase/functions/start-exam-session
   # Copy implementation from section above

   # Deploy
   supabase functions deploy start-exam-session

   # Test
   curl -X POST "$SUPABASE_URL/functions/v1/start-exam-session" \
     -H "Authorization: Bearer $USER_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"exam_id":"exam-id"}'
   ```

3. **Update frontend API calls:**
   ```typescript
   // src/lib/api.ts

   // Replace client-side submitExam with:
   export async function submitExam(request: SubmitExamRequest): Promise<SubmitExamResponse> {
     const user = await requireAuth()

     return retryWithBackoff(async () => {
       const { data, error } = await supabase.functions.invoke<SubmitExamResponse>('submit-exam', {
         body: {
           session_id: request.session_id,
         },
       })

       if (error) throw error
       if (!data) throw new Error('No data returned from submit-exam')

       return data
     })
   }

   // Similarly for createExamSession → start-exam-session
   ```

4. **Create testing infrastructure:**
   ```bash
   mkdir -p scripts/tests

   # Create test-edge-functions.sh (copy from above)
   chmod +x scripts/test-edge-functions.sh

   # Run tests
   ./scripts/test-edge-functions.sh
   ```

---

## 📞 NEED HELP?

**Common Issues:**

1. **Edge function fails to deploy:**
   - Check Deno version: `deno --version` (should be 1.33+)
   - Verify environment variables in Supabase dashboard
   - Check logs: `supabase functions logs submit-exam`

2. **CORS errors:**
   - Add OPTIONS handler to edge function
   - Verify Access-Control-Allow-Origin headers
   - Check browser console for specific error

3. **Auth errors:**
   - Verify user token not expired
   - Check Authorization header format: `Bearer <token>`
   - Verify RLS policies

4. **Performance issues:**
   - Profile database queries with `EXPLAIN ANALYZE`
   - Check edge function logs for slow operations
   - Consider caching for repeated queries

---

## ✅ ACCEPTANCE CRITERIA

### Before marking exam module as "complete":

**Backend:**
- [ ] `submit-exam` edge function deployed and tested
- [ ] `start-exam-session` edge function deployed and tested
- [ ] All edge functions have curl tests
- [ ] Error cases handled gracefully
- [ ] Server-side validation implemented

**Frontend:**
- [ ] Frontend uses new edge functions
- [ ] Loading states implemented
- [ ] Error states handled
- [ ] Results display working

**Testing:**
- [ ] Automated test suite created
- [ ] All tests passing
- [ ] Security tests passing (no answer exposure)

**Documentation:**
- [ ] ARCHITECTURE.md updated with new functions
- [ ] Testing guide updated
- [ ] Deployment guide updated

---

## 📊 EFFORT ESTIMATES

| Task | Effort | Priority |
|------|--------|----------|
| **Implement `submit-exam`** | 4-6 hrs | HIGH |
| **Implement `start-exam-session`** | 4-6 hrs | MEDIUM |
| **Create test suite** | 6-8 hrs | HIGH |
| **Update frontend API** | 2-3 hrs | HIGH |
| **Documentation updates** | 2 hrs | MEDIUM |
| **Implement `get-exam-hint`** | 4-6 hrs | LOW |
| **E2E tests (Playwright)** | 8-12 hrs | LOW |
| **CI/CD setup** | 4 hrs | MEDIUM |
| **Total (Core)** | 18-25 hrs | - |
| **Total (With Optional)** | 30-43 hrs | - |

---

## 🎉 CONCLUSION

Your GRASP platform is **90% complete** with a solid foundation:
- ✅ All 28 database tables implemented
- ✅ 11 edge functions deployed
- ✅ Full RAG pipeline working
- ✅ Comprehensive frontend UI
- ✅ Spaced repetition algorithm
- ✅ Exam UI fully built

**Remaining work is minimal** and focused on:
1. **Security:** Move exam scoring server-side (HIGH priority)
2. **Testing:** Automated test suite (HIGH priority)
3. **Polish:** Optional enhancements (LOW priority)

The system is **production-ready** for MVP launch. The current client-side exam flow works but should be migrated to edge functions before scaling.

---

**Next Action:** Choose Phase 1 (Exam Security) or Phase 3 (Testing Infrastructure) and begin implementation using the detailed specs above.
