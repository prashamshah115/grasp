# CSE120 Generate-DB Roadmap

**Purpose**: Complete technical roadmap for implementing the full data pipeline from storage uploads through finals engine diagnostics and study plan generation.

**Target Audience**: Engineers implementing or debugging the finals prep system, particularly the CSE120 course data generation workflow.

---

## Table of Contents

1. [Overview](#overview)
2. [Storage → Documents Pipeline](#storage--documents-pipeline)
3. [Question Generation & Seeding](#question-generation--seeding)
4. [Diagnostic Exam Flow](#diagnostic-exam-flow)
5. [Diagnostic Summary](#diagnostic-summary)
6. [Study Plan Generation](#study-plan-generation)
7. [Table Relationships & Data Flow](#table-relationships--data-flow)
8. [Golden Course Seeding Spec](#golden-course-seeding-spec)
9. [Verification Checklist](#verification-checklist)

---

## Overview

The finals engine requires a complete data pipeline that transforms raw course materials (PDFs, slides, notes) into:

1. **Structured questions** with explicit explanations and source metadata
2. **Diagnostic exams** that measure topic-level mastery
3. **Personalized study plans** that prioritize weak topics

This document maps every step from storage upload → database tables → UI rendering.

**Key Tables**:
- `documents` → `document_pages` → `document_chunks` (storage & RAG)
- `questions` (explicit content: `explanation_md`, primary source fields, FRQ rubric)
- `exams` → `exam_sessions` → `exam_answers` (diagnostic runs)
- `diagnostic_status` (aggregated mastery: `score` 0-100, `topic_mastery` JSONB)
- `study_plans` (personalized plans: `plan_content`, `weak_topics`, `priority_order`)

---

## Storage → Documents Pipeline

### Step 1: Document Upload

**Entry Point**: `src/lib/api.ts::uploadDocument()`

1. User uploads PDF via UI
2. File stored in Supabase Storage bucket `user-content` at path: `{user_id}/courses/{courseId}/{topicId}/{timestamp}_{filename}`
3. `documents` row created with:
   - `course_id`, `topic_id`
   - `doc_type` (auto-detected: `'slides' | 'notes' | 'textbook' | 'homework' | 'exam' | 'other'`)
   - `title` (filename)
   - `storage_path` (storage bucket path)
   - `status = 'processing'`

### Step 2: Document Ingestion (Trigger.dev Task)

**Task**: `trigger/tasks/ingest-document.ts::ingestDocument`

1. Downloads PDF from storage
2. Parses PDF using PyMuPDF → extracts pages with text, images, tables
3. Inserts into `document_pages`:
   - `document_id`, `page_number`
   - `text_content` (full page text)
   - `token_count` (estimated)
   - `has_diagrams`, `has_tables`
   - `importance_score` (default 0.5)
4. Updates `documents.processing_step = 'parsed'`

### Step 3: Embedding Generation (Trigger.dev Task)

**Task**: `trigger/tasks/embed-pdf-v2.ts::embedPDFv2`

1. Generates page-level embeddings (BGE model, 768d) → `page_embeddings_v2`
2. Chunks pages into 500-char segments with overlap
3. Generates chunk-level embeddings → `document_chunks`:
   - `page_id` (FK to `document_pages`)
   - `content` (chunk text)
   - `embedding` (vector)
   - `chunk_index`
4. Updates `documents.status = 'ready'`, `processed_at = now()`

**Output**: Document is now searchable via vector similarity (RAG).

---

## Question Generation & Seeding

### Automatic Extraction (Optional)

**Task**: `trigger/tasks/extract-questions.ts::extractQuestions`

1. Reads `document_pages` for exam/homework documents
2. Calls LLM (GPT-5 Mini) to extract questions from raw text
3. Inserts into `extracted_questions` (pending validation)
4. Admin can promote validated questions → `questions` table

**Note**: This is **optional**. For the golden course, you should **manually seed** questions with full metadata.

### Manual Question Seeding (Required for Golden Course)

**Table**: `questions`

**Required Fields for MCQs**:
```sql
INSERT INTO questions (
  course_id,
  topic_id,
  q_type,              -- 'mcq'
  prompt,              -- Question text
  options,             -- JSONB array of choices
  correct_answer,      -- JSONB (selected option)
  explanation_md,      -- ⚠️ REQUIRED: Markdown explanation
  primary_source_type, -- ⚠️ REQUIRED: 'slide' | 'notes' | 'textbook' | 'handout'
  primary_source_locator, -- ⚠️ REQUIRED: e.g. "Slide 13", "Page 42"
  primary_source_id,    -- Optional: document UUID or URL
  difficulty           -- 1-3
) VALUES (...);
```

**Required Fields for FRQs**:
```sql
INSERT INTO questions (
  course_id,
  topic_id,
  q_type,              -- 'short' | 'long'
  prompt,              -- Question text
  explanation_md,      -- ⚠️ REQUIRED: Markdown explanation
  primary_source_type, -- ⚠️ REQUIRED
  primary_source_locator, -- ⚠️ REQUIRED
  frq_ideal_answer,    -- ⚠️ REQUIRED: Reference answer text
  frq_rubric_md,       -- ⚠️ REQUIRED: Markdown rubric (criteria, partial credit)
  primary_source_id    -- Optional
) VALUES (...);
```

**Why These Fields Matter**:
- `explanation_md` → Rendered in purple card in "Study Relevant Content" panel
- `primary_source_*` → Shown in white source card, referenced by AI chat
- `frq_ideal_answer` + `frq_rubric_md` → Used by LLM grader in `submit-exam` function

**Generation Strategy**:
- **Option A**: Manually write questions with full metadata (recommended for golden course)
- **Option B**: Use LLM to generate `explanation_md` and `frq_rubric_md` from question prompt + source document pages
- **Option C**: Extract from existing exam solutions and enrich with source metadata

---

## Diagnostic Exam Flow

### Step 1: Create Diagnostic Exam Session

**Entry Point**: User clicks "Start Smart Final Practice" in finals UI

1. Create `exams` row (if not exists):
   - `course_id`, `exam_type = 'practice'`
2. Create `exam_sessions` row:
   - `user_id`, `exam_id`
   - **`is_diagnostic = true`** ⚠️ Critical flag
   - `started_at = now()`
   - `answers = '{}'` (empty JSONB snapshot)
3. Load questions via `exam_questions` join → render in UI

### Step 2: User Answers Questions

**Frontend**: Exam UI tracks answers in local state

1. **MCQs**: User selects option → stored in `exam_sessions.answers` JSONB
2. **FRQs**: User types in textarea → stored in `exam_sessions.answers` JSONB
   - Character count shown (derived from `user_answer.length`)
   - Expected word range shown (derived from `questions.frq_ideal_answer` length)

**Persistence**: Answers saved to `exam_sessions.answers` on navigation/change

### Step 3: Submit Exam

**Edge Function**: `supabase/functions/submit-exam/index.ts`

**Step 3.1: Save Answers to `exam_answers`**
```sql
INSERT INTO exam_answers (
  session_id,
  question_id,
  user_answer,  -- JSONB (MCQ: option, FRQ: text)
  is_flagged,
  answered_at
) VALUES (...);
```

**Step 3.2: Grade FRQ Questions**
- For each FRQ (`q_type = 'short' | 'long'`):
  - Call `gradeFRQ(question, userAnswer)` → LLM grading
  - Updates `exam_answers`:
    - `frq_score` (0-1 numeric)
    - `frq_feedback` (text)
    - `frq_confidence` (0-1 numeric)

**Grading Logic**: `supabase/functions/submit-exam/index.ts::gradeFRQ()`
- Uses `questions.frq_ideal_answer` + `questions.frq_rubric_md` as prompt
- Returns JSON: `{score: 0-1, feedback: string, confidence: 0-1}`

**Step 3.3: Calculate Scores**
- **MCQ**: Binary correct/incorrect (compare `user_answer` to `questions.correct_answer`)
- **FRQ**: Use `frq_score` from LLM grading
- **Per-topic breakdown**: Aggregate by `questions.topic_id`
  - MCQ: `correct / total` for topic
  - FRQ: `avg(frq_score)` for topic
  - **Weighted**: `0.7 * mcqScore + 0.3 * frqScore` (if both exist)

**Step 3.4: Update `exam_sessions`**
```sql
UPDATE exam_sessions SET
  submitted_at = now(),
  is_completed = true,
  score = <overall_score>,  -- 0-1 double precision
  topic_breakdown = <jsonb>  -- Per-topic stats
WHERE id = session_id;
```

---

## Diagnostic Summary

### Upsert `diagnostic_status`

**Trigger**: After exam submission, if `exam_sessions.is_diagnostic = true`

**Edge Function**: `supabase/functions/submit-exam/index.ts` (lines 585-621)

```sql
INSERT INTO diagnostic_status (
  user_id,
  course_id,
  completed,
  score,              -- ⚠️ INTEGER 0-100 (overall mastery %)
  completed_at,
  topic_mastery,       -- ⚠️ JSONB: {"topic_id": 0.45, ...} (0-1 floats)
  session_id           -- FK to exam_sessions.id (audit trail)
) VALUES (...)
ON CONFLICT (user_id, course_id) DO UPDATE SET
  completed = true,
  score = EXCLUDED.score,
  topic_mastery = EXCLUDED.topic_mastery,
  session_id = EXCLUDED.session_id,
  updated_at = now();
```

**Data Transformation**:
- `score`: Convert from 0-1 double → **0-100 integer** (shown as "82% Overall Mastery" in UI)
- `topic_mastery`: Map of `topic_id → mastery_float` (0-1), e.g.:
  ```json
  {
    "550e8400-e29b-41d4-a716-446655440000": 0.42,
    "660e8400-e29b-41d4-a716-446655440001": 0.78
  }
  ```

**Note**: There's a discrepancy in code - `submit-exam/index.ts` line 607 stores `score / 100` (0-1), but schema expects `score` as `integer`. The frontend (`DiagnosticResults.tsx`) expects 0-100. **Verify this in your implementation** - likely the Edge Function should store `Math.round(score * 100)`.

---

## Study Plan Generation

### Step 1: Trigger Generation

**Entry Point**: User clicks "Generate My Study Plan →" on `DiagnosticResults` page

**API Call**: `src/lib/api.ts::generateStudyPlan()`
- Reads `user_final_preferences` (final date, daily minutes)
- Calls Trigger.dev task: `generate-study-plan`

### Step 2: Trigger.dev Task

**Task**: `trigger/tasks/generate-study-plan.ts::generateStudyPlan`

**Inputs**:
- `userId`, `courseId`
- `targetDate` (from `user_final_preferences.final_exam_date`)
- `dailyMinutes` (from `user_final_preferences.daily_study_minutes`)
- `diagnostic_status.topic_mastery` (JSONB map)

**Step 2.1: Fetch Prerequisites**
- Course info (`courses`, `topics`)
- Knowledge graph edges (`course_graph_edges`) for prerequisite ordering
- User mastery (`diagnostic_status.topic_mastery` OR `topic_mastery` table fallback)

**Step 2.2: LLM Generation**
- System prompt: Study plan generation with spaced repetition, prerequisite ordering
- User prompt: Course + topics + mastery levels + time budget
- LLM returns JSON:
  ```json
  {
    "title": "CSE 120 Finals Prep - 7 Day Plan",
    "overview": "...",
    "weak_topics": ["topic_id_1", "topic_id_2"],
    "priority_order": ["topic_id_1", "topic_id_2", ...],
    "daily_plan": [
      {
        "day": 1,
        "date": "2024-12-01",
        "focus_topics": ["topic_id_1"],
        "tasks": [
          {
            "type": "read" | "practice" | "review" | "quiz" | "rest",
            "description": "...",
            "duration_minutes": 20,
            "topic_id": "...",
            "topic_name": "...",
            "priority": 1 | 2 | 3
          }
        ],
        "estimated_minutes": 60
      }
    ],
    "tips": ["..."]
  }
  ```

**Step 2.3: Save to `study_plans`**
```sql
-- Archive existing active plan
UPDATE study_plans SET status = 'archived'
WHERE user_id = ? AND course_id = ? AND status = 'active';

-- Insert new plan
INSERT INTO study_plans (
  user_id,
  course_id,
  title,
  target_date,
  daily_minutes,
  plan_content,        -- ⚠️ JSONB: parsed.daily_plan array
  weak_topics,         -- ⚠️ JSONB: parsed.weak_topics array
  priority_order,      -- ⚠️ JSONB: parsed.priority_order array
  model_used,
  generated_at,
  status,              -- 'active'
  progress_percent     -- 0
) VALUES (...);
```

**Output**: Plan row exists → UI reads from `study_plans` to render `/course/<id>/finals/plan`

---

## Table Relationships & Data Flow

### Foreign Key Graph

```
courses
  ├── topics (course_id)
  ├── documents (course_id)
  │   ├── document_pages (document_id)
  │   │   ├── document_chunks (page_id)
  │   │   └── page_embeddings_v2 (document_id, page_number)
  ├── questions (course_id, topic_id)
  │   └── exam_questions (question_id)
  ├── exams (course_id)
  │   ├── exam_sessions (exam_id)
  │   │   ├── exam_answers (session_id, question_id)
  │   │   └── diagnostic_status (session_id) ⚠️
  ├── diagnostic_status (course_id) ⚠️
  └── study_plans (course_id)
```

### Data Flow Diagram

```
[Storage Upload]
    ↓
documents → document_pages → document_chunks
    ↓
[Manual/LLM Question Generation]
    ↓
questions (with explanation_md, primary_source_*, frq_rubric_md)
    ↓
[User Starts Diagnostic]
    ↓
exams → exam_sessions (is_diagnostic=true)
    ↓
[User Answers Questions]
    ↓
exam_answers (user_answer, frq_score, frq_feedback, frq_confidence)
    ↓
[Submit Exam → Calculate Topic Mastery]
    ↓
diagnostic_status (score: 0-100, topic_mastery: JSONB)
    ↓
[Generate Study Plan]
    ↓
study_plans (plan_content, weak_topics, priority_order)
```

### Critical Paths

1. **Storage → Questions**: Documents must be processed → questions seeded with full metadata
2. **Questions → Exam**: `exam_questions` links questions to exams
3. **Exam → Diagnostic**: `exam_sessions.is_diagnostic = true` triggers `diagnostic_status` upsert
4. **Diagnostic → Plan**: `diagnostic_status.topic_mastery` feeds into `study_plans` generation

---

## Course Requirements for Finals Engine

**See**: [`docs/course-requirements-for-finals.md`](course-requirements-for-finals.md) for complete requirements documentation.

### Minimum Requirements

**For a course to work with the finals engine**:
- **MCQs** must have:
  - `explanation_md` (non-empty markdown)
  - `primary_source_type` (`'slide' | 'notes' | 'textbook' | 'handout'`)
  - `primary_source_locator` (e.g. `"Slide 13"`, `"Page 42"`)
- **FRQs** must have:
  - All MCQ fields above
  - `frq_ideal_answer` (reference answer text, ~80-120 words)
  - `frq_rubric_md` (markdown rubric with criteria and partial credit)

**Verification**: Use `scripts/verify-golden-course.sql` to check any course.

### Example Question Structure

```sql
-- 1. Create course
INSERT INTO courses (code, name, term) 
VALUES ('CSE120', 'Operating Systems', 'Fall 2024')
RETURNING id;

-- 2. Create topics
INSERT INTO topics (course_id, slug, name, week, order_index)
VALUES 
  ('<course_id>', 'processes', 'Processes', 1, 1),
  ('<course_id>', 'threads', 'Threads', 2, 2)
RETURNING id;

-- 3. Seed MCQ
INSERT INTO questions (
  course_id,
  topic_id,
  q_type,
  prompt,
  options,
  correct_answer,
  explanation_md,
  primary_source_type,
  primary_source_locator,
  difficulty
) VALUES (
  '<course_id>',
  '<topic_id>',
  'mcq',
  'Which of the following is NOT a necessary condition for deadlock?',
  '["A) Mutual Exclusion", "B) Hold and Wait", "C) Preemption", "D) Circular Wait"]'::jsonb,
  '"C) Preemption"'::jsonb,
  '## Deadlock Conditions

The four necessary conditions for deadlock are:
1. **Mutual Exclusion**: Resources cannot be shared
2. **Hold and Wait**: Process holds resource while waiting for another
3. **No Preemption**: Resources cannot be forcibly taken
4. **Circular Wait**: Circular chain of processes waiting for resources

Option C states "Preemption" which is the **opposite** of "No Preemption". Therefore, C is NOT a necessary condition.',
  'slide',
  'Slide 13',
  2
);

-- 4. Seed FRQ
INSERT INTO questions (
  course_id,
  topic_id,
  q_type,
  prompt,
  explanation_md,
  primary_source_type,
  primary_source_locator,
  frq_ideal_answer,
  frq_rubric_md,
  difficulty
) VALUES (
  '<course_id>',
  '<topic_id>',
  'long',
  'Explain how a page fault occurs and what actions the OS takes to handle it.',
  '## Page Fault Handling

A page fault occurs when a process accesses a virtual address that is not currently mapped to physical memory. The OS handles it by:
1. **Trap to kernel**: CPU generates interrupt
2. **Check page table**: Determine if page is valid
3. **Load page**: If valid but not in memory, load from disk
4. **Update page table**: Map virtual → physical address
5. **Resume execution**: Return to user mode',
  'slide',
  'Slide 27',
  'A page fault occurs when a process tries to access a virtual memory address that is not currently mapped to a physical page frame. When this happens, the CPU generates a trap to the operating system kernel. The OS first checks the page table entry to determine if the page is valid. If the page is valid but simply not in memory (present bit is 0), the OS initiates a disk I/O operation to load the page from the swap space or file system into an available physical frame. Once loaded, the OS updates the page table to map the virtual address to the physical frame, sets the present bit, and resumes the interrupted process. This process is transparent to the user process, which simply sees a brief pause in execution.',
  '## Grading Rubric

**Full Credit (1.0)**:
- Correctly identifies page fault trigger (virtual address not in physical memory)
- Explains trap/interrupt mechanism
- Describes page table check
- Mentions disk I/O to load page
- Notes page table update and process resumption

**Partial Credit (0.5-0.7)**:
- Identifies page fault but missing 2-3 key steps
- Confuses page fault with segmentation fault

**Minimal Credit (0.3-0.5)**:
- Only mentions "page not in memory" without mechanism

**No Credit (0.0-0.3)**:
- Incorrect explanation or no answer',
  2
);
```

---

## Verification Checklist

**Use**: `scripts/verify-golden-course.sql` to verify any course.

### For Existing Courses

**`questions` table**:
- [ ] All MCQs have `explanation_md` (non-empty)
- [ ] All MCQs have `primary_source_type` + `primary_source_locator`
- [ ] All FRQs have `frq_ideal_answer` + `frq_rubric_md`
- [ ] All questions linked to valid `topic_id`

### After Running Diagnostic

**`exam_sessions` table**:
- [ ] Row exists with `is_diagnostic = true`
- [ ] `submitted_at` is non-null
- [ ] `is_completed = true`
- [ ] `score` is populated (0-1 double precision)

**`exam_answers` table**:
- [ ] One row per question in exam
- [ ] MCQs: `user_answer` contains selected option
- [ ] FRQs: `user_answer` contains typed text
- [ ] FRQs: `frq_score` is 0-1 numeric (not null)
- [ ] FRQs: `frq_feedback` is non-empty text
- [ ] FRQs: `frq_confidence` is 0-1 numeric

**`diagnostic_status` table**:
- [ ] Row exists for `(user_id, course_id)`
- [ ] `completed = true`
- [ ] `score` is **integer 0-100** (overall mastery %)
- [ ] `topic_mastery` is JSONB with shape: `{"topic_id": 0.45, ...}`
- [ ] `session_id` matches `exam_sessions.id` of diagnostic run

### After Generating Study Plan

**`study_plans` table**:
- [ ] Row exists for `(user_id, course_id)`
- [ ] `status = 'active'`
- [ ] `plan_content` is JSONB array of daily plan objects
- [ ] `weak_topics` is JSONB array of topic IDs (sorted lowest → highest mastery)
- [ ] `priority_order` is JSONB array of topic IDs (prerequisite-ordered)
- [ ] `target_date` matches `user_final_preferences.final_exam_date`
- [ ] `daily_minutes` matches `user_final_preferences.daily_study_minutes`

### UI Verification

- [ ] **Study Relevant Content**: Shows purple explanation card + white source card + vector chunks
- [ ] **Diagnostic Results**: Shows "82% Overall Mastery" (from `diagnostic_status.score`)
- [ ] **Weak Topics**: Lists topics from `diagnostic_status.topic_mastery` (lowest → highest)
- [ ] **Study Plan**: Shows "Today's Plan" with tasks from `study_plans.plan_content[0]`
- [ ] **AI Chat**: References `questions.primary_source_locator` (e.g. "Slide 13") in responses

---

## Implementation Notes

### Known Discrepancies

1. **`diagnostic_status.score` type**: Schema says `integer`, but `submit-exam/index.ts` stores `score / 100` (0-1 double). **Fix**: Store `Math.round(score * 100)` as integer.

2. **`diagnostic_status.session_id` vs `diagnostic_session_id`**: Code uses `diagnostic_session_id` but schema column is `session_id`. **Verify** which is correct.

### Future Automation

- **Question Generation Script**: LLM-based tool to generate `explanation_md` and `frq_rubric_md` from question prompt + source document pages
- **Bulk Seeding**: Script to seed entire course from existing exam solutions with source metadata extraction
- **Validation Pipeline**: Automated checks to ensure all questions have required metadata before finals engine activation

---

## References

- **Document Processing**: `trigger/tasks/ingest-document.ts`, `trigger/tasks/embed-pdf-v2.ts`
- **Question Extraction**: `trigger/tasks/extract-questions.ts`
- **FRQ Grading**: `supabase/functions/submit-exam/index.ts::gradeFRQ()`
- **Diagnostic Status**: `supabase/functions/submit-exam/index.ts` (lines 585-621)
- **Study Plan Generation**: `trigger/tasks/generate-study-plan.ts`
- **Schema Migrations**: `supabase/migrations/20251203000000_add_explicit_question_content.sql`, `supabase/migrations/20251201130000_add_diagnostic_topic_mastery.sql`

