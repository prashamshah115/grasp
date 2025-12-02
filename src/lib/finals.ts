/**
 * Finals Helper Functions
 * Centralized logic for finals flow operations
 */

import { fetchExams, createExamSession } from './api';
import { supabase } from './supabase';

/**
 * Start a practice final diagnostic exam session
 * Finds the practice final exam for a course and creates a diagnostic session
 */
export async function startPracticeFinalDiagnostic(
  courseId: string,
  userId: string
): Promise<{ sessionId: string; examId: string }> {
  // 1. Fetch exams for course
  const exams = await fetchExams(courseId);
  
  // 2. Find practice final (NOT final - that's the real exam)
  // Strict equality check - exam_type must be exactly 'practice'
  const practiceFinal = exams.find(
    exam => exam.exam_type === 'practice'
  );
  
  if (!practiceFinal) {
    throw new Error('NO_PRACTICE_FINAL');
  }
  
  // 3. Create exam session
  const session = await createExamSession({
    exam_id: practiceFinal.id,
  });
  
  // 4. Mark session as diagnostic in database (survives page refreshes)
  const { error: updateError } = await supabase
    .from('exam_sessions')
    .update({ 
      is_diagnostic: true,
    })
    .eq('id', session.session_id);
  
  if (updateError) {
    console.error('[startPracticeFinalDiagnostic] Failed to mark session as diagnostic:', updateError);
    // Don't throw - session was created, just diagnostic flag failed
    // This is non-critical for the exam to work
  }
  
  return {
    sessionId: session.session_id,
    examId: practiceFinal.id,
  };
}

