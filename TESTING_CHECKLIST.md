# Finals App Testing Checklist

## Pre-Testing Setup

1. **Run Migration**
   ```bash
   # Apply the new migration
   supabase db reset  # or push the migration
   ```

2. **Seed Test Data**
   - Create a test course
   - Add questions with explicit content fields:
     - Set `explanation_md` with sample markdown
     - Set `primary_source_type` (e.g., 'slide')
     - Set `primary_source_locator` (e.g., 'Slide 13')
   - Add FRQ questions with:
     - `frq_ideal_answer`
     - `frq_rubric_md`

3. **Environment Variables**
   - Ensure `OPENAI_API_KEY` is set in Supabase Edge Functions

---

## FEATURE 1: Study Relevant Content ✅

### Test: Explicit Explanation Display

- [ ] **Navigate to exam with question that has `explanation_md`**
  - Click "Study Relevant Content" button
  - Verify formatted explanation appears FIRST (blue background card)
  - Verify markdown rendering works (headers, lists, code, bold)

- [ ] **Test Primary Source Card**
  - Verify source card shows below explanation
  - Check source type badge displays correctly
  - Check locator text (e.g., "Slide 13") appears
  - If `primary_source_id` is URL, verify "Open Source →" link works

- [ ] **Test Fallback Behavior**
  - View question WITHOUT explicit content
  - Verify message: "Using similarity search - exact references coming soon"
  - Verify vector-based content still displays

- [ ] **Test Divider**
  - For questions WITH explicit content
  - Verify "📚 Additional References" divider appears
  - Verify vector results show BELOW divider

---

## FEATURE 2: Diagnostic with FRQ Grading ✅

### Test: FRQ Question Display

- [ ] **Start diagnostic exam with FRQ questions**
  - Verify FRQ textarea displays with enhanced placeholder
  - Verify character count appears below textarea
  - Verify word count guidance shows (if ideal answer exists)
  - Type answer and verify count updates in real-time

### Test: FRQ Grading

- [ ] **Submit diagnostic with FRQ answers**
  - Submit exam with at least one FRQ answered
  - Wait for grading (should take 2-5 seconds per FRQ)
  - Verify no errors during submission

### Test: Diagnostic Results Screen

- [ ] **View diagnostic results**
  - Verify new DiagnosticResults component renders
  - Check overall mastery score displays (large percentage)
  - Verify performance level indicator (Excellent/Good/Fair/Needs Work)
  - Check performance message matches score level

- [ ] **Verify Topic Breakdown**
  - "Priority Focus Areas" card shows weakest 3 topics
  - Topics ranked by score (weakest first)
  - Percentage shown for each topic

- [ ] **Full Topic Breakdown**
  - All topics listed with progress bars
  - Weak topics (< 60%) shown in red
  - Strong topics (≥ 60%) shown in green
  - Progress bars fill correctly

- [ ] **CTA Button**
  - "Generate My Study Plan" button displays
  - Click button
  - Verify navigation to study plan page

### Test: Weighted Scoring

- [ ] **Verify Score Calculation**
  - Take diagnostic with both MCQ and FRQ
  - Calculate expected score: `(0.7 * MCQ_score) + (0.3 * FRQ_score)`
  - Verify displayed score matches formula

- [ ] **Check Topic Mastery**
  - Open database and check `diagnostic_status` table
  - Verify `topic_mastery` JSON has correct topic scores
  - Verify scores are between 0 and 1
  - Verify `diagnostic_session_id` is stored

---

## FEATURE 3: AI Chat (Course-Aware) ✅

### Test: Explicit Content in Chat

- [ ] **Open chat from question with explicit content**
  - Verify context badge shows: "💬 Asking about this question"
  - Ask a question about the topic
  - Verify response references course materials
  - Check if explanation from `explanation_md` is used in response

### Test: Vector Search Limit

- [ ] **Monitor chat performance**
  - Open chat on any question
  - Check network tab for `rag-chat` function call
  - Verify only 3 document chunks are returned (check logs or response)

### Test: Chat Quality

- [ ] **Ask question about course material**
  - Response should prioritize explicit explanations
  - Should cite slide/page numbers when available
  - Should feel like course-specific tutor (not generic AI)

---

## FEATURE 4: Study Plan (Already Working) ✅

### Test: Plan Generation After Diagnostic

- [ ] **Complete diagnostic → Navigate to study plan**
  - Verify plan generates automatically
  - Check "Today's Plan" section appears first
  - Verify weak topics from diagnostic are prioritized

- [ ] **Check Plan Layout**
  - Today's tasks shown prominently at top
  - Days until final counter displays
  - Weak topics highlighted in plan content
  - Can check off tasks

---

## Integration Tests

### Test: Complete Finals Flow

- [ ] **End-to-End Flow**
  1. Set exam date on Finals Pack card
  2. Start diagnostic (practice final)
  3. Answer mix of MCQ and FRQ questions
  4. Submit diagnostic
  5. View diagnostic results screen
  6. Click "Generate Study Plan"
  7. Verify study plan appears with today's tasks
  8. Check off a task
  9. Open chat from a question
  10. Verify relevant content shows explicit explanation

### Test: Data Persistence

- [ ] **Diagnostic Status**
  - Complete diagnostic
  - Refresh page
  - Verify diagnostic still shows as completed
  - Check `diagnostic_status` table has record

- [ ] **FRQ Grading Storage**
  - Submit exam with FRQ
  - Query `exam_answers` table
  - Verify `frq_score`, `frq_feedback`, `frq_confidence` are stored

---

## Error Handling Tests

### Test: Missing Data Gracefully

- [ ] **Question without explicit content**
  - Should show fallback message
  - Should still display vector results
  - Should not crash

- [ ] **FRQ without ideal answer**
  - Grading should still work
  - May show lower confidence
  - Should not block submission

- [ ] **Chat without course materials**
  - Should fallback to LLM general knowledge
  - Should show appropriate message

### Test: API Failures

- [ ] **Temporarily break OPENAI_API_KEY**
  - Submit FRQ exam
  - Should return score of 0 with message "requires manual review"
  - Should not block exam submission

---

## Performance Checks

- [ ] **FRQ Grading Speed**
  - 5 FRQ questions should grade in < 30 seconds total
  - User should see submission processing indicator

- [ ] **Chat Response Time**
  - With explicit content: < 3 seconds
  - Without explicit content: < 5 seconds

- [ ] **Study Content Load**
  - Panel should open in < 1 second
  - Markdown should render immediately

---

## Browser Compatibility

- [ ] **Chrome** - All features work
- [ ] **Safari** - All features work
- [ ] **Firefox** - All features work
- [ ] **Mobile Safari** - Core features functional

---

## Success Criteria

### Must Pass:
- ✅ Study Relevant Content shows explicit explanation first
- ✅ FRQ questions get graded with feedback
- ✅ Diagnostic Results screen displays correctly
- ✅ Topic mastery calculated with weighted formula
- ✅ Study plan generates after diagnostic
- ✅ Chat includes course materials context

### Nice to Have:
- All topics have explicit content
- FRQ grading confidence > 0.7
- Chat responses cite specific slides/pages
- Zero JavaScript errors in console

---

## Known Issues / Limitations

1. **FRQ Grading Requires OpenAI API**
   - Cost: ~$0.002 per FRQ question
   - Rate limit: 60 requests/minute

2. **Explicit Content Must Be Manually Added**
   - Requires updating questions table
   - Consider bulk import/sync tool

3. **Diagnostic Must Be Completed for Study Plan**
   - By design - ensures personalization

---

## Next Steps After Testing

1. **Seed Production Data**
   - Add explicit content to real course questions
   - Focus on most common/important questions first

2. **Monitor Costs**
   - Track OpenAI API usage for FRQ grading
   - Consider caching grading results

3. **Gather Student Feedback**
   - Survey students after using diagnostic
   - Track which features are most valuable

4. **Iterate Based on Usage**
   - Analytics on explicit content vs vector content usage
   - Which topics need better explanations
   - FRQ grading accuracy feedback

