/**
 * FRQ Grading Module
 * 
 * Grades free response questions using LLM with rubric-based evaluation.
 * Returns normalized scores (0-1) with feedback and confidence metrics.
 * 
 * NOTE: This module is designed for use in Supabase Edge Functions (Deno runtime).
 * For frontend use, call via the submit-exam edge function.
 */

export interface FRQGradingResult {
  score: number // 0-1 normalized
  feedback: string
  confidence: number // 0-1, grader confidence level
}

export interface FRQQuestion {
  prompt: string
  frq_ideal_answer?: string | null
  frq_rubric_md?: string | null
}

/**
 * Grade a free response answer using LLM with rubric
 * 
 * @param question - Question with ideal answer and rubric
 * @param userAnswer - Student's submitted answer
 * @returns Grading result with score, feedback, and confidence
 */
export async function gradeFRQ(
  question: FRQQuestion,
  userAnswer: string
): Promise<FRQGradingResult> {
  // Get OpenAI API key from environment
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  // Build grading prompt
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
- 1.0: Complete, accurate answer that demonstrates full understanding
- 0.7-0.9: Good answer with minor gaps or inaccuracies
- 0.5-0.7: Partial answer, shows some understanding but missing key points
- 0.3-0.5: Minimal understanding, significant gaps
- 0.0-0.3: Incorrect or missing answer

Be strict but fair. Partial credit for partial understanding.`

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
          { 
            role: 'system', 
            content: 'You are a strict but fair exam grader. Always return valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3, // Low temperature for consistent grading
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[gradeFRQ] OpenAI API error:', response.status, errorText)
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const result = JSON.parse(data.choices[0].message.content || '{}')

    // Validate and normalize result
    return {
      score: Math.max(0, Math.min(1, result.score || 0)),
      feedback: result.feedback || 'No feedback provided',
      confidence: Math.max(0, Math.min(1, result.confidence || 0.7)),
    }
  } catch (error) {
    console.error('[gradeFRQ] Grading failed:', error)
    
    // Return fallback result with low confidence
    return {
      score: 0,
      feedback: 'Grading failed - answer requires manual review',
      confidence: 0,
    }
  }
}

/**
 * Grade multiple FRQ questions in batch
 * 
 * @param questions - Array of questions with user answers
 * @returns Array of grading results
 */
export async function gradeFRQBatch(
  questions: Array<{ question: FRQQuestion; userAnswer: string }>
): Promise<FRQGradingResult[]> {
  // Grade sequentially to avoid rate limits
  // Could be parallelized with proper rate limiting
  const results: FRQGradingResult[] = []
  
  for (const { question, userAnswer } of questions) {
    const result = await gradeFRQ(question, userAnswer)
    results.push(result)
  }
  
  return results
}

