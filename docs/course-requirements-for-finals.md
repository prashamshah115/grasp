# Course Requirements for Finals Engine

**Purpose**: Document all database requirements for an existing course to work with the finals engine without breaking.

**Target Audience**: Engineers verifying or debugging courses in production, ensuring data integrity.

---

## Overview

For a course to fully support the finals engine (diagnostics, study plans, AI chat), specific fields must be populated in the `questions` table. Missing fields will cause UI components to fail or show fallback behavior.

---

## Required Fields by Question Type

### MCQ Questions (`q_type = 'mcq'`)

**Minimum Required Fields**:
- `explanation_md` (TEXT, non-empty)
- `primary_source_type` (TEXT, one of: `'slide' | 'notes' | 'textbook' | 'handout'`)
- `primary_source_locator` (TEXT, non-empty, e.g. `"Slide 13"`, `"Page 42"`)

**Optional but Recommended**:
- `primary_source_id` (TEXT, document UUID or URL for linking)

**What Breaks if Missing**:
- **Study Relevant Content panel**: Shows "Using similarity search" banner instead of explicit explanation card
- **AI Chat**: Falls back to vector search only, doesn't reference specific slide/page
- **User Experience**: Lower trust, no direct source citation

**SQL Check**:
```sql
SELECT id, prompt
FROM questions
WHERE course_id = '<course_id>'
  AND q_type = 'mcq'
  AND (
    explanation_md IS NULL 
    OR explanation_md = ''
    OR primary_source_type IS NULL
    OR primary_source_locator IS NULL
    OR primary_source_locator = ''
  );
```

---

### FRQ Questions (`q_type = 'short' | 'long'`)

**Minimum Required Fields**:
- All MCQ fields above (`explanation_md`, `primary_source_type`, `primary_source_locator`)
- `frq_ideal_answer` (TEXT, non-empty, reference answer text)
- `frq_rubric_md` (TEXT, non-empty, markdown rubric)

**What Breaks if Missing**:
- **FRQ Grading**: LLM grader has no rubric/ideal answer → returns low confidence scores
- **Expected Word Range**: UI can't calculate word count guidance (derived from `frq_ideal_answer` length)
- **User Feedback**: Generic feedback instead of rubric-based grading

**SQL Check**:
```sql
SELECT id, prompt
FROM questions
WHERE course_id = '<course_id>'
  AND q_type IN ('short', 'long')
  AND (
    explanation_md IS NULL 
    OR explanation_md = ''
    OR primary_source_type IS NULL
    OR primary_source_locator IS NULL
    OR primary_source_locator = ''
    OR frq_ideal_answer IS NULL
    OR frq_ideal_answer = ''
    OR frq_rubric_md IS NULL
    OR frq_rubric_md = ''
  );
```

---

## Diagnostic Exam Requirements

### Exam Setup

**Required**:
- At least one `exams` row with `exam_type = 'practice'` (for "Smart Final Practice")
- `exam_questions` linking questions to the exam
- Questions must have all required fields above

**What Breaks if Missing**:
- **"Start Smart Final Practice" button**: No exam available → button disabled or error
- **Diagnostic submission**: Missing question metadata → incomplete topic mastery calculation

**SQL Check**:
```sql
-- Check if practice exam exists
SELECT e.id, e.name, COUNT(eq.question_id) as question_count
FROM exams e
LEFT JOIN exam_questions eq ON e.id = eq.exam_id
WHERE e.course_id = '<course_id>'
  AND e.exam_type = 'practice'
GROUP BY e.id, e.name;

-- Check if exam questions have required metadata
SELECT 
  e.id as exam_id,
  COUNT(*) as total_questions,
  COUNT(*) FILTER (WHERE q.explanation_md IS NOT NULL AND q.explanation_md != '') as with_explanation,
  COUNT(*) FILTER (WHERE q.primary_source_type IS NOT NULL) as with_source_type,
  COUNT(*) FILTER (WHERE q.q_type IN ('short', 'long') AND q.frq_ideal_answer IS NOT NULL) as frqs_with_ideal
FROM exams e
JOIN exam_questions eq ON e.id = eq.exam_id
JOIN questions q ON eq.question_id = q.id
WHERE e.course_id = '<course_id>'
  AND e.exam_type = 'practice'
GROUP BY e.id;
```

---

## Diagnostic Status Requirements

### After Diagnostic Submission

**Required Fields in `diagnostic_status`**:
- `completed = true`
- `score` (INTEGER, 0-100, overall mastery percentage)
- `topic_mastery` (JSONB, map of `topic_id → mastery_float` where mastery is 0-1)
- `session_id` (UUID, FK to `exam_sessions.id` for audit trail)

**What Breaks if Missing**:
- **DiagnosticResults page**: Can't display overall mastery or weak topics
- **Study Plan Generation**: No topic mastery data → plan can't prioritize weak topics

**SQL Check**:
```sql
SELECT 
  id,
  user_id,
  course_id,
  completed,
  score,
  CASE 
    WHEN topic_mastery IS NULL THEN '❌ MISSING'
    WHEN jsonb_typeof(topic_mastery) != 'object' THEN '⚠️ INVALID FORMAT'
    ELSE '✅ OK (' || jsonb_object_keys(topic_mastery) || ' topics)'
  END as topic_mastery_status,
  session_id
FROM diagnostic_status
WHERE course_id = '<course_id>'
ORDER BY completed_at DESC
LIMIT 5;
```

---

## Study Plan Requirements

### After Plan Generation

**Required Fields in `study_plans`**:
- `plan_content` (JSONB array of daily plan objects)
- `weak_topics` (JSONB array of topic IDs, sorted lowest → highest mastery)
- `priority_order` (JSONB array of topic IDs, prerequisite-ordered)
- `status = 'active'`

**What Breaks if Missing**:
- **Study Plan UI**: Can't render "Today's Plan" or task list
- **Topic Ordering**: Weak topics don't appear first
- **Task Grouping**: Tasks can't be organized by topic

**SQL Check**:
```sql
SELECT 
  id,
  user_id,
  course_id,
  CASE 
    WHEN plan_content IS NULL THEN '❌ MISSING'
    WHEN jsonb_typeof(plan_content) != 'array' THEN '⚠️ INVALID FORMAT'
    ELSE '✅ OK (' || jsonb_array_length(plan_content) || ' days)'
  END as plan_content_status,
  CASE 
    WHEN weak_topics IS NULL THEN '⚠️ MISSING'
    WHEN jsonb_typeof(weak_topics) != 'array' THEN '⚠️ INVALID FORMAT'
    ELSE '✅ OK (' || jsonb_array_length(weak_topics) || ' topics)'
  END as weak_topics_status,
  status
FROM study_plans
WHERE course_id = '<course_id>'
  AND status = 'active'
ORDER BY generated_at DESC
LIMIT 5;
```

---

## Exam Answers Requirements (After Diagnostic)

### FRQ Grading Fields

**Required Fields in `exam_answers` for FRQs**:
- `frq_score` (NUMERIC, 0-1, from LLM grader)
- `frq_feedback` (TEXT, non-empty, from LLM grader)
- `frq_confidence` (NUMERIC, 0-1, grader confidence)

**What Breaks if Missing**:
- **Results Page**: Can't display FRQ scores or feedback
- **Topic Mastery Calculation**: FRQ performance not included in weighted score (70% MCQ, 30% FRQ)

**SQL Check**:
```sql
SELECT 
  ea.session_id,
  ea.question_id,
  q.prompt,
  CASE 
    WHEN ea.frq_score IS NULL THEN '❌ MISSING'
    WHEN ea.frq_score < 0 OR ea.frq_score > 1 THEN '⚠️ INVALID: ' || ea.frq_score
    ELSE '✅ ' || ea.frq_score
  END as score_status,
  CASE 
    WHEN ea.frq_feedback IS NULL OR ea.frq_feedback = '' THEN '❌ MISSING'
    ELSE '✅ OK'
  END as feedback_status,
  CASE 
    WHEN ea.frq_confidence IS NULL THEN '❌ MISSING'
    WHEN ea.frq_confidence < 0 OR ea.frq_confidence > 1 THEN '⚠️ INVALID: ' || ea.frq_confidence
    ELSE '✅ ' || ea.frq_confidence
  END as confidence_status
FROM exam_answers ea
JOIN questions q ON ea.question_id = q.id
WHERE q.course_id = '<course_id>'
  AND q.q_type IN ('short', 'long')
ORDER BY ea.session_id DESC
LIMIT 10;
```

---

## Complete Verification Checklist

Use `scripts/verify-golden-course.sql` (replace `course_id` variable) to run all checks at once.

**Quick Health Check**:
```sql
-- Replace with your course ID
\set course_id '<your-course-id>'

-- 1. Questions metadata
SELECT 'Questions' as category,
  COUNT(*) FILTER (WHERE q_type = 'mcq') as mcqs,
  COUNT(*) FILTER (WHERE q_type IN ('short', 'long')) as frqs,
  COUNT(*) FILTER (WHERE explanation_md IS NOT NULL AND explanation_md != '') as with_explanation,
  COUNT(*) FILTER (WHERE primary_source_type IS NOT NULL) as with_source_type,
  COUNT(*) FILTER (WHERE q_type IN ('short', 'long') AND frq_ideal_answer IS NOT NULL) as frqs_with_ideal
FROM questions
WHERE course_id = :'course_id';

-- 2. Practice exam exists
SELECT 'Practice Exam' as category,
  COUNT(*) as exam_count,
  COUNT(eq.question_id) as question_count
FROM exams e
LEFT JOIN exam_questions eq ON e.id = eq.exam_id
WHERE e.course_id = :'course_id'
  AND e.exam_type = 'practice';

-- 3. Diagnostic status
SELECT 'Diagnostic Status' as category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE completed = true) as completed,
  COUNT(*) FILTER (WHERE topic_mastery IS NOT NULL) as with_topic_mastery
FROM diagnostic_status
WHERE course_id = :'course_id';

-- 4. Study plans
SELECT 'Study Plans' as category,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE plan_content IS NOT NULL) as with_content
FROM study_plans
WHERE course_id = :'course_id';
```

---

## Migration Path for Existing Courses

If you have an existing course missing required fields:

1. **Add `explanation_md`**: Generate from question prompt + source documents using LLM
2. **Add `primary_source_*`**: Map questions to source documents/pages manually or via extraction
3. **Add FRQ fields**: For existing FRQs, generate `frq_ideal_answer` and `frq_rubric_md` from question context
4. **Verify**: Run `scripts/verify-golden-course.sql` to check all fields

**Automation Options**:
- Use `trigger/tasks/extract-questions.ts` to extract questions from exam documents
- Use LLM to generate `explanation_md` and `frq_rubric_md` from question prompts
- Map `primary_source_locator` by analyzing question content against document pages

---

## Breaking Changes

**If any required field is missing**:
- UI components show fallback behavior (e.g., "Using similarity search" banner)
- Features degrade gracefully but user experience is suboptimal
- No hard errors, but functionality is limited

**Critical Missing Fields** (causes errors):
- `questions.prompt` → Exam UI can't render question
- `questions.correct_answer` (for MCQs) → Can't grade MCQ
- `exams.course_id` → Can't link exam to course

---

## References

- **Schema**: `supabase/migrations/20251203000000_add_explicit_question_content.sql`
- **Verification Script**: `scripts/verify-golden-course.sql`
- **Full Roadmap**: `docs/cse120-generate-db-roadmap.md`

