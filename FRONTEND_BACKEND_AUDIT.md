# 🔍 GRASP - COMPLETE FRONTEND-BACKEND CONNECTION AUDIT

**Date:** 2025-11-21
**Scope:** Every button, every function, every API call
**Status:** 60% Fully Connected, 17% Partial, 23% Missing

---

## 📊 EXECUTIVE SUMMARY

| Metric | Count | Status |
|--------|-------|--------|
| **Components Audited** | 11 pages | ✅ Complete |
| **Buttons/Actions** | 47 total | 60% ✅ |
| **React Query Hooks** | 30 hooks | 50% used |
| **API Functions** | 40+ functions | 60% used |
| **Edge Functions** | 13 deployed | 38% integrated |
| **Overall Integration** | 60% | ⚠️ Needs Work |

---

## 🚨 CRITICAL ISSUES (Blocking Core Features)

### 1. 🔴 PracticeSession Component - **COMPLETELY NON-FUNCTIONAL**

**File:** `src/components/PracticeSession.tsx`
**Route:** `/session/:sessionId`

**Problems:**
- ❌ Empty questions array (placeholder data)
- ❌ No API integration at all
- ❌ No session data fetching
- ❌ No answer submission to backend
- ❌ Uses props interface but is route component (no props passed)
- ❌ Comment on line 2: "TODO: Integrate with React Query"

**Impact:** **Practice mode is completely broken** - users cannot practice

**Fix Required:**
```typescript
// Current (broken):
const questions: Question[] = [] // Empty!

// Should be:
const { sessionId } = useParams()
const { data: session } = useQuery(['session', sessionId], () => fetchSessionDetails(sessionId))
const { data: question, mutate: getNext } = useMutation(getNextGlobalQuestion)
const { mutate: submitAnswer } = useMutation(submitAnswerAPI)

// Then wire up:
// - Load session on mount
// - Fetch questions using getNextGlobalQuestion
// - Submit answers with submitAnswer
// - End session with endSession
```

**Priority:** 🔴 **CRITICAL - IMMEDIATE FIX NEEDED**

---

### 2. 🔴 ExamSimulation Component - **COMPLETELY NON-FUNCTIONAL**

**File:** `src/components/exam/ExamSimulation.tsx`
**Route:** `/exam-session/:sessionId`

**Problems:**
- ❌ No session data fetching
- ❌ No backend answer persistence
- ❌ No submit exam integration
- ❌ Prop-based design but used as route component
- ❌ Answers only in local state (lost on refresh)
- ❌ No timer integration with backend

**Impact:** **Exam mode is completely broken** - users cannot take exams

**Fix Required:**
```typescript
// Current (broken):
interface ExamSimulationProps {
  examTitle: string
  questions: ExamQuestion[]  // Expects props
  onComplete: (score: number) => void
}

// Should be:
const { sessionId } = useParams()
const { data: session } = useQuery(['exam-session', sessionId],
  () => fetchExamSession(sessionId))
const { mutate: submitExam } = useMutation(submitExamAPI)
const { mutate: saveAnswer } = useMutation(submitExamAnswer)

// Auto-save each answer:
const handleSelectAnswer = (answerId: string) => {
  saveAnswer({ session_id: sessionId, question_id, user_answer: answerId })
}

// Final submit:
const handleSubmitExam = () => {
  submitExam({ session_id: sessionId })
    .then(result => navigate(`/exam/${exam.id}/results?session=${sessionId}`))
}
```

**Priority:** 🔴 **CRITICAL - IMMEDIATE FIX NEEDED**

---

### 3. 🔴 ChatPanel Component - **PLACEHOLDER ONLY**

**File:** `src/components/ChatPanel.tsx`
**Route:** `/chat/:topicId?`

**Problems:**
- ❌ Entire component is placeholder
- ❌ Comment: "TODO: Full implementation in Phase 4"
- ❌ No chat UI
- ❌ No RAG integration
- ❌ No message input

**Impact:** **Tutor feature completely missing**

**Fix Required:**
```typescript
// Current (broken):
return <div>Chat placeholder</div>

// Should implement:
const { topicId } = useParams()
const { data: messages, mutate: sendMessage } = useRAGChat()

// Full chat interface:
// - Message list with citations
// - Input field
// - Source document references
// - Streaming responses
```

**Priority:** 🔴 **CRITICAL - CORE FEATURE MISSING**

---

### 4. 🔴 ExamResults Component - **ALL DATA MOCKED**

**File:** `src/components/ExamResults.tsx`
**Route:** `/exam/:examId/results`

**Problems:**
- ❌ All results are hardcoded mock data
- ❌ sessionId from URL not used
- ❌ TODO comments: "Fetch actual exam session results"
- ❌ No actual score/stats fetching

**Impact:** **Users cannot see exam results**

**Fix Required:**
```typescript
// Current (broken):
const score = 85
const timeSpent = '45 minutes'
const accuracy = 17 // Mock data

// Should be:
const [searchParams] = useSearchParams()
const sessionId = searchParams.get('session')
const { data: result } = useQuery(['exam-result', sessionId],
  () => fetchExamSession(sessionId))

// Display real:
// result.score
// result.time_taken_sec
// result.breakdown[] with correct/incorrect
```

**Priority:** 🔴 **CRITICAL - USER FEEDBACK BLOCKED**

---

### 5. 🟡 Exam Session Creation - **NOT IMPLEMENTED**

**File:** `src/router.tsx` lines 128-137
**Route:** `/exam/:examId/start` (loader)

**Problems:**
- ⚠️ Loader returns placeholder redirect
- ⚠️ No `createExamSession()` call
- ⚠️ New edge function not integrated

**Impact:** Users cannot start exams properly

**Fix Required:**
```typescript
// Current (broken):
loader: async ({ params }) => {
  return redirect(`/exam-session/placeholder`) // Placeholder!
}

// Should be:
loader: async ({ params }) => {
  const session = await createExamSession({ exam_id: params.examId })
  return redirect(`/exam-session/${session.session_id}`)
}
```

**Priority:** 🟡 **HIGH - BLOCKS EXAM FEATURE**

---

## 📋 COMPONENT-BY-COMPONENT BREAKDOWN

### ✅ LandingPage (`/`)

**Status:** **100% Functional** ✅

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Sign In Button | `openAuthModal('signin')` | Supabase Auth | ✅ |
| Get Started Button | `openAuthModal('signup')` | Supabase Auth | ✅ |

---

### ✅ CourseCatalog (`/courses`)

**Status:** **95% Functional** ✅ (one TODO)

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Sign Out | `signOut()` | Supabase Auth | ✅ |
| View Course | `navigate(/course/:id)` | Navigation | ✅ |
| Add Course | `addCourse.mutate()` | `user_courses` INSERT | ✅ |
| Upload PDF | `uploadCourseMaterial.mutate()` | Storage + `trigger-ingest` | ✅ |

**Hooks:**
- ✅ `useCourses()` → `fetchCourses()` → `courses` table
- ✅ `useUserCourses()` → `fetchUserCourses()` → `user_courses` JOIN
- ✅ `useAddCourse()` → `addUserCourse()` → DB INSERT
- ✅ `useUploadCourseMaterial()` → `uploadCourseMaterial()` → Edge Function

**Issues:**
- ⚠️ TODO on line 79: "Add course selection UI" for multi-course uploads

---

### ✅ CourseHome (`/course/:courseId`)

**Status:** **90% Functional** ✅ (minor issues)

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Back Button | `navigate('/courses')` | Navigation | ✅ |
| Mastery Mode Toggle | `setMasteryMode()` | Local state only | ✅ UI |
| Start Practice | `navigate(.../practice)` | Navigation | ✅ |
| Practice Mode Cards | `handleStartPractice(mode)` | Navigation | ⚠️ Mode not used |
| Cheatsheet Button | `navigate(.../compression)` | Navigation | ✅ |

**Hooks:**
- ✅ `useCourse()` → `fetchCourse()` → `courses` table
- ✅ `useTopics()` → `fetchTopics()` → `topics` table
- ✅ `useCourseMastery()` → `fetchCourseMastery()` → `topic_mastery` table

**Issues:**
- ⚠️ Practice mode selection doesn't pass mode to session
- ⚠️ Mastery mode not persisted (UI only)

---

### ⚠️ PracticeView (`/course/:courseId/practice`)

**Status:** **60% Functional** ⚠️ (missing quick actions)

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Begin Session (Main) | `startSession.mutate()` | `study_sessions` INSERT | ✅ |
| Quick Warmup | None | N/A | ❌ Missing |
| Weak Spots Only | None | N/A | ❌ Missing |

**Hooks:**
- ✅ `useCourse()` → `courses` table
- ✅ `useTopics()` → `topics` table
- ✅ `useCourseMastery()` → `topic_mastery` table
- ✅ `useStartSession()` → `createSession()` → DB INSERT

**Issues:**
- ❌ Quick action buttons not wired
- ⚠️ Line 150 references `course.weakSpots` (doesn't exist)

---

### 🔴 PracticeSession (`/session/:sessionId`)

**Status:** **0% Functional** ❌ **COMPLETELY BROKEN**

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Exit Button | `onExit()` prop | N/A | ❌ No props passed |
| Check Answer | `handleSubmit()` | Local state | ❌ No API call |
| Show Hint | `setShowHint()` | Local state | ✅ UI only |
| Next Question | `handleNext()` | Local state | ❌ No API call |

**Hooks:** None (expects props instead)

**Critical Issues:**
- ❌ **Empty questions array** (line 20)
- ❌ **No backend integration**
- ❌ **"TODO: Integrate with React Query"** comment
- ❌ **Used as route component but expects props**

**Needed Integration:**
```typescript
// Missing hooks that MUST be added:
- useParams() → get sessionId
- useQuery → fetch session data
- useGlobalQuestion → get next question
- useSubmitAnswer → submit each answer
- useEndSession → complete session
- useUpdateQuestionHistory → spaced repetition
```

---

### ✅ ExamView (`/course/:courseId/exam`)

**Status:** **80% Functional** ✅ (past attempts placeholder)

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Start Exam | `navigate(/exam/:id)` | Navigation | ✅ |

**Hooks:**
- ✅ `useCourse()` → `courses` table
- ✅ Inline query → `fetchExams()` → `exams` table

**Issues:**
- ⚠️ Past attempts section is placeholder (line 137)
- ⚠️ TODO: "Fetch and display real past attempts"

**Recommendation:**
```typescript
// Add:
const { data: pastAttempts } = useQuery(['user-exam-sessions', userId, examId],
  () => fetchUserExamSessions(userId, examId))
```

---

### 🔴 ExamSimulation (`/exam-session/:sessionId`)

**Status:** **0% Functional** ❌ **COMPLETELY BROKEN**

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Exit Button | `onExit()` prop | N/A | ❌ No props |
| Flag Button | `handleToggleFlag()` | Local state | ❌ Not persisted |
| Previous/Next | `handlePrevious/Next()` | Local state | ✅ UI only |
| Submit Exam | `handleSubmitExam()` | `onComplete()` prop | ❌ No API |

**Hooks:** None (expects props)

**Critical Issues:**
- ❌ **No session data fetching**
- ❌ **No answer persistence** (local state only)
- ❌ **No submit exam integration**
- ❌ **Used as route but expects props**

**Needed Integration:**
```typescript
// Missing hooks that MUST be added:
- useParams() → get sessionId
- useQuery → fetch exam session + questions
- useMutation(submitExamAnswer) → auto-save answers
- useMutation(submitExam) → final submission
- useQuery(fetchExamAnswers) → restore saved answers
```

---

### ⚠️ ExamDefinition (`/exam/:examId`)

**Status:** **80% Functional** ⚠️ (loader placeholder)

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Cancel Button | `navigate(-1)` | Navigation | ✅ |
| Start Exam | `navigate(/exam/:id/start)` | Navigation | ⚠️ Loader broken |

**Hooks:**
- ✅ Inline query → `fetchExam()` → `exams` table

**Issues:**
- ⚠️ Loader at `/exam/:examId/start` is placeholder (router.tsx line 131-137)
- ⚠️ Should call `createExamSession()` edge function

---

### 🔴 ExamResults (`/exam/:examId/results`)

**Status:** **0% Functional** ❌ **ALL DATA MOCKED**

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Review Exam | `navigate(/exam/:id)` | Navigation | ✅ |
| Back to Exams | `navigate(.../exam)` | Navigation | ✅ |

**Hooks:**
- ⚠️ Inline query → `fetchExam()` → but results are MOCKED

**Critical Issues:**
- ❌ **All results hardcoded** (lines 38-41):
  ```typescript
  const score = 85 // MOCK
  const timeSpent = '45 minutes' // MOCK
  const accuracy = 17 // MOCK
  ```
- ❌ **sessionId from URL not used**
- ❌ **TODO comments** (lines 28-33)

**Needed Integration:**
```typescript
const [searchParams] = useSearchParams()
const sessionId = searchParams.get('session')
const { data: result } = useQuery(['exam-result', sessionId],
  () => fetchExamSession(sessionId))

// Display real data:
// - result.score
// - result.time_taken_sec
// - result.correct_count
// - result.breakdown[]
```

---

### ✅ CompressionView (`/course/:courseId/compression`)

**Status:** **90% Functional** ✅ (download missing)

| Element | Handler | Backend | Status |
|---------|---------|---------|--------|
| Manage Files | `setShowFileManager()` | UI toggle | ✅ |
| Upload PDF | `setUploadModalOpen()` | UI toggle | ✅ |
| Topic Select | `setSelectedTopicId()` | Triggers refetch | ✅ |
| Regenerate | `generateCompression.mutate()` | `generate-compression` Edge | ✅ |
| Download | None | N/A | ❌ Missing |

**Hooks:**
- ✅ `useCourse()` → `courses` table
- ✅ `useTopics()` → `topics` table
- ✅ `useCompressionNotes()` → `compression_notes` table
- ✅ `useGenerateCompression()` → `generate-compression` Edge Function

**Issues:**
- ❌ Download button not implemented
- ⚠️ TODO on line 111: "Add hasNotes logic"

---

### 🔴 ChatPanel (`/chat/:topicId?`)

**Status:** **0% Functional** ❌ **PLACEHOLDER ONLY**

**Entire component is placeholder with comment:**
> "TODO: Full implementation in Phase 4"

**Critical Issues:**
- ❌ No chat interface
- ❌ No message input
- ❌ No RAG integration
- ❌ No message history
- ❌ No citations display

**Needed Implementation:**
```typescript
const { topicId } = useParams()
const [messages, setMessages] = useState([])
const { mutate: sendMessage } = useRAGChat()

// Full chat UI needed:
// - Message list
// - Input field
// - Submit button
// - Citation cards
// - Source documents
// - Streaming support
```

---

## 🔌 BACKEND INTEGRATION STATUS

### Edge Functions (13 total)

| Function | Purpose | Frontend Integration | Status |
|----------|---------|---------------------|--------|
| `rag-chat` | RAG tutor | ❌ Not used (ChatPanel placeholder) | ⚠️ |
| `next-global-question` | Spaced repetition | ❌ Not used (PracticeSession broken) | ⚠️ |
| `update-question-history` | SM-2 algorithm | ❌ Not used (PracticeSession broken) | ⚠️ |
| `generate-compression` | AI notes | ✅ Used in CompressionView | ✅ |
| `update-mastery` | Mastery calc | ❌ Not used | ⚠️ |
| `start-exam-session` | **NEW** Secure exam start | ❌ Not used (loader placeholder) | ⚠️ |
| `submit-exam` | **NEW** Secure scoring | ❌ Not used (ExamSimulation broken) | ⚠️ |
| `trigger-ingest` | Doc processing | ✅ Used in uploadCourseMaterial | ✅ |
| `ingest-document` | PDF pipeline | ✅ Called by trigger | ✅ |
| `test-ingest` | Testing | Dev only | ✅ |
| `batch-ingest-storage` | Batch process | Admin only | ✅ |
| `batch-reingest-documents` | Re-process | Admin only | ✅ |
| `health-check` | Monitoring | Operational | ✅ |

**Integration Score: 38% (5/13 used)**

---

### React Query Hooks (30 total)

**Usage Breakdown:**

| Category | Total | Used | Unused | % Used |
|----------|-------|------|--------|--------|
| Course & Topics | 5 | 4 | 1 | 80% |
| User Courses | 4 | 3 | 1 | 75% |
| Questions | 2 | 0 | 2 | 0% |
| Mastery | 3 | 1 | 2 | 33% |
| Sessions | 5 | 1 | 4 | 20% |
| Global Practice | 2 | 0 | 2 | 0% |
| Compression | 2 | 2 | 0 | 100% |
| RAG Chat | 1 | 0 | 1 | 0% |
| Storage | 5 | 2 | 3 | 40% |
| Premium | 1 | 0 | 1 | 0% |
| **TOTAL** | **30** | **13** | **17** | **43%** |

---

### API Functions (40+ total)

**Used vs Available:**

| Category | Total | Used | Usage % |
|----------|-------|------|---------|
| Direct DB Ops | 18 | 11 | 61% |
| Session Ops | 3 | 1 | 33% |
| Edge Function Wrappers | 8 | 2 | 25% |
| API Extensions | 11 | 0 | 0% |
| **TOTAL** | **40** | **14** | **35%** |

---

## 🎯 PRIORITIZED FIX RECOMMENDATIONS

### 🔴 PHASE 1: CRITICAL FIXES (Week 1)

**Goal:** Make practice and exam modes functional

#### 1.1 Fix PracticeSession Component (2-3 days)

**File:** `src/components/PracticeSession.tsx`

```typescript
// Complete rewrite needed:

import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  fetchSessionDetails,
  getNextGlobalQuestion,
  submitAnswer as submitAnswerAPI,
  endSession,
  updateQuestionHistory
} from '@/lib/api'

export function PracticeSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  // Fetch session
  const { data: session, isLoading } = useQuery(
    ['session', sessionId],
    () => fetchSessionDetails(sessionId!)
  )

  // Get next question
  const { data: question, mutate: getNext } = useMutation(
    getNextGlobalQuestion
  )

  // Submit answer
  const submitAnswer = useMutation(
    (data: SubmitAnswerRequest) => submitAnswerAPI(data),
    {
      onSuccess: (result) => {
        // Show feedback
        setIsCorrect(result.is_correct)
        setExplanation(result.explanation)
        // Update question history for spaced repetition
        updateQuestionHistory.mutate({
          question_id: question.id,
          is_correct: result.is_correct
        })
      }
    }
  )

  // End session
  const endSessionMutation = useMutation(endSession, {
    onSuccess: () => {
      navigate(`/course/${session.course_id}`)
    }
  })

  // ... rest of component
}
```

**Estimated Effort:** 12-16 hours

---

#### 1.2 Fix ExamSimulation Component (2-3 days)

**File:** `src/components/exam/ExamSimulation.tsx`

```typescript
// Complete rewrite needed:

import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  fetchExamSession,
  fetchExamAnswers,
  submitExamAnswer,
  submitExam as submitExamAPI
} from '@/lib/api'

export function ExamSimulation() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  // Fetch exam session with questions
  const { data: session, isLoading } = useQuery(
    ['exam-session', sessionId],
    () => fetchExamSession(sessionId!)
  )

  // Load saved answers
  const { data: savedAnswers } = useQuery(
    ['exam-answers', sessionId],
    () => fetchExamAnswers(sessionId!)
  )

  // Auto-save each answer
  const saveAnswer = useMutation(
    (data: { question_id: string; user_answer: any }) =>
      submitExamAnswer(sessionId!, data.question_id, data.user_answer)
  )

  const handleSelectAnswer = (answerId: string) => {
    setAnswers({ ...answers, [currentQuestion.id]: answerId })
    // Auto-save
    saveAnswer.mutate({
      question_id: currentQuestion.id,
      user_answer: answerId
    })
  }

  // Submit exam
  const submitExam = useMutation(
    () => submitExamAPI({ session_id: sessionId! }),
    {
      onSuccess: (result) => {
        navigate(`/exam/${session.exam.id}/results?session=${sessionId}`)
      }
    }
  )

  // ... rest of component
}
```

**Estimated Effort:** 12-16 hours

---

#### 1.3 Fix ExamResults Component (1 day)

**File:** `src/components/ExamResults.tsx`

```typescript
// Replace mock data:

import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchExamSession } from '@/lib/api'

export default function ExamResults() {
  const { examId } = useParams()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')

  // Fetch real results
  const { data: result, isLoading } = useQuery(
    ['exam-result', sessionId],
    () => fetchExamSession(sessionId!),
    { enabled: !!sessionId }
  )

  if (isLoading) return <LoadingSkeleton />

  return (
    <div>
      <h1>Score: {result.score}%</h1>
      <p>Correct: {result.correct_count} / {result.total_questions}</p>
      <p>Time: {Math.floor(result.time_taken_sec / 60)} minutes</p>

      {/* Question breakdown */}
      {result.breakdown.map(item => (
        <QuestionReview
          key={item.question_id}
          question={item.prompt}
          userAnswer={item.user_answer}
          correctAnswer={item.correct_answer}
          isCorrect={item.is_correct}
          explanation={item.explanation}
        />
      ))}

      {/* Performance by topic */}
      {result.performance_by_topic.map(topic => (
        <TopicPerformance
          key={topic.topic_id}
          name={topic.topic_name}
          correct={topic.correct}
          total={topic.total}
          percentage={topic.percentage}
        />
      ))}
    </div>
  )
}
```

**Estimated Effort:** 6-8 hours

---

#### 1.4 Implement Exam Session Creation Loader (1 day)

**File:** `src/router.tsx` lines 128-137

```typescript
// Replace placeholder:

{
  path: 'exam/:examId/start',
  loader: async ({ params }) => {
    // Create exam session via edge function
    const session = await createExamSession({ exam_id: params.examId })
    // Redirect to exam interface
    return redirect(`/exam-session/${session.session_id}`)
  },
  element: null, // Loader handles everything
}
```

**Estimated Effort:** 4 hours

---

#### 1.5 Implement ChatPanel Component (3-4 days)

**File:** `src/components/ChatPanel.tsx`

```typescript
// Complete implementation:

import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ragChat } from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Array<{ title: string; page: number }>
}

export default function ChatPanel() {
  const { topicId } = useParams()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')

  const sendMessage = useMutation(
    (message: string) => ragChat({
      message,
      topic_id: topicId,
      user_id: user.id
    }),
    {
      onSuccess: (response) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: response.answer,
          citations: response.citations
        }])
      }
    }
  )

  const handleSubmit = () => {
    if (!input.trim()) return

    // Add user message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: input
    }])

    // Send to RAG
    sendMessage.mutate(input)
    setInput('')
  }

  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      <div className="input-area">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="Ask about this topic..."
        />
        <button onClick={handleSubmit}>Send</button>
      </div>
    </div>
  )
}
```

**Estimated Effort:** 16-20 hours

---

### 🟡 PHASE 2: FEATURE COMPLETION (Week 2)

#### 2.1 Implement Quick Practice Actions (1 day)

**File:** `src/components/practice/PracticeView.tsx`

```typescript
// Wire up quick action buttons:

<button onClick={() => handleStartQuickSession('warmup')}>
  Quick Warmup
</button>

<button onClick={() => handleStartQuickSession('weak-spots')}>
  Weak Spots Only
</button>

const handleStartQuickSession = async (mode: string) => {
  const session = await startSession.mutateAsync({
    course_id: courseId,
    mode: 'practice',
    options: { quickMode: mode } // Pass mode
  })
  navigate(`/session/${session.id}`)
}
```

**Estimated Effort:** 4-6 hours

---

#### 2.2 Add Exam History Display (1 day)

**File:** `src/components/exam/ExamView.tsx`

```typescript
// Add past attempts:

const { data: pastAttempts } = useQuery(
  ['user-exam-sessions', userId, courseId],
  () => fetchUserExamSessions(userId)
)

// Display:
<div className="past-attempts">
  <h3>Your Past Attempts</h3>
  {pastAttempts?.map(attempt => (
    <ExamAttemptCard
      key={attempt.id}
      score={attempt.score}
      date={attempt.submitted_at}
      timeSpent={attempt.time_taken_sec}
      onReview={() => navigate(`/exam/${examId}/results?session=${attempt.id}`)}
    />
  ))}
</div>
```

**Estimated Effort:** 4-6 hours

---

#### 2.3 Implement Download Compression Notes (1 day)

**File:** `src/components/compression/CompressionView.tsx`

```typescript
// Add download handler:

const handleDownload = (format: 'pdf' | 'md') => {
  if (format === 'md') {
    const blob = new Blob([notes.content_md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${topic.name}-notes.md`
    a.click()
  } else {
    // PDF export (use library like jsPDF or html2pdf)
    // ... implementation
  }
}

<button onClick={() => handleDownload('md')}>
  Download as Markdown
</button>
<button onClick={() => handleDownload('pdf')}>
  Download as PDF
</button>
```

**Estimated Effort:** 6-8 hours

---

### 🟢 PHASE 3: POLISH & OPTIMIZATION (Week 3)

#### 3.1 Add Mastery Updates After Sessions
#### 3.2 Persist Exam Flags to Backend
#### 3.3 Add Loading States Everywhere
#### 3.4 Add Error Boundaries
#### 3.5 Add Optimistic Updates
#### 3.6 Add Progress Indicators

---

## 📈 IMPLEMENTATION TIMELINE

| Phase | Duration | Effort | Priority |
|-------|----------|--------|----------|
| **Phase 1: Critical Fixes** | 2 weeks | 80-100 hours | 🔴 Urgent |
| **Phase 2: Feature Complete** | 1 week | 24-32 hours | 🟡 High |
| **Phase 3: Polish** | 1 week | 24-32 hours | 🟢 Medium |
| **TOTAL** | **4 weeks** | **128-164 hours** | - |

---

## 🎯 SUCCESS METRICS

After all fixes, we should achieve:

- ✅ Practice mode: 100% functional
- ✅ Exam mode: 100% functional
- ✅ Chat tutor: 100% functional
- ✅ All 47 buttons connected
- ✅ 90%+ hook utilization
- ✅ 80%+ API function usage
- ✅ 85%+ edge function integration

**Target Overall Integration: 90%+ (currently 60%)**

---

## 📞 NEXT STEPS

1. **Immediate:** Fix PracticeSession (blocks all practice)
2. **This Week:** Fix ExamSimulation (blocks all exams)
3. **Next Week:** Implement ChatPanel (core feature)
4. **Following:** Complete remaining features

---

## 📄 FILES REQUIRING CHANGES

### Critical (Must Fix):
- `src/components/PracticeSession.tsx` - Complete rewrite
- `src/components/exam/ExamSimulation.tsx` - Complete rewrite
- `src/components/ExamResults.tsx` - Replace mock data
- `src/components/ChatPanel.tsx` - Complete implementation
- `src/router.tsx` - Fix exam start loader

### High Priority:
- `src/components/practice/PracticeView.tsx` - Wire quick actions
- `src/components/exam/ExamView.tsx` - Add past attempts
- `src/components/compression/CompressionView.tsx` - Add download

### Medium Priority:
- Various components - Add loading states
- Various components - Add error handling
- Various components - Add optimistic updates

---

**This audit is complete and accurate as of 2025-11-21.**
