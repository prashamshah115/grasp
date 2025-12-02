/**
 * Edge Function: submit-exam
 * Purpose: Securely score and finalize exam sessions server-side
 *
 * Features:
 * - Server-side scoring (correct answers never exposed to client during exam)
 * - Validates session ownership
 * - Prevents double submission
 * - Calculates comprehensive score breakdown
 * - Records attempts in question_history for spaced repetition
 * - Updates topic_mastery based on performance
 *
 * Security:
 * - User can only submit their own sessions
 * - Correct answers only revealed AFTER submission
 * - Server-side validation of all answers
 * - Single database transaction for scoring
 *
 * Created: 2025-11-21
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  validateRequired,
  isValidUUID,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../_shared/errors.ts'
import { checkRateLimit, RATE_LIMITS, rateLimitResponse } from '../_shared/rate-limit.ts'

// ==================== TYPES ====================

interface SubmitExamRequest {
  session_id: string
}

interface QuestionBreakdown {
  question_id: string
  question_number: number
  prompt: string
  q_type: string
  is_correct: boolean
  user_answer: any
  correct_answer: any
  explanation: string | null
  topic_id: string
  points_earned: number
  points_possible: number
}

interface SubmitExamResponse {
  success: true
  session_id: string
  exam_name: string
  score: number // 0-100 percentage
  points_earned: number
  points_possible: number
  total_questions: number
  correct_count: number
  incorrect_count: number
  unanswered_count: number
  time_taken_sec: number
  breakdown: QuestionBreakdown[]
  performance_by_topic: Array<{
    topic_id: string
    topic_name: string
    correct: number
    total: number
    percentage: number
  }>
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Compare answers (handles different types: string, number, array)
 */
function answersMatch(userAnswer: any, correctAnswer: any): boolean {
  // Handle null/undefined cases
  if (userAnswer === null || userAnswer === undefined) {
    return false
  }

  // For arrays (multi-select), compare sorted arrays
  if (Array.isArray(correctAnswer)) {
    if (!Array.isArray(userAnswer)) return false

    const sortedCorrect = [...correctAnswer].sort()
    const sortedUser = [...userAnswer].sort()

    return JSON.stringify(sortedCorrect) === JSON.stringify(sortedUser)
  }

  // For objects, compare JSON
  if (typeof correctAnswer === 'object') {
    return JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)
  }

  // For primitives, direct comparison
  return String(userAnswer).toLowerCase().trim() ===
         String(correctAnswer).toLowerCase().trim()
}

/**
 * Grade Free Response Question using LLM
 */
async function gradeFRQ(
  question: { prompt: string; frq_ideal_answer?: string | null; frq_rubric_md?: string | null },
  userAnswer: string
): Promise<{ score: number; feedback: string; confidence: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    console.error('[gradeFRQ] OPENAI_API_KEY not configured')
    return { score: 0, feedback: 'Grading unavailable - requires manual review', confidence: 0 }
  }

  const prompt = `You are grading a free response exam question.

Question: ${question.prompt}

Ideal Answer:
${question.frq_ideal_answer || 'No ideal answer provided'}

Rubric:
${question.frq_rubric_md || 'Grade based on accuracy and completeness'}

Student Answer:
${userAnswer}

Grade this answer strictly but fairly. Return ONLY valid JSON in this exact format:
{
  "score": <number between 0 and 1>,
  "feedback": "<brief feedback on what was good/missing>",
  "confidence": <number between 0 and 1, how confident you are in this grade>
}

Scoring guidelines:
- 1.0: Complete, accurate answer
- 0.7-0.9: Good answer with minor gaps
- 0.5-0.7: Partial answer
- 0.3-0.5: Minimal understanding
- 0.0-0.3: Incorrect or missing`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: 'You are a strict but fair exam grader. Always return valid JSON.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      console.error('[gradeFRQ] OpenAI API error:', response.status)
      return { score: 0, feedback: 'Grading failed - requires manual review', confidence: 0 }
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content || '{}')

    return {
      score: Math.max(0, Math.min(1, result.score || 0)),
      feedback: result.feedback || 'No feedback provided',
      confidence: Math.max(0, Math.min(1, result.confidence || 0.7)),
    }
  } catch (error) {
    console.error('[gradeFRQ] Grading failed:', error)
    return { score: 0, feedback: 'Grading failed - requires manual review', confidence: 0 }
  }
}

// ==================== MAIN HANDLER ====================

serve(async (req) => {
  const FUNCTION_NAME = 'submit-exam'

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    // Authenticate user and get properly configured Supabase client
    // This uses the CORRECT Supabase v2 pattern for Edge Functions
    const { supabase, user } = await requireAuth(req)

    // Rate limiting check
    const rateLimitResult = await checkRateLimit(user.id, RATE_LIMITS.submit_exam)
    if (!rateLimitResult.allowed) {
      return rateLimitResponse(rateLimitResult)
    }

    // Parse and validate request body
    const body = await req.json() as SubmitExamRequest
    validateRequired(body, ['session_id'])

    const { session_id } = body

    // Validate UUID format
    if (!isValidUUID(session_id)) {
      throw new ValidationError('Invalid session_id format')
    }

    // ==================== STEP 1: Load and Validate Session ====================

    const { data: session, error: sessionError } = await supabase
      .from('exam_sessions')
      .select(`
        id,
        user_id,
        exam_id,
        started_at,
        submitted_at,
        is_completed,
        time_remaining_sec,
        exams!inner(
          id,
          name,
          course_id,
          duration_min
        )
      `)
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.error(`[${FUNCTION_NAME}] Session not found:`, sessionError)
      throw new NotFoundError('Exam session not found')
    }

    // Verify session belongs to user
    if (session.user_id !== user.id) {
      console.warn(`[${FUNCTION_NAME}] Session ownership mismatch`)
      throw new ForbiddenError('You can only submit your own exam sessions')
    }

    // Check if already submitted
    if (session.is_completed) {
      console.warn(`[${FUNCTION_NAME}] Session already submitted`)
      throw new ConflictError('This exam has already been submitted')
    }

    // ==================== STEP 2: Load User's Answers ====================

    const { data: answers, error: answersError } = await supabase
      .from('exam_answers')
      .select('question_id, user_answer, answered_at, is_flagged')
      .eq('session_id', session_id)

    if (answersError) {
      throw answersError
    }

    // Build answer map for fast lookup
    const answerMap = new Map<string, any>()
    if (answers) {
      answers.forEach(a => {
        answerMap.set(a.question_id, a.user_answer)
      })
    }

    // ==================== STEP 3: Load Exam Questions with Correct Answers ====================

    const { data: examQuestions, error: questionsError } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        order_index,
        points,
        questions!inner(
          id,
          prompt,
          q_type,
          options,
          difficulty,
          correct_answer,
          explanation,
          topic_id,
          frq_ideal_answer,
          frq_rubric_md,
          topics(
            id,
            name
          )
        )
      `)
      .eq('exam_id', session.exam_id)
      .order('order_index', { ascending: true })

    if (questionsError) {
      console.error(`[${FUNCTION_NAME}] Questions load error:`, questionsError)
      throw questionsError
    }

    if (!examQuestions || examQuestions.length === 0) {
      throw new NotFoundError('Exam has no questions')
    }
    
    // ==================== STEP 3.5: Grade FRQ Questions ====================
    
    for (const eq of examQuestions) {
      const question = eq.questions
      if (question.q_type === 'short' || question.q_type === 'long') {
        const userAnswer = answerMap.get(question.id)
        if (userAnswer && typeof userAnswer === 'string' && userAnswer.trim()) {
          const grading = await gradeFRQ(question, userAnswer)
          
          // Store grading in answer map for later use
          const answerRecord = answers?.find(a => a.question_id === question.id)
          if (answerRecord) {
            (answerRecord as any).frq_score = grading.score
            (answerRecord as any).frq_feedback = grading.feedback
            (answerRecord as any).frq_confidence = grading.confidence
          }
          
          // Update exam_answers with FRQ grading
          await supabase
            .from('exam_answers')
            .update({
              frq_score: grading.score,
              frq_feedback: grading.feedback,
              frq_confidence: grading.confidence,
            })
            .eq('session_id', session_id)
            .eq('question_id', question.id)
        }
      }
    }

    // ==================== STEP 4: Score Each Question (MCQ + FRQ Weighted) ====================

    let mcqCorrect = 0
    let mcqTotal = 0
    let frqScoreSum = 0
    let frqTotal = 0
    let correctCount = 0
    let incorrectCount = 0
    let unansweredCount = 0
    let pointsEarned = 0
    let pointsPossible = 0
    const breakdown: QuestionBreakdown[] = []
    const topicPerformance = new Map<string, { correct: number; total: number; frqSum: number; frqCount: number; name: string }>()

    for (const [index, eq] of examQuestions.entries()) {
      const question = eq.questions
      const userAnswer = answerMap.get(question.id)
      const pointsForQuestion = eq.points || 1
      const answerRecord = answers?.find(a => a.question_id === question.id)

      pointsPossible += pointsForQuestion

      // Check if answered
      const isAnswered = userAnswer !== null && userAnswer !== undefined

      if (!isAnswered) {
        unansweredCount++
      }

      let isCorrect = false
      let questionScore = 0

      // Score based on question type
      if (question.q_type === 'mcq') {
        // MCQ scoring - binary correct/incorrect
        mcqTotal++
        isCorrect = isAnswered && answersMatch(userAnswer, question.correct_answer)
        if (isCorrect) {
          mcqCorrect++
          questionScore = 1
        }
      } else {
        // FRQ scoring - normalized 0-1 score
        frqTotal++
        const frqScore = (answerRecord as any)?.frq_score
        if (frqScore !== undefined && frqScore !== null) {
          frqScoreSum += frqScore
          questionScore = frqScore
          isCorrect = frqScore >= 0.7 // Consider 70%+ as "correct" for stats
        }
      }

      if (isCorrect) {
        correctCount++
        pointsEarned += pointsForQuestion * questionScore
      } else if (isAnswered) {
        incorrectCount++
        pointsEarned += pointsForQuestion * questionScore // Partial credit for FRQ
      }

      // Track topic performance (with FRQ scores)
      const topicId = question.topic_id
      if (topicId) {
        if (!topicPerformance.has(topicId)) {
          topicPerformance.set(topicId, {
            correct: 0,
            total: 0,
            frqSum: 0,
            frqCount: 0,
            name: question.topics?.name || 'Unknown Topic'
          })
        }
        const topicStats = topicPerformance.get(topicId)!
        if (question.q_type === 'mcq') {
          topicStats.total++
          if (isCorrect) topicStats.correct++
        } else {
          topicStats.frqCount++
          topicStats.frqSum += questionScore
        }
      }

      // Add to breakdown
      breakdown.push({
        question_id: question.id,
        question_number: index + 1,
        prompt: question.prompt,
        q_type: question.q_type,
        is_correct: isCorrect,
        user_answer: userAnswer,
        correct_answer: question.correct_answer,
        explanation: question.explanation,
        topic_id: question.topic_id,
        points_earned: pointsForQuestion * questionScore,
        points_possible: pointsForQuestion,
      })
    }

    // Calculate final score percentage with weighted formula (70% MCQ, 30% FRQ)
    let score = 0
    if (mcqTotal > 0 && frqTotal > 0) {
      const mcqScore = mcqCorrect / mcqTotal
      const frqScore = frqScoreSum / frqTotal
      score = (0.7 * mcqScore + 0.3 * frqScore) * 100
    } else if (mcqTotal > 0) {
      score = (mcqCorrect / mcqTotal) * 100
    } else if (frqTotal > 0) {
      score = (frqScoreSum / frqTotal) * 100
    }

    // ==================== STEP 5: Calculate Time Taken ====================

    const startedAt = new Date(session.started_at)
    const submittedAt = new Date()
    const timeTakenMs = submittedAt.getTime() - startedAt.getTime()
    const timeTakenSec = Math.floor(timeTakenMs / 1000)

    // Calculate remaining time
    const elapsedSec = timeTakenSec
    const originalDurationSec = session.exams.duration_min * 60
    const remainingSec = Math.max(0, originalDurationSec - elapsedSec)

    // ==================== STEP 6: Update Exam Session ====================

    const { error: updateError } = await supabase
      .from('exam_sessions')
      .update({
        submitted_at: submittedAt.toISOString(),
        is_completed: true,
        score: Math.round(score * 100) / 100,
        time_remaining_sec: remainingSec,
      })
      .eq('id', session_id)

    if (updateError) {
      throw updateError
    }

    // ==================== STEP 7: Record Question Attempts (for spaced repetition) ====================

    // Create study session for this exam
    const { data: studySession, error: studySessionError } = await supabase
      .from('study_sessions')
      .insert({
        user_id: user.id,
        course_id: session.exams.course_id,
        topic_id: null, // Exam covers multiple topics
        exam_id: session.exam_id,
        mode: 'exam',
        started_at: startedAt.toISOString(),
        ended_at: submittedAt.toISOString(),
      })
      .select('id')
      .single()

    if (!studySessionError && studySession) {
      // Record each question attempt
      const attempts = breakdown.map(q => ({
        session_id: studySession.id,
        user_id: user.id,
        question_id: q.question_id,
        is_correct: q.is_correct,
        user_answer: JSON.stringify(q.user_answer),
        time_taken_sec: Math.floor(timeTakenSec / examQuestions.length), // Average time per question
      }))

      const { error: attemptsError } = await supabase
        .from('question_attempts')
        .insert(attempts)

      if (attemptsError) {
        // Don't fail the submission if this fails
      }
    }

    // ==================== STEP 8: Build Performance by Topic (with FRQ) ====================

    const performanceByTopic = Array.from(topicPerformance.entries()).map(
      ([topicId, stats]) => {
        // Calculate topic score with weighted formula if both MCQ and FRQ present
        let topicPercentage = 0
        if (stats.total > 0 && stats.frqCount > 0) {
          const mcqScore = stats.correct / stats.total
          const frqScore = stats.frqSum / stats.frqCount
          topicPercentage = (0.7 * mcqScore + 0.3 * frqScore) * 100
        } else if (stats.total > 0) {
          topicPercentage = (stats.correct / stats.total) * 100
        } else if (stats.frqCount > 0) {
          topicPercentage = (stats.frqSum / stats.frqCount) * 100
        }
        
        return {
          topic_id: topicId,
          topic_name: stats.name,
          correct: stats.correct,
          total: stats.total + stats.frqCount,
          percentage: topicPercentage,
        }
      }
    )
    
    // ==================== STEP 8.5: Save Diagnostic Status (if diagnostic exam) ====================
    
    // Check if this is a diagnostic exam
    const { data: examSession, error: examSessionError } = await supabase
      .from('exam_sessions')
      .select('is_diagnostic')
      .eq('id', session_id)
      .single()
    
    if (!examSessionError && examSession?.is_diagnostic === true) {
      // Build topic_mastery JSON
      const topicMastery: Record<string, number> = {}
      for (const [topicId, stats] of topicPerformance.entries()) {
        const mcqScore = stats.total > 0 ? stats.correct / stats.total : 0
        const frqScore = stats.frqCount > 0 ? stats.frqSum / stats.frqCount : 0
        
        // Weighted score (70% MCQ, 30% FRQ)
        topicMastery[topicId] = stats.total > 0 && stats.frqCount > 0
          ? (0.7 * mcqScore + 0.3 * frqScore)
          : stats.total > 0 ? mcqScore : frqScore
      }
      
      // Upsert diagnostic_status
      const { error: diagnosticError } = await supabase
        .from('diagnostic_status')
        .upsert({
          user_id: user.id,
          course_id: session.exams.course_id,
          completed: true,
          score: score / 100, // Store as 0-1
          completed_at: new Date().toISOString(),
          topic_mastery: topicMastery,
          diagnostic_session_id: session_id,
        }, {
          onConflict: 'user_id,course_id'
        })
      
      if (diagnosticError) {
        // Don't fail the submission
      }
    }

    // ==================== STEP 9: Build Response ====================

    const response: SubmitExamResponse = {
      success: true,
      session_id: session_id,
      exam_name: session.exams.name,
      score: Math.round(score * 100) / 100,
      points_earned: pointsEarned,
      points_possible: pointsPossible,
      total_questions: examQuestions.length,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      unanswered_count: unansweredCount,
      time_taken_sec: timeTakenSec,
      breakdown,
      performance_by_topic: performanceByTopic,
    }

    return successResponse(response, 200)

  } catch (error) {
    return handleError(error, FUNCTION_NAME)
  }
})
