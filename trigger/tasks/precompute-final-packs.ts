import { task, logger } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';

interface FinalPackPayload {
  courseId: string;
  forceFresh?: boolean;
}

interface TopicSummary {
  name: string;
  key_concepts: string[];
  formulas: Array<{ name: string; latex: string; plain: string }>;
  summary: string;
}

interface MustSolveQuestion {
  id: string;
  topic: string;
  difficulty: 1 | 2 | 3;
  question: string;
  hint?: string;
  answer?: string;
}

interface Drill {
  id: string;
  topic: string;
  type: 'definition' | 'formula' | 'concept';
  prompt: string;
  answer: string;
}

/**
 * TASK: Precompute Final Packs
 * 
 * Generates study materials for a course:
 * - Essentials: Key formulas, definitions, summaries per topic
 * - Must-Solve: Important practice questions
 * - Drills: Rapid recall exercises
 * 
 * Uses SLM (Groq Llama 3.1 8B) for cost efficiency
 */
export const precomputeFinalPacks = task({
  id: "precompute-final-packs",
  queue: {
    concurrencyLimit: 2 // Limit concurrent LLM calls
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    randomize: true
  },
  run: async (payload: FinalPackPayload) => {
    const { courseId, forceFresh } = payload;
    logger.info(`[precompute-final-packs] Starting for course ${courseId}`);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get course info
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, code, name')
      .eq('id', courseId)
      .single();

    if (courseError || !course) {
      throw new Error(`Course not found: ${courseId}`);
    }

    // Get topics for the course
    const { data: topics, error: topicsError } = await supabase
      .from('topics')
      .select('id, name, slug')
      .eq('course_id', courseId)
      .order('order_index');

    if (topicsError || !topics || topics.length === 0) {
      logger.warn(`No topics found for course ${courseId}`);
      return { success: false, reason: 'no_topics' };
    }

    logger.info(`Found ${topics.length} topics for ${course.code}`);

    // Get document pages for context
    const { data: documents } = await supabase
      .from('documents')
      .select('id, title, topic_id')
      .eq('course_id', courseId)
      .eq('status', 'ready');

    // Generate essentials for each topic using SLM
    const essentialsTopics: TopicSummary[] = [];
    const mustSolveQuestions: MustSolveQuestion[] = [];
    const drills: Drill[] = [];

    for (const topic of topics) {
      logger.info(`Processing topic: ${topic.name}`);

      // Get sample content from document pages for this topic
      const topicDocs = documents?.filter(d => d.topic_id === topic.id) || [];
      const { data: pages } = await supabase
        .from('document_pages')
        .select('text_content')
        .in('document_id', topicDocs.map(d => d.id))
        .limit(5);

      const contextText = pages?.map(p => p.text_content).join('\n\n').slice(0, 4000) || '';

      // Call SLM to generate essentials
      const essentials = await generateTopicEssentials(topic.name, course.name, contextText);
      if (essentials) {
        essentialsTopics.push(essentials);
      }

      // Generate must-solve question for this topic
      const question = await generateMustSolveQuestion(topic.name, course.name, contextText);
      if (question) {
        mustSolveQuestions.push({
          ...question,
          id: crypto.randomUUID(),
          topic: topic.name,
        });
      }

      // Generate drills for this topic
      const topicDrills = await generateDrills(topic.name, contextText);
      drills.push(...topicDrills.map(d => ({
        ...d,
        id: crypto.randomUUID(),
        topic: topic.name,
      })));
    }

    // Store final packs
    const timestamp = new Date().toISOString();

    // Upsert essentials
    await supabase
      .from('final_packs')
      .upsert({
        course_id: courseId,
        tier: 'essentials',
        content: { topics: essentialsTopics },
        generated_at: timestamp,
        updated_at: timestamp,
      }, {
        onConflict: 'course_id,tier',
      });

    // Upsert must-solve
    await supabase
      .from('final_packs')
      .upsert({
        course_id: courseId,
        tier: 'must_solve',
        content: { questions: mustSolveQuestions },
        generated_at: timestamp,
        updated_at: timestamp,
      }, {
        onConflict: 'course_id,tier',
      });

    // Upsert drills
    await supabase
      .from('final_packs')
      .upsert({
        course_id: courseId,
        tier: 'drills',
        content: { drills },
        generated_at: timestamp,
        updated_at: timestamp,
      }, {
        onConflict: 'course_id,tier',
      });

    logger.info(`[precompute-final-packs] Completed for ${course.code}`, {
      essentials: essentialsTopics.length,
      mustSolve: mustSolveQuestions.length,
      drills: drills.length,
    });

    return {
      success: true,
      courseId,
      stats: {
        essentials: essentialsTopics.length,
        mustSolve: mustSolveQuestions.length,
        drills: drills.length,
      }
    };
  }
});

/**
 * Call Groq API with Llama 3.1 8B (SLM for cost efficiency)
 */
async function callGroqSLM(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY not configured');
  }

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
      temperature: 0.3,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateTopicEssentials(
  topicName: string,
  courseName: string,
  contextText: string
): Promise<TopicSummary | null> {
  try {
    const systemPrompt = `You are a study assistant creating concise summaries for finals review. Output ONLY valid JSON, no markdown.`;
    
    const userMessage = `For the topic "${topicName}" in ${courseName}, create a study summary.

Context from course materials:
${contextText.slice(0, 2000)}

Output ONLY this JSON structure (no markdown, no explanation):
{
  "name": "${topicName}",
  "summary": "2-3 sentence overview",
  "key_concepts": ["concept1", "concept2", "concept3"],
  "formulas": [
    {"name": "Formula Name", "latex": "f(x) = ...", "plain": "f(x) = ..."}
  ]
}`;

    const result = await callGroqSLM(systemPrompt, userMessage);
    
    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch (error) {
    logger.error(`Failed to generate essentials for ${topicName}:`, { error });
    return null;
  }
}

async function generateMustSolveQuestion(
  topicName: string,
  courseName: string,
  contextText: string
): Promise<Omit<MustSolveQuestion, 'id' | 'topic'> | null> {
  try {
    const systemPrompt = `You are creating practice questions for finals review. Output ONLY valid JSON.`;
    
    const userMessage = `Create ONE challenging practice question for "${topicName}" in ${courseName}.

Context:
${contextText.slice(0, 1500)}

Output ONLY this JSON (no markdown):
{
  "difficulty": 2,
  "question": "The question text",
  "hint": "A helpful hint",
  "answer": "The solution/answer"
}`;

    const result = await callGroqSLM(systemPrompt, userMessage);
    
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        difficulty: parsed.difficulty || 2,
        question: parsed.question,
        hint: parsed.hint,
        answer: parsed.answer,
      };
    }
    return null;
  } catch (error) {
    logger.error(`Failed to generate question for ${topicName}:`, { error });
    return null;
  }
}

async function generateDrills(
  topicName: string,
  contextText: string
): Promise<Omit<Drill, 'id' | 'topic'>[]> {
  try {
    const systemPrompt = `You create rapid-fire recall drills. Output ONLY valid JSON array.`;
    
    const userMessage = `Create 3 quick recall drills for "${topicName}".

Context:
${contextText.slice(0, 1000)}

Output ONLY this JSON array (no markdown):
[
  {"type": "definition", "prompt": "What is X?", "answer": "X is..."},
  {"type": "formula", "prompt": "Formula for Y?", "answer": "Y = ..."},
  {"type": "concept", "prompt": "How does Z work?", "answer": "Z works by..."}
]`;

    const result = await callGroqSLM(systemPrompt, userMessage);
    
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    logger.error(`Failed to generate drills for ${topicName}:`, { error });
    return [];
  }
}

