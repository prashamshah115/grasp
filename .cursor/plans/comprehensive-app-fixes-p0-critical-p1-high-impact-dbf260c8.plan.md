<!-- dbf260c8-f6e8-4384-9577-f2d4bb86dbe9 a8c24986-cc0c-4464-a145-56edb593139a -->
# Comprehensive App Fixes - P0 Critical + P1 High-Impact

## Phase 0: Critical Infrastructure (Week 1)

### P0.1: Global Error Boundary + Error Handling System

**Files:**

- Create `src/components/errors/GlobalErrorBoundary.tsx` - Class component with error logging and recovery
- Create `src/lib/errorHandler.ts` - Centralized error classification and user-friendly message mapping
- Modify `src/main.tsx` - Wrap app with ErrorBoundary and QueryErrorResetBoundary

**Implementation:**

- Error boundary catches React errors and shows fallback UI
- Error handler maps technical errors to user-friendly messages
- Log errors to console (can extend to Supabase Logs/Sentry later)
- Recovery mechanism with retry button

### P0.2: Safe API Invocation with Retry Logic

**Files:**

- Create `src/lib/safeInvoke.ts` - Retry wrapper with exponential backoff (300ms, 600ms, 1200ms)
- Modify `src/lib/api.ts` - Replace all `supabase.functions.invoke()` calls with `safeInvoke()`

**Functions to update:**

- `submitExam()` → use safeInvoke for `submit-exam`
- `updateQuestionHistory()` → use safeInvoke for `update-question-history`
- `updateMastery()` → use safeInvoke for `update-mastery`
- `ragChat()` → use safeInvoke for `rag-chat`
- `generateCompression()` → use safeInvoke for `generate-compression`

**Implementation:**

- Exponential backoff with jitter
- Network error detection
- Maximum 3 retries per call
- Graceful failure with user notification

### P0.3: Email Confirmation Flow

**Files:**

- Modify `src/components/auth/AuthProvider.tsx` - Detect `data.user && !data.session` after signup, set `pendingConfirmation` state
- Create `src/components/auth/EmailConfirmationScreen.tsx` - "Check your email" UI with resend button
- Modify `src/router.tsx` - Add `/auth/callback` route for email confirmation redirect

**Implementation:**

- After signup, check if session exists
- If no session but user exists → show confirmation screen
- Handle Supabase email confirmation callback
- Auto-redirect to courses after confirmation

### P0.4: Duplicate Enrollment Prevention

**Files:**

- Create `supabase/migrations/[timestamp]_add_unique_enrollment.sql` - Add UNIQUE constraint on (user_id, course_id)
- Modify `src/lib/api.ts` - Update `addUserCourse()` to handle duplicate key error gracefully
- Modify `src/components/CourseCatalog.tsx` - Add optimistic UI update, disable button during enrollment, show "Already enrolled" state

**SQL:**

```sql
ALTER TABLE user_courses
ADD CONSTRAINT user_course_unique UNIQUE (user_id, course_id);
```

**Implementation:**

- Database constraint prevents duplicates
- Frontend handles error gracefully (show success if already enrolled)
- Optimistic UI prevents double-tap issues

### P0.5: Exam Session Resumption

**Files:**

- Modify `src/lib/api.ts` - Add `getActiveExamSessions(courseId: string)` function
- Modify `src/components/exam/ExamView.tsx` - Query active sessions, show "Resume Exam" button if exists
- Modify `src/components/exam/ExamSimulation.tsx` - Detect resume mode, load saved answers, restore timer from `time_remaining_sec`

**Implementation:**

- Query `exam_sessions` where `is_completed = false` for course
- Show resume button instead of "Start Exam" if active session exists
- Load session data and restore state (answers, timer, current question)

## Phase 1: High-Impact UX (Week 2-3)

### P1.1: Toast Notification System

**Files:**

- Create `src/components/ui/toast/ToastProvider.tsx` - Context provider with queue management
- Create `src/components/ui/toast/Toast.tsx` - Toast component with variants (success, error, warning, info)
- Create `src/hooks/useToast.ts` - Hook for showing toasts
- Modify `src/components/exam/ExamSimulation.tsx` - Replace `alert()` with toast (2 instances)
- Modify `src/components/PracticeSession.tsx` - Replace `window.confirm()` with toast + modal (1 instance)
- Modify `src/components/CourseCatalog.tsx` - Replace `alert()` with toast (7 instances)

**Implementation:**

- Portal-based rendering for toasts
- Auto-dismiss with configurable duration
- Action buttons (undo, retry) where applicable
- Replace all native alerts/confirms

### P1.2: Upload Progress + Ingestion Status

**Files:**

- Modify `src/components/compression/PDFUploadModal.tsx` - Add upload progress tracking via `onUploadProgress`, show progress bar, add cancel button
- Create `src/components/storage/IngestionStatus.tsx` - Subscribe to `documents` table changes via Supabase Realtime, show processing status
- Modify `src/lib/api.ts` - Add progress tracking to `uploadCourseMaterial()` function

**Implementation:**

- Real-time upload progress (0-100%)
- Cancel upload functionality
- Document status badges: pending → processing → completed → failed
- Retry button for failed ingestions
- Toast notification on completion

### P1.3: Session History Views

**Files:**

- Create `src/components/sessions/SessionHistory.tsx` - List of past practice/exam sessions with filters
- Create `src/components/sessions/SessionDetail.tsx` - Session stats, question breakdown, mistake analysis
- Modify `src/router.tsx` - Add `/sessions/history` route

**Implementation:**

- Query `study_sessions` and `exam_sessions` for user
- Filter by course, date, type
- Sort by date/score
- Show detailed stats per session
- "Replay session" button to redo same questions

### P1.4: Chat History Persistence

**Files:**

- Create `supabase/migrations/[timestamp]_chat_history.sql `- Create `chat_sessions` and `chat_messages` tables with RLS
- Modify `src/components/ChatPanel.tsx` - Save messages to database, load chat history on mount, show "Continue previous conversation"
- Modify `src/lib/api.ts` - Add `saveChatMessage()` and `loadChatHistory()` functions

**SQL Tables:**

```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  topic_id UUID REFERENCES topics,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Implementation:**

- Save each message exchange to database
- Load previous conversations on mount
- Show conversation selector
- RLS policies ensure user-only access

### P1.5: Loading Skeletons

**Files:**

- Create `src/components/ui/skeleton/SkeletonCard.tsx`
- Create `src/components/ui/skeleton/SkeletonList.tsx`
- Create `src/components/ui/skeleton/SkeletonText.tsx`
- Modify `src/components/CourseCatalog.tsx` - Wrap with Suspense + SkeletonCard
- Modify `src/components/practice/PracticeView.tsx` - Add skeleton loading
- Modify `src/components/compression/CompressionView.tsx` - Add skeleton loading
- Modify `src/components/exam/ExamView.tsx` - Add skeleton loading
- Modify `src/components/ChatPanel.tsx` - Add skeleton loading

**Implementation:**

- Skeleton components match actual content layout
- Wrap data-fetching components in Suspense
- Show skeletons during initial load
- Smooth transition to actual content

## Implementation Order

1. **Day 1-2:** P0.1 (Error Boundary) + P0.2 (Safe Invoke)
2. **Day 3:** P0.3 (Email Confirmation) + P0.4 (Duplicate Enrollment)
3. **Day 4:** P0.5 (Exam Resumption)
4. **Day 5-7:** P1.1 (Toast System) + P1.5 (Skeletons)
5. **Week 2:** P1.2 (Upload Progress) + P1.3 (Session History)
6. **Week 3:** P1.4 (Chat Persistence)

## Testing Checklist

- [ ] Error boundary catches React errors
- [ ] API retries work on network failure
- [ ] Email confirmation flow completes
- [ ] Duplicate enrollment prevented
- [ ] Exam resumption loads saved state
- [ ] Toasts replace all alerts
- [ ] Upload progress shows correctly
- [ ] Session history displays past sessions
- [ ] Chat messages persist across refreshes
- [ ] Skeletons show during loading

## Dependencies

- Install `dompurify` and `@types/dompurify` (for future sanitization)
- Ensure Supabase Realtime is enabled for document status updates
- Verify RLS policies are in place for new chat tables

### To-dos

- [ ] Create GlobalErrorBoundary component and errorHandler utility, wrap app in main.tsx
- [ ] Create safeInvoke wrapper with retry logic, replace all supabase.functions.invoke() calls in api.ts
- [ ] Add email confirmation detection in AuthProvider, create EmailConfirmationScreen, add /auth/callback route
- [ ] Add UNIQUE constraint migration for user_courses, update addUserCourse() to handle duplicates, update CourseCatalog UI
- [ ] Add getActiveExamSessions API, update ExamView to show resume button, update ExamSimulation to restore state
- [ ] Create ToastProvider, Toast component, useToast hook, replace all alert() and window.confirm() calls
- [ ] Add upload progress tracking to PDFUploadModal, create IngestionStatus component with Realtime subscription
- [ ] Create SessionHistory and SessionDetail components, add /sessions/history route
- [ ] Create chat_sessions and chat_messages tables migration, update ChatPanel to save/load messages, add RLS policies
- [ ] Create skeleton components, wrap all data-fetching components with Suspense boundaries