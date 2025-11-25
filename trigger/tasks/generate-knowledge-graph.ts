import { task, logger } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';

interface KnowledgeGraphPayload {
  courseId: string;
  forceFresh?: boolean;
}

interface TopicRelation {
  topic_a: string;
  topic_b: string;
  relation: 'prerequisite' | 'overlap' | 'dependent';
  confidence: number;
}

/**
 * TASK: Generate Knowledge Graph
 * 
 * Auto-generates prerequisite/dependency relationships between topics.
 * Uses SLM to classify relationships between topic pairs.
 */
export const generateKnowledgeGraph = task({
  id: "generate-knowledge-graph",
  queue: {
    concurrencyLimit: 1 // One course at a time
  },
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 10000,
    maxTimeoutInMs: 120000,
    randomize: true
  },
  run: async (payload: KnowledgeGraphPayload) => {
    const { courseId, forceFresh } = payload;
    logger.info(`[generate-knowledge-graph] Starting for course ${courseId}`);

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
      .select('id, name, slug, order_index')
      .eq('course_id', courseId)
      .order('order_index');

    if (topicsError || !topics || topics.length < 2) {
      logger.warn(`Not enough topics for graph generation in course ${courseId}`);
      return { success: false, reason: 'insufficient_topics' };
    }

    logger.info(`Found ${topics.length} topics for ${course.code}`);

    // Clear existing edges if forcing fresh
    if (forceFresh) {
      await supabase
        .from('course_graph_edges')
        .delete()
        .eq('course_id', courseId);
    }

    // Generate pairs - only compare each pair once
    const pairs: Array<{ topicA: typeof topics[0]; topicB: typeof topics[0] }> = [];
    for (let i = 0; i < topics.length; i++) {
      for (let j = i + 1; j < topics.length; j++) {
        pairs.push({ topicA: topics[i], topicB: topics[j] });
      }
    }

    logger.info(`Analyzing ${pairs.length} topic pairs`);

    // Batch pairs for efficiency (5 pairs per LLM call)
    const batchSize = 5;
    const relations: TopicRelation[] = [];

    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize);
      const batchRelations = await analyzePairsBatch(
        batch,
        course.name,
        topics.map(t => t.name)
      );
      relations.push(...batchRelations);
      
      logger.info(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pairs.length / batchSize)}`);
    }

    // Filter out unrelated pairs
    const meaningfulRelations = relations.filter(r => r.relation !== 'unrelated' as any);

    // Insert edges
    if (meaningfulRelations.length > 0) {
      const edgeRecords = meaningfulRelations.map(r => ({
        course_id: courseId,
        topic_a: r.topic_a,
        topic_b: r.topic_b,
        relation: r.relation,
        confidence: r.confidence,
        weight: r.confidence,
      }));

      // Upsert to handle duplicates
      for (const edge of edgeRecords) {
        await supabase
          .from('course_graph_edges')
          .upsert(edge, {
            onConflict: 'course_id,topic_a,topic_b',
          });
      }
    }

    logger.info(`[generate-knowledge-graph] Completed for ${course.code}`, {
      totalPairs: pairs.length,
      meaningfulRelations: meaningfulRelations.length,
      prerequisites: meaningfulRelations.filter(r => r.relation === 'prerequisite').length,
      overlaps: meaningfulRelations.filter(r => r.relation === 'overlap').length,
      dependents: meaningfulRelations.filter(r => r.relation === 'dependent').length,
    });

    return {
      success: true,
      courseId,
      stats: {
        totalPairs: pairs.length,
        edges: meaningfulRelations.length,
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
      temperature: 0.2,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function analyzePairsBatch(
  pairs: Array<{ topicA: { id: string; name: string }; topicB: { id: string; name: string } }>,
  courseName: string,
  allTopics: string[]
): Promise<TopicRelation[]> {
  try {
    const systemPrompt = `You analyze relationships between course topics. Output ONLY valid JSON array.

Relationship types:
- "prerequisite": Topic A must be learned before Topic B
- "overlap": Topics share common concepts
- "dependent": Topic B extends/builds upon Topic A
- "unrelated": No meaningful relationship`;

    const pairsList = pairs.map((p, i) => 
      `${i + 1}. "${p.topicA.name}" vs "${p.topicB.name}"`
    ).join('\n');

    const userMessage = `Course: ${courseName}
All topics: ${allTopics.join(', ')}

Analyze these topic pairs:
${pairsList}

Output ONLY a JSON array with one object per pair (no markdown):
[
  {
    "pair": 1,
    "relation": "prerequisite|overlap|dependent|unrelated",
    "confidence": 0.0-1.0,
    "direction": "A->B" or "B->A" (for prerequisite/dependent)
  }
]`;

    const result = await callGroqSLM(systemPrompt, userMessage);
    
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    
    return parsed.map((item: any, index: number) => {
      const pair = pairs[index] || pairs[item.pair - 1];
      if (!pair) return null;

      // Determine direction for prerequisite/dependent
      let topicA = pair.topicA.id;
      let topicB = pair.topicB.id;
      
      if (item.direction === 'B->A') {
        [topicA, topicB] = [topicB, topicA];
      }

      return {
        topic_a: topicA,
        topic_b: topicB,
        relation: item.relation as TopicRelation['relation'],
        confidence: Math.min(1, Math.max(0, item.confidence || 0.7)),
      };
    }).filter(Boolean) as TopicRelation[];
  } catch (error) {
    logger.error('Failed to analyze pairs batch:', { error });
    return [];
  }
}

