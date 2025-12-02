-- =====================================================
-- COURSE VERIFICATION SCRIPT
-- Purpose: Verify all required fields are populated for a course
-- Usage: Set course_id variable or replace :'course_id' with your course UUID
-- =====================================================

-- Set your course ID here (or pass as psql variable)
-- Example: \set course_id 'aaaaaaaa-0000-0000-0000-000000000001'
-- Or use: psql -v course_id="'your-course-uuid'" -f verify-golden-course.sql
\set course_id 'aaaaaaaa-0000-0000-0000-000000000001'

-- =====================================================
-- 1. VERIFY QUESTIONS TABLE
-- =====================================================

-- Check MCQs have explanation_md, primary_source_type, primary_source_locator
SELECT 
  'MCQ Metadata Check' as check_type,
  id,
  prompt,
  CASE 
    WHEN explanation_md IS NULL OR explanation_md = '' THEN '❌ MISSING explanation_md'
    ELSE '✅ explanation_md'
  END as explanation_status,
  CASE 
    WHEN primary_source_type IS NULL THEN '❌ MISSING primary_source_type'
    ELSE '✅ primary_source_type: ' || primary_source_type
  END as source_type_status,
  CASE 
    WHEN primary_source_locator IS NULL OR primary_source_locator = '' THEN '❌ MISSING primary_source_locator'
    ELSE '✅ primary_source_locator: ' || primary_source_locator
  END as source_locator_status
FROM questions
WHERE course_id = :'course_id'
  AND q_type = 'mcq'
ORDER BY id;

-- Check FRQs have all required fields
SELECT 
  'FRQ Metadata Check' as check_type,
  id,
  prompt,
  CASE 
    WHEN explanation_md IS NULL OR explanation_md = '' THEN '❌ MISSING explanation_md'
    ELSE '✅ explanation_md'
  END as explanation_status,
  CASE 
    WHEN primary_source_type IS NULL THEN '❌ MISSING primary_source_type'
    ELSE '✅ primary_source_type: ' || primary_source_type
  END as source_type_status,
  CASE 
    WHEN primary_source_locator IS NULL OR primary_source_locator = '' THEN '❌ MISSING primary_source_locator'
    ELSE '✅ primary_source_locator: ' || primary_source_locator
  END as source_locator_status,
  CASE 
    WHEN frq_ideal_answer IS NULL OR frq_ideal_answer = '' THEN '❌ MISSING frq_ideal_answer'
    ELSE '✅ frq_ideal_answer (' || LENGTH(frq_ideal_answer) || ' chars)'
  END as ideal_answer_status,
  CASE 
    WHEN frq_rubric_md IS NULL OR frq_rubric_md = '' THEN '❌ MISSING frq_rubric_md'
    ELSE '✅ frq_rubric_md'
  END as rubric_status
FROM questions
WHERE course_id = :'course_id'
  AND q_type IN ('short', 'long')
ORDER BY id;

-- =====================================================
-- 2. VERIFY EXAM_ANSWERS (after diagnostic run)
-- =====================================================

-- Check FRQ grading fields are populated
SELECT 
  'FRQ Grading Check' as check_type,
  ea.session_id,
  ea.question_id,
  q.prompt,
  CASE 
    WHEN ea.frq_score IS NULL THEN '❌ MISSING frq_score'
    WHEN ea.frq_score < 0 OR ea.frq_score > 1 THEN '⚠️ INVALID frq_score: ' || ea.frq_score
    ELSE '✅ frq_score: ' || ea.frq_score
  END as score_status,
  CASE 
    WHEN ea.frq_feedback IS NULL OR ea.frq_feedback = '' THEN '❌ MISSING frq_feedback'
    ELSE '✅ frq_feedback (' || LENGTH(ea.frq_feedback) || ' chars)'
  END as feedback_status,
  CASE 
    WHEN ea.frq_confidence IS NULL THEN '❌ MISSING frq_confidence'
    WHEN ea.frq_confidence < 0 OR ea.frq_confidence > 1 THEN '⚠️ INVALID frq_confidence: ' || ea.frq_confidence
    ELSE '✅ frq_confidence: ' || ea.frq_confidence
  END as confidence_status
FROM exam_answers ea
JOIN questions q ON ea.question_id = q.id
WHERE q.course_id = :'course_id'
  AND q.q_type IN ('short', 'long')
ORDER BY ea.session_id, ea.question_id;

-- =====================================================
-- 3. VERIFY DIAGNOSTIC_STATUS (after diagnostic submission)
-- =====================================================

SELECT 
  'Diagnostic Status Check' as check_type,
  ds.id,
  ds.user_id,
  ds.course_id,
  CASE 
    WHEN ds.completed = false THEN '❌ NOT completed'
    ELSE '✅ completed'
  END as completed_status,
  CASE 
    WHEN ds.score IS NULL THEN '❌ MISSING score'
    WHEN ds.score < 0 OR ds.score > 100 THEN '⚠️ INVALID score: ' || ds.score
    ELSE '✅ score: ' || ds.score || '%'
  END as score_status,
  CASE 
    WHEN ds.topic_mastery IS NULL THEN '❌ MISSING topic_mastery'
    WHEN jsonb_typeof(ds.topic_mastery) != 'object' THEN '⚠️ INVALID topic_mastery format'
    ELSE '✅ topic_mastery (' || jsonb_object_keys(ds.topic_mastery) || ' topics)'
  END as topic_mastery_status,
  CASE 
    WHEN ds.session_id IS NULL THEN '⚠️ MISSING session_id (audit trail)'
    ELSE '✅ session_id: ' || ds.session_id
  END as session_status,
  ds.completed_at
FROM diagnostic_status ds
WHERE ds.course_id = :'course_id'
ORDER BY ds.completed_at DESC
LIMIT 5;

-- =====================================================
-- 4. VERIFY STUDY_PLANS (after plan generation)
-- =====================================================

SELECT 
  'Study Plan Check' as check_type,
  sp.id,
  sp.user_id,
  sp.course_id,
  sp.title,
  sp.target_date,
  sp.daily_minutes,
  CASE 
    WHEN sp.plan_content IS NULL THEN '❌ MISSING plan_content'
    WHEN jsonb_typeof(sp.plan_content) != 'array' THEN '⚠️ INVALID plan_content format'
    ELSE '✅ plan_content (' || jsonb_array_length(sp.plan_content) || ' days)'
  END as plan_content_status,
  CASE 
    WHEN sp.weak_topics IS NULL THEN '⚠️ MISSING weak_topics'
    WHEN jsonb_typeof(sp.weak_topics) != 'array' THEN '⚠️ INVALID weak_topics format'
    ELSE '✅ weak_topics (' || jsonb_array_length(sp.weak_topics) || ' topics)'
  END as weak_topics_status,
  CASE 
    WHEN sp.priority_order IS NULL THEN '⚠️ MISSING priority_order'
    WHEN jsonb_typeof(sp.priority_order) != 'array' THEN '⚠️ INVALID priority_order format'
    ELSE '✅ priority_order (' || jsonb_array_length(sp.priority_order) || ' items)'
  END as priority_order_status,
  sp.status,
  sp.progress_percent,
  sp.generated_at
FROM study_plans sp
WHERE sp.course_id = :'course_id'
  AND sp.status = 'active'
ORDER BY sp.generated_at DESC
LIMIT 5;

-- =====================================================
-- 5. SUMMARY REPORT
-- =====================================================

SELECT 
  '=== COURSE VERIFICATION SUMMARY ===' as report;

SELECT 
  'Questions' as category,
  COUNT(*) FILTER (WHERE q_type = 'mcq') as mcqs,
  COUNT(*) FILTER (WHERE q_type IN ('short', 'long')) as frqs,
  COUNT(*) FILTER (WHERE explanation_md IS NOT NULL AND explanation_md != '') as with_explanation,
  COUNT(*) FILTER (WHERE primary_source_type IS NOT NULL) as with_source_type,
  COUNT(*) FILTER (WHERE primary_source_locator IS NOT NULL) as with_source_locator,
  COUNT(*) FILTER (WHERE q_type IN ('short', 'long') AND frq_ideal_answer IS NOT NULL) as frqs_with_ideal,
  COUNT(*) FILTER (WHERE q_type IN ('short', 'long') AND frq_rubric_md IS NOT NULL) as frqs_with_rubric
FROM questions
WHERE course_id = :'course_id';

SELECT 
  'Diagnostic Status' as category,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE completed = true) as completed,
  COUNT(*) FILTER (WHERE score IS NOT NULL AND score BETWEEN 0 AND 100) as with_valid_score,
  COUNT(*) FILTER (WHERE topic_mastery IS NOT NULL) as with_topic_mastery
FROM diagnostic_status
WHERE course_id = :'course_id';

SELECT 
  'Study Plans' as category,
  COUNT(*) as total_plans,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE plan_content IS NOT NULL) as with_plan_content,
  COUNT(*) FILTER (WHERE weak_topics IS NOT NULL) as with_weak_topics
FROM study_plans
WHERE course_id = :'course_id';

