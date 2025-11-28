// Edge Function: /analyze-graded-assignment
// Purpose: AI-powered analysis of graded assignments (midterms, HW, quizzes)
// Analyzes each question, classifies errors, updates mastery

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleError,
  handleCORS,
  successResponse,
  requireAuth,
  ValidationError,
} from '../_shared/errors.ts'

interface AnalyzeRequest {
  assignment_id: string
}

interface QuestionAnalysis {
  question_id: string
  error_category: 'concept_gap' | 'partial_understanding' | 'careless' | 'calc_error' | 'unknown'
  feedback: string
  topic_id: string | null
}

// Error category descriptions for prompts
const ERROR_CATEGORIES = {
  concept_gap: 'Student lacks fundamental understanding of the concept',
  partial_understanding: 'Student understands partially but misses key aspects',
  careless: 'Student knows the material but made careless mistakes',
  calc_error: 'Calculation or arithmetic error with correct approach',
  unknown: 'Cannot determine error type',
}

serve(async (req) => {
  const FUNCTION_NAME = 'analyze-graded-assignment'

  if (req.method === 'OPTIONS') {
    return handleCORS()
  }

  try {
    console.log(`[${FUNCTION_NAME}] Request received`)

    // Get Supabase client with service role for admin operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Parse request
    let body: AnalyzeRequest
    try {
      body = await req.json()
    } catch {
      throw new ValidationError('Invalid JSON in request body')
    }

    const { assignment_id } = body
    if (!assignment_id) {
      throw new ValidationError('assignment_id is required')
    }

    console.log(`[${FUNCTION_NAME}] Analyzing assignment: ${assignment_id}`)

    // Fetch assignment and questions
    const { data: assignment, error: assignmentError } = await supabase
      .from('graded_assignments')
      .select(`
        *,
        course:courses(id, code, name)
      `)
      .eq('id', assignment_id)
      .single()

    if (assignmentError || !assignment) {
      throw new ValidationError('Assignment not found')
    }

    // Fetch questions for this assignment
    const { data: questions, error: questionsError } = await supabase
      .from('graded_assignment_questions')
      .select('*')
      .eq('assignment_id', assignment_id)
      .order('question_number')

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
    }

    // Fetch topics for the course
    const { data: topics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('course_id', assignment.course_id)

    const topicMap = new Map(topics?.map(t => [t.name.toLowerCase(), t.id]) || [])

    // Analyze each question using SLM
    const analyses: QuestionAnalysis[] = []
    const weakTopicIds = new Set<string>()

    if (questions && questions.length > 0) {
      for (const question of questions) {
        const analysis = await analyzeQuestion(
          question,
          assignment.course?.name || 'Course',
          topics?.map(t => t.name) || []
        )

        // Try to match topic
        let topicId = question.topic_id
        if (!topicId && analysis.detected_topic) {
          // Try to find matching topic by name
          topicId = topicMap.get(analysis.detected_topic.toLowerCase()) || null
        }

        // Track weak topics
        if (topicId && question.points_earned < question.points_total * 0.7) {
          weakTopicIds.add(topicId)
        }

        analyses.push({
          question_id: question.id,
          error_category: analysis.error_category,
          feedback: analysis.feedback,
          topic_id: topicId,
        })

        // Update question with analysis
        await supabase
          .from('graded_assignment_questions')
          .update({
            error_category: analysis.error_category,
            feedback: analysis.feedback,
            topic_id: topicId,
          })
          .eq('id', question.id)
      }
    }

    // Calculate overall score
    const totalEarned = questions?.reduce((sum, q) => sum + (q.points_earned || 0), 0) || 0
    const totalPossible = questions?.reduce((sum, q) => sum + (q.points_total || 0), 0) || 0
    const overallScore = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0

    // Predict final score (simple heuristic)
    const predictedFinalScore = Math.min(100, overallScore * 1.05) // Assume slight improvement

    // Generate summary
    const summary = generateSummary(analyses, overallScore, Array.from(weakTopicIds).length)

    // Store analysis results
    const { error: analysisError } = await supabase
      .from('graded_assignment_analysis')
      .upsert({
        assignment_id,
        overall_score: overallScore,
        predicted_final_score: predictedFinalScore,
        weak_topics: Array.from(weakTopicIds).map(id => ({ topic_id: id })),
        mastery_updates: {},
        summary,
      }, {
        onConflict: 'assignment_id',
      })

    if (analysisError) {
      console.error('Error storing analysis:', analysisError)
    }

    // Update topic mastery for weak topics
    if (weakTopicIds.size > 0 && assignment.user_id) {
      for (const topicId of weakTopicIds) {
        // Upsert mastery - mark as weak if they lost significant points
        await supabase
          .from('topic_mastery')
          .upsert({
            user_id: assignment.user_id,
            topic_id: topicId,
            mastery_level: 'weak',
            last_practiced_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,topic_id',
          })
      }
    }

    console.log(`[${FUNCTION_NAME}] Analysis complete`, {
      assignment_id,
      questionsAnalyzed: analyses.length,
      overallScore,
      weakTopics: weakTopicIds.size,
    })

    return successResponse({
      success: true,
      assignment_id,
      analysis: {
        overall_score: overallScore,
        predicted_final_score: predictedFinalScore,
        questions_analyzed: analyses.length,
        weak_topics: Array.from(weakTopicIds),
        summary,
      }
    })

  } catch (error) {
    console.error(`[${FUNCTION_NAME}] Error:`, error)
    return handleError(error, FUNCTION_NAME)
  }
})

/**
 * Analyze a single question using Groq SLM
 */
async function analyzeQuestion(
  question: any,
  courseName: string,
  availableTopics: string[]
): Promise<{
  error_category: QuestionAnalysis['error_category']
  feedback: string
  detected_topic: string | null
}> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  
  // If no API key, return basic analysis
  if (!apiKey) {
    console.warn('GROQ_API_KEY not set, using basic analysis')
    return {
      error_category: question.points_earned >= question.points_total * 0.7 
        ? 'careless' 
        : 'concept_gap',
      feedback: `You scored ${question.points_earned}/${question.points_total} on this question.`,
      detected_topic: null,
    }
  }

  try {
    const systemPrompt = `You analyze student exam answers to identify error types and provide feedback. Output ONLY valid JSON.

Error categories:
- concept_gap: Student lacks fundamental understanding
- partial_understanding: Student understands partially but misses key aspects  
- careless: Student knows material but made careless mistakes
- calc_error: Calculation error with correct approach
- unknown: Cannot determine error type`

    const userMessage = `Course: ${courseName}
Available topics: ${availableTopics.join(', ')}

Question: ${question.question_text || 'Not provided'}
Student Answer: ${question.student_answer || 'Not provided'}
Correct Answer: ${question.correct_answer || 'Not provided'}
Score: ${question.points_earned}/${question.points_total}

Analyze this and output ONLY JSON:
{
  "error_category": "concept_gap|partial_understanding|careless|calc_error|unknown",
  "feedback": "2-3 sentence specific feedback for the student",
  "detected_topic": "matching topic from the list or null"
}`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: 300,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        error_category: parsed.error_category || 'unknown',
        feedback: parsed.feedback || 'Review this question.',
        detected_topic: parsed.detected_topic || null,
      }
    }
  } catch (error) {
    console.error('Error analyzing question:', error)
  }

  // Fallback
  return {
    error_category: question.points_earned >= question.points_total * 0.7 
      ? 'careless' 
      : 'concept_gap',
    feedback: `You scored ${question.points_earned}/${question.points_total}. Review this topic.`,
    detected_topic: null,
  }
}

function generateSummary(
  analyses: QuestionAnalysis[],
  overallScore: number,
  weakTopicCount: number
): string {
  const errorCounts = analyses.reduce((acc, a) => {
    acc[a.error_category] = (acc[a.error_category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const primaryError = Object.entries(errorCounts)
    .sort((a, b) => b[1] - a[1])[0]

  let summary = `Overall score: ${overallScore.toFixed(1)}%. `
  
  if (primaryError) {
    const errorType = primaryError[0]
    const count = primaryError[1]
    
    if (errorType === 'concept_gap') {
      summary += `${count} question(s) show gaps in understanding. Focus on reviewing core concepts.`
    } else if (errorType === 'partial_understanding') {
      summary += `${count} question(s) show partial understanding. Practice more problems to solidify knowledge.`
    } else if (errorType === 'careless') {
      summary += `${count} question(s) had careless errors. Slow down and double-check your work.`
    } else if (errorType === 'calc_error') {
      summary += `${count} question(s) had calculation errors. Your approach was correct - practice arithmetic.`
    }
  }

  if (weakTopicCount > 0) {
    summary += ` ${weakTopicCount} topic(s) need additional review.`
  }

  return summary
}


