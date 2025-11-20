# Phase 4 Integration Plan - React Router + New UI

**OPTION A: Keep React Router, Integrate New UI Components**

---

## 🎯 OBJECTIVE

Integrate your new Figma UI components with:
- ✅ React Router v7 (URL-based navigation)
- ✅ Zustand store (global state)
- ✅ React Query hooks (data fetching)
- ✅ Supabase API layer (backend)

---

## 📊 CURRENT STATE ANALYSIS

### Your New UI Components (21 files)

**Navigation:**
- `NavBar.tsx` - 3-pillar tabs (Practice/Compression/Exam)
- `SideBar.tsx` - Course/topic selection

**Practice:**
- `PracticeView.tsx` - Main practice screen
- `WeakTopicPanel.tsx` - Weak spots panel
- `ExplanationDrawer.tsx` - Answer explanations

**Compression:**
- `CompressionView.tsx` - Notes viewer
- `PDFUploadModal.tsx` - Document upload

**Exam:**
- `ExamView.tsx` - Exam container
- `ExamSimulation.tsx` - Exam session
- `MultiStepExamSimulation.tsx` - Multi-step questions
- `ExamTimer.tsx` - Countdown timer
- `QuestionNavigator.tsx` - Question nav
- `SubmitExamModal.tsx` - Submit confirmation

**Shared:**
- `AIAssistant.tsx` - Floating AI chat
- `AIExplanationBubble.tsx` - Inline explanations
- `QuestionCard.tsx` - Question display
- `MultiStepQuestionCard.tsx` - Multi-part questions
- `ErrorState.tsx` - Error display
- `LoadingSkeleton.tsx` - Loading states

**Issues Found:**
- ❌ Uses `appState` and `setState` for navigation
- ❌ Mock data hardcoded (courses, topics, questions)
- ❌ No error handling or loading states
- ❌ No connection to API layer
- ❌ Type mismatches with our Database types

---

## 🛠️ INTEGRATION STRATEGY

### Phase 4A: Navigation Layer (1 hour)

**1. NavBar Integration**

**Current (Figma):**
```typescript
interface NavBarProps {
  currentPillar: Pillar;
  onPillarChange: (pillar: Pillar) => void;
}
```

**After Integration:**
```typescript
// Uses React Router useLocation and useNavigate
// No props needed - reads from URL
export function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { courseId } = useParams()

  const currentPillar = location.pathname.includes('/practice') ? 'practice'
    : location.pathname.includes('/compression') ? 'compression'
    : 'exam'

  const handlePillarChange = (pillar: Pillar) => {
    navigate(`/course/${courseId}/${pillar}`)
  }
}
```

**Changes:**
- Remove `currentPillar` and `onPillarChange` props
- Read current pillar from `useLocation()`
- Navigate with `useNavigate()` instead of setState
- Get `courseId` from `useParams()`

**CHECKPOINT 1: Verify navigation tabs work**

---

**2. SideBar Integration**

**Current (Figma):**
```typescript
// Uses local state, no data fetching
const courses = mockData
```

**After Integration:**
```typescript
export function SideBar() {
  const { data: courses, isLoading } = useCourses()
  const { user } = useAppStore()
  const navigate = useNavigate()

  if (isLoading) return <LoadingSkeleton />

  return (
    <div>
      {courses?.map(course => (
        <button onClick={() => navigate(`/course/${course.id}`)}>
          {course.code}
        </button>
      ))}
    </div>
  )
}
```

**Changes:**
- Replace mock data with `useCourses()` hook
- Add loading states with `LoadingSkeleton`
- Navigate with `useNavigate()` on course click
- Get user from Zustand store

**CHECKPOINT 2: Verify course list loads and navigation works**

---

### Phase 4B: Practice View (1 hour)

**3. PracticeView Integration**

**Current (Figma):**
```typescript
interface PracticeViewProps {
  course: Course;
  onStartSession: () => void;
}
// Uses Course type from mock data
// Hardcoded mastery stats
```

**After Integration:**
```typescript
export function PracticeView() {
  const { courseId } = useParams()
  const { user } = useAppStore()
  const navigate = useNavigate()

  // Fetch real data
  const { data: course, isLoading: courseLoading } = useCourse(courseId)
  const { data: mastery, isLoading: masteryLoading } = useCourseMastery(user?.id, courseId)
  const { data: topics } = useTopics(courseId)

  // Start session mutation
  const startSession = useStartSession()

  const handleStartSession = async () => {
    const session = await startSession.mutateAsync({
      course_id: courseId!,
      mode: 'practice'
    })
    navigate(`/course/${courseId}/practice/session/${session.id}`)
  }

  if (courseLoading || masteryLoading) return <LoadingScreen />
  if (!course) return <ErrorState message="Course not found" />

  // Calculate stats from real mastery data
  const masteryPercentage = calculateMasteryPercentage(
    mastery?.reduce((sum, m) => sum + m.num_correct, 0) || 0,
    mastery?.reduce((sum, m) => sum + m.num_attempts, 0) || 0
  )

  const weakSpots = mastery?.filter(m => m.mastery_level === 'weak').length || 0
}
```

**Changes:**
- Remove `course` prop, get from `useParams()`
- Replace mock stats with real mastery data
- Use `useStartSession()` mutation
- Add loading/error states
- Navigate to session on start

**CHECKPOINT 3: Verify practice view shows real data**

---

### Phase 4C: Compression View (45 min)

**4. CompressionView Integration**

**Current (Figma):**
```typescript
const topics = [
  { id: '1', name: 'Processes & Threads', hasNotes: true }
]
const noteContent = `# Mock markdown...`
```

**After Integration:**
```typescript
export function CompressionView() {
  const { courseId } = useParams()
  const { user } = useAppStore()
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  // Fetch topics
  const { data: topics, isLoading: topicsLoading } = useTopics(courseId)

  // Fetch compression notes for selected topic
  const { data: notes, isLoading: notesLoading } = useCompressionNotes(
    user?.id,
    selectedTopicId!,
    { enabled: !!selectedTopicId }
  )

  // Generate compression mutation
  const generateCompression = useGenerateCompression()

  const handleGenerate = async (topicId: string) => {
    await generateCompression.mutateAsync({
      user_id: user!.id,
      topic_id: topicId
    })
  }

  return (
    <div>
      {/* Topics list with real data */}
      {topics?.map(topic => (
        <button onClick={() => setSelectedTopicId(topic.id)}>
          {topic.name}
        </button>
      ))}

      {/* Notes viewer with real markdown */}
      {notes ? (
        <div>{notes.content_md}</div>
      ) : (
        <button onClick={() => handleGenerate(selectedTopicId!)}>
          Generate Compression
        </button>
      )}
    </div>
  )
}
```

**Changes:**
- Fetch topics with `useTopics()`
- Fetch notes with `useCompressionNotes()`
- Use `useGenerateCompression()` mutation
- Add loading states
- Show real markdown content

**CHECKPOINT 4: Verify compression view loads topics and notes**

---

### Phase 4D: Exam View (45 min)

**5. ExamView Integration**

**Current (Figma):**
```typescript
const questions = mockExamQuestions
```

**After Integration:**
```typescript
export function ExamView() {
  const { examId, sessionId } = useParams()
  const { user } = useAppStore()

  // Resume existing session or create new
  const { data: session, isLoading } = useQuery({
    queryKey: ['exam-session', sessionId],
    queryFn: () => fetchExamSession(sessionId!),
    enabled: !!sessionId
  })

  const createExamSession = useCreateExamSession()
  const submitExam = useSubmitExam()

  const handleStart = async () => {
    const newSession = await createExamSession.mutateAsync({
      user_id: user!.id,
      exam_id: examId!
    })
    navigate(`/exam/${examId}/session/${newSession.id}`)
  }

  const handleSubmit = async () => {
    await submitExam.mutateAsync({
      session_id: session!.id
    })
    navigate(`/exam/${examId}/results`)
  }
}
```

**Changes:**
- Fetch exam session with `useQuery()`
- Use `useCreateExamSession()` mutation
- Use `useSubmitExam()` mutation
- Handle resume capability
- Navigate after submission

**CHECKPOINT 5: Verify exam can start and submit**

---

### Phase 4E: Shared Components (30 min)

**6. QuestionCard Integration**

**Current (Figma):**
```typescript
interface QuestionCardProps {
  question: string;
  options: string[];
  selectedAnswer?: string;
  onSelectAnswer: (answer: string) => void;
}
```

**After Integration:**
```typescript
interface QuestionCardProps {
  question: Database['public']['Tables']['questions']['Row'];
  selectedAnswer?: string;
  onSelectAnswer: (answer: string) => void;
  onSubmit?: () => void;
}

export function QuestionCard({ question, selectedAnswer, onSelectAnswer, onSubmit }: QuestionCardProps) {
  const submitAnswer = useSubmitAnswer()

  const handleSubmit = async () => {
    if (!selectedAnswer) return

    const result = await submitAnswer.mutateAsync({
      session_id: sessionId,
      question_id: question.id,
      answer: selectedAnswer
    })

    onSubmit?.(result)
  }
}
```

**Changes:**
- Update types to match Database schema
- Use `useSubmitAnswer()` mutation
- Handle submission logic
- Show correct/incorrect feedback

**CHECKPOINT 6: Verify questions display and submit correctly**

---

**7. AIAssistant Integration**

**Current (Figma):**
```typescript
<AIAssistant context={`Course: ${course.code}`} />
```

**After Integration:**
```typescript
export function AIAssistant({ context }: { context: string }) {
  const { topicId } = useParams()
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const ragChat = useRAGChat()

  const handleSend = async () => {
    const response = await ragChat.mutateAsync({
      topic_id: topicId!,
      message
    })

    setMessages([
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: response.answer, citations: response.citations }
    ])
    setMessage('')
  }
}
```

**Changes:**
- Use `useRAGChat()` mutation
- Handle chat history
- Display citations
- Show streaming responses (Phase 5)

**CHECKPOINT 7: Verify AI chat works**

---

## 🗺️ UPDATED ROUTE STRUCTURE (CORRECTED)

```
/                              → Landing
/courses                       → Course Catalog
/course/:courseId              → Course Layout (with NavBar + SideBar)
  ├─ /practice                → PracticeView
  ├─ /compression             → CompressionView
  └─ /exam                    → ExamView (exam list - NOT 'exam-prep')
/session/:sessionId            → Practice Session (GLOBAL - not nested)
/exam/:examId                  → Exam Instructions (definition page)
/exam/:examId/start            → Create session & redirect
/exam-session/:sessionId       → Exam Simulation (full-screen)
/exam/:examId/results          → Exam Results
/chat/:topicId?                → Standalone Chat (optional)
```

**KEY CORRECTIONS:**
1. ✅ Changed `/exam-prep` → `/exam` (pillar naming consistency)
2. ✅ Session route is GLOBAL: `/session/:sessionId` (not `/practice/session/:sid`)
3. ✅ Exam flow separated: definition (`/exam/:id`) vs session (`/exam-session/:sessionId`)
4. ✅ Delete mock data ONLY AFTER hooks are verified working

---

## 📝 TYPE UPDATES NEEDED

### Update Mock Course Type → Database Type

**Current (mock):**
```typescript
interface Course {
  id: string;
  code: string;
  name: string;
  masteryPercentage: number;
  weakSpots: number;
}
```

**After (database):**
```typescript
type Course = Database['public']['Tables']['courses']['Row']
// Has: id, code, name, term

// Mastery calculated from topic_mastery table
const mastery = useCourseMastery(userId, courseId)
const masteryPercentage = calculateMasteryPercentage(mastery)
```

---

## ✅ TESTING CHECKPOINTS

**After each step, I will:**
1. ✅ Verify TypeScript compiles (no errors)
2. ✅ Test in dev server (component renders)
3. ✅ Test navigation (links work)
4. ✅ Test data fetching (shows real data)
5. ✅ Ask you to verify before moving to next step

---

## ✅ CRITICAL DECISIONS (APPROVED)

### 1. Route Structure ✅ APPROVED:

```
/course/:courseId/practice      ← Practice pillar
/course/:courseId/compression   ← Compression pillar
/course/:courseId/exam          ← Exam pillar (NOT 'exam-prep')
```

---

### 2. Session Flow ✅ APPROVED (CORRECTED):

**Practice:**
1. Click "Start Session" on PracticeView
2. Create session via `useStartSession()` mutation
3. Navigate to `/session/:sessionId` (GLOBAL route, not nested)
4. Show questions one by one
5. On complete, navigate back to `/course/:courseId/practice`

---

### 3. Exam Flow ✅ APPROVED (CORRECTED):

**Exam:**
1. Click exam from ExamView → Navigate to `/exam/:examId`
2. User sees instructions, clicks "Start Exam"
3. Navigate to `/exam/:examId/start` (loader creates session)
4. Redirect to `/exam-session/:sessionId` (full-screen)
5. On submit, navigate to `/exam/:examId/results`

**KEY: Exam definition ≠ Exam session**

---

### 4. State Management Split ✅ APPROVED:

**Zustand (client state ONLY):**
- Current screen/UI state
- Session-local state (current question index, timer)
- User preferences

**React Query (backend data ONLY):**
- Courses, topics, questions
- Mastery data
- Compression notes
- Session data from database

**NO OVERLAP ALLOWED**

---

### 5. Data Migration ✅ APPROVED:

- ✅ Delete mock data files AFTER React Query hooks verified
- ✅ Delete: `src/data/courses.ts`, `examQuestions.ts`, `multiStepExamQuestions.ts`

---

## 🎯 EXECUTION PLAN

**Once you approve:**

**Step 1 (15 min):** Update NavBar + test navigation
**Step 2 (15 min):** Update SideBar + test course loading
**Step 3 (30 min):** Integrate PracticeView + test data
**Step 4 (20 min):** Integrate CompressionView + test
**Step 5 (20 min):** Integrate ExamView + test
**Step 6 (20 min):** Update QuestionCard + test
**Step 7 (15 min):** Update AIAssistant + test
**Step 8 (15 min):** Final testing + commit

**Total: ~2.5-3 hours**

---

## ✅ APPROVAL STATUS

**ALL QUESTIONS RESOLVED AND APPROVED:**

1. ✅ Route structure: `/practice`, `/compression`, `/exam` (NOT `/exam-prep`)
2. ✅ Session flow: Global `/session/:sessionId` route (NOT nested)
3. ✅ Exam flow: Separate definition page from session (`/exam-session/:sessionId`)
4. ✅ Mock data: Delete AFTER hooks verified
5. ✅ State split: Zustand (UI) vs React Query (backend) - NO OVERLAP

---

**PROCEEDING WITH IMPLEMENTATION**
