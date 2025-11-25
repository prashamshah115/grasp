import { task, logger } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';

interface KnowledgeObjectsPayload {
  courseId: string;
  topicId?: string; // Optional: process single topic
}

type ObjectType = 'concept' | 'formula' | 'example' | 'common_mistake' | 'micro_drill';

interface KnowledgeObject {
  course_id: string;
  topic_id: string;
  object_type: ObjectType;
  title: string;
  summary: string;
  content: Record<string, unknown>;
}

/**
 * TASK: Precompute Knowledge Objects
 * 
 * Generates structured knowledge (concepts, formulas, examples, mistakes, drills)
 * for context panels and RAG enhancement.
 */
export const precomputeKnowledgeObjects = task({
  id: "precompute-knowledge-objects",
  queue: {
    concurrencyLimit: 2
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    randomize: true
  },
  run: async (payload: KnowledgeObjectsPayload) => {
    const { courseId, topicId } = payload;
    logger.info(`[precompute-knowledge-objects] Starting for course ${courseId}`);

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get topics to process
    let topicsQuery = supabase
      .from('topics')
      .select('id, name, slug')
      .eq('course_id', courseId);

    if (topicId) {
      topicsQuery = topicsQuery.eq('id', topicId);
    }

    const { data: topics, error: topicsError } = await topicsQuery.order('order_index');

    if (topicsError || !topics || topics.length === 0) {
      logger.warn(`No topics found for course ${courseId}`);
      return { success: false, reason: 'no_topics' };
    }

    logger.info(`Processing ${topics.length} topics`);

    const allObjects: KnowledgeObject[] = [];

    for (const topic of topics) {
      logger.info(`Processing topic: ${topic.name}`);

      // Get document content for this topic
      const { data: documents } = await supabase
        .from('documents')
        .select('id')
        .eq('course_id', courseId)
        .eq('topic_id', topic.id)
        .eq('status', 'ready');

      const docIds = documents?.map(d => d.id) || [];
      
      let contextText = '';
      if (docIds.length > 0) {
        const { data: pages } = await supabase
          .from('document_pages')
          .select('text_content')
          .in('document_id', docIds)
          .limit(10);

        contextText = pages?.map(p => p.text_content).join('\n\n').slice(0, 6000) || '';
      }

      // Generate knowledge objects for this topic
      const topicObjects = await generateKnowledgeObjects(
        topic.id,
        topic.name,
        courseId,
        contextText
      );

      allObjects.push(...topicObjects);
    }

    // Batch upsert knowledge objects
    if (allObjects.length > 0) {
      // Delete existing objects for these topics
      const topicIds = topics.map(t => t.id);
      await supabase
        .from('knowledge_objects')
        .delete()
        .eq('course_id', courseId)
        .in('topic_id', topicIds);

      // Insert new objects in batches
      const batchSize = 50;
      for (let i = 0; i < allObjects.length; i += batchSize) {
        const batch = allObjects.slice(i, i + batchSize);
        const { error } = await supabase
          .from('knowledge_objects')
          .insert(batch);

        if (error) {
          logger.error('Failed to insert knowledge objects batch:', { error });
        }
      }
    }

    logger.info(`[precompute-knowledge-objects] Completed`, {
      courseId,
      topics: topics.length,
      objects: allObjects.length,
    });

    return {
      success: true,
      courseId,
      stats: {
        topics: topics.length,
        objects: allObjects.length,
        byType: {
          concept: allObjects.filter(o => o.object_type === 'concept').length,
          formula: allObjects.filter(o => o.object_type === 'formula').length,
          example: allObjects.filter(o => o.object_type === 'example').length,
          common_mistake: allObjects.filter(o => o.object_type === 'common_mistake').length,
          micro_drill: allObjects.filter(o => o.object_type === 'micro_drill').length,
        }
      }
    };
  }
});

/**
 * Call Groq API with Llama 3.1 8B
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
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function generateKnowledgeObjects(
  topicId: string,
  topicName: string,
  courseId: string,
  contextText: string
): Promise<KnowledgeObject[]> {
  const objects: KnowledgeObject[] = [];

  try {
    const systemPrompt = `You are creating structured knowledge objects for a study platform. Output ONLY valid JSON.`;

    const userMessage = `For topic "${topicName}", create knowledge objects.

Context from course materials:
${contextText.slice(0, 4000)}

Output ONLY this JSON structure (no markdown):
{
  "concept": {
    "title": "Core concept name",
    "summary": "1-2 sentence explanation",
    "content": {
      "definition": "Full definition",
      "intuition": "Simple explanation",
      "key_points": ["point1", "point2"]
    }
  },
  "formula": {
    "title": "Key formula name",
    "summary": "What it calculates",
    "content": {
      "latex": "formula in latex",
      "plain": "formula in plain text",
      "variables": {"x": "description", "y": "description"},
      "when_to_use": "Use case description"
    }
  },
  "example": {
    "title": "Worked example title",
    "summary": "What it demonstrates",
    "content": {
      "problem": "The problem statement",
      "solution_steps": ["step1", "step2", "step3"],
      "final_answer": "The answer"
    }
  },
  "common_mistake": {
    "title": "Common mistake name",
    "summary": "What students get wrong",
    "content": {
      "mistake": "What the mistake is",
      "why_wrong": "Why it's wrong",
      "correct_approach": "The correct way"
    }
  },
  "micro_drill": {
    "title": "Quick recall question",
    "summary": "Tests understanding",
    "content": {
      "question": "The drill question",
      "answer": "The correct answer",
      "hint": "A helpful hint"
    }
  }
}`;

    const result = await callGroqSLM(systemPrompt, userMessage);
    
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return objects;

    const parsed = JSON.parse(jsonMatch[0]);

    // Convert parsed objects to database format
    const types: ObjectType[] = ['concept', 'formula', 'example', 'common_mistake', 'micro_drill'];
    
    for (const type of types) {
      if (parsed[type]) {
        objects.push({
          course_id: courseId,
          topic_id: topicId,
          object_type: type,
          title: parsed[type].title || `${topicName} ${type}`,
          summary: parsed[type].summary || '',
          content: parsed[type].content || {},
        });
      }
    }
  } catch (error) {
    logger.error(`Failed to generate knowledge objects for ${topicName}:`, { error });
  }

  return objects;
}

