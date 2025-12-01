import { task, logger, metadata } from "@trigger.dev/sdk";
import { createClient } from '@supabase/supabase-js';
import { callLLM, type ChatMessage } from "../lib/llm";
import { safeParseJSON } from "../lib/utils";

interface GeneratePersonalizedStudyPackPayload {
  userId: string;
  courseId: string;
}

interface PersonalizedStudyPackResponse {
  course_id: string;
  weak_topics: string[];
  packs: {
    essentials: Array<{
      topic_id: string | null;
      title: string;
      prompt: string;
      short_answer: string | null;
      difficulty: 1 | 2 | 3;
    }>;
    must_solve: Array<{
      topic_id: string | null;
      title: string;
      prompt: string;
      short_answer: string | null;
      difficulty: 1 | 2 | 3;
    }>;
    drills: Array<{
      topic_id: string | null;
      title: string;
      prompt: string;
      short_answer: string | null;
      difficulty: 1 | 2 | 3;
    }>;
  };
}

/**
 * TASK: generate-personalized-study-pack
 * 
 * Simple personalized study pack generation:
 * 1. Get top 3 weakest topics (from user_topic_mastery where score < 0.4)
 * 2. Get user memory (preferred_style, struggling_topic)
 * 3. Generate study pack targeting those 3 topics
 * 4. Store in final_packs with user_id and is_personalized = true
 */
export const generatePersonalizedStudyPack = task({
  id: "generate-personalized-study-pack",
  queue: {
    concurrencyLimit: 3
  },
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 120_000,
    randomize: true
  },
  run: async (payload: GeneratePersonalizedStudyPackPayload) => {
    const { userId, courseId } = payload;
    
    logger.info(`[generate-personalized-study-pack] ▶️  Starting for user ${userId}, course ${courseId}`);
    const startTime = Date.now();

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      // STEP 1: Get top 3 weakest topics
      const { data: weakTopicsData, error: masteryError } = await supabase
        .from('user_topic_mastery')
        .select(`
          topic_id,
          mastery_score,
          topics (
            id,
            name
          )
        `)
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .lt('mastery_score', 0.4)
        .order('mastery_score', { ascending: true })
        .limit(3);

      if (masteryError) {
        throw new Error(`Failed to fetch weak topics: ${masteryError.message}`);
      }

      if (!weakTopicsData || weakTopicsData.length === 0) {
        logger.warn(`[generate-personalized-study-pack] No weak topics found, skipping personalization`);
        return {
          success: true,
          userId,
          courseId,
          message: 'No weak topics found, skipping personalized pack'
        };
      }

      const weakTopics = weakTopicsData
        .map(wt => {
          const topic = wt.topics as any
          const topicName = Array.isArray(topic) 
            ? (topic[0]?.name || 'Unknown Topic')
            : (topic?.name || 'Unknown Topic')
          
          return {
            id: wt.topic_id,
            name: topicName,
            score: wt.mastery_score
          }
        })
        .filter(wt => wt.name !== 'Unknown Topic');

      logger.info(`[generate-personalized-study-pack] Found ${weakTopics.length} weak topics: ${weakTopics.map(t => `${t.name} (${(t.score * 100).toFixed(0)}%)`).join(', ')}`);

      // STEP 2: Get user memory
      const { data: memories } = await supabase
        .from('user_memory')
        .select('memory_key, memory_value')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .in('memory_key', ['preferred_style', 'struggling_topic', 'misconception']);

      const userMemory: Record<string, string> = {};
      if (memories) {
        memories.forEach(m => {
          userMemory[m.memory_key] = m.memory_value;
        });
      }

      // STEP 3: Get course info
      const { data: course } = await supabase
        .from('courses')
        .select('code, name')
        .eq('id', courseId)
        .single();

      if (!course) {
        throw new Error(`Course ${courseId} not found`);
      }

      // STEP 4: Generate study pack using LLM
      const weakTopicsText = weakTopics.map(t => `- ${t.name} (mastery: ${(t.score * 100).toFixed(0)}%)`).join('\n');
      const memoryText = Object.keys(userMemory).length > 0
        ? `\nUSER PREFERENCES:\n${Object.entries(userMemory).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
        : '';

      const prompt = `Generate a personalized study pack for ${course.code}: ${course.name}.

WEAK TOPICS (focus here - these are the user's weakest areas):
${weakTopicsText}${memoryText}

Generate study materials that:
1. Target these weak topics explicitly
2. Provide quick summaries for each weak topic
3. Include 3 must-solve questions per topic (total 9 questions)
4. Include 3 drills per topic (total 9 drills)
5. Match user's learning style if specified

Output ONLY valid JSON (no markdown, no backticks):

{
  "course_id": "${courseId}",
  "weak_topics": [${weakTopics.map(t => `"${t.name}"`).join(', ')}],
  "packs": {
    "essentials": [
      {
        "topic_id": "${weakTopics[0]?.id || null}",
        "title": "Quick summary title",
        "prompt": "What is...",
        "short_answer": "Brief answer",
        "difficulty": 1
      }
    ],
    "must_solve": [
      {
        "topic_id": "${weakTopics[0]?.id || null}",
        "title": "Question title",
        "prompt": "Full question text",
        "short_answer": "Answer",
        "difficulty": 2
      }
    ],
    "drills": [
      {
        "topic_id": "${weakTopics[0]?.id || null}",
        "title": "Drill title",
        "prompt": "Drill prompt",
        "short_answer": "Answer",
        "difficulty": 1
      }
    ]
  }
}`;

      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are an expert study pack generator. Generate concise, focused study materials targeting specific weak topics. Output ONLY valid JSON, no markdown.'
        },
        {
          role: 'user',
          content: prompt
        }
      ];

      logger.info(`[generate-personalized-study-pack] Calling LLM to generate pack...`);
      const rawResponse = await callLLM(messages, {});
      
      let parsed: PersonalizedStudyPackResponse;
      try {
        parsed = safeParseJSON<PersonalizedStudyPackResponse>(rawResponse);
      } catch (parseError) {
        logger.error("Failed to parse LLM response", { error: parseError, rawPreview: rawResponse.slice(0, 500) });
        throw new Error("Failed to parse study pack from LLM response");
      }

      if (!parsed.packs || !parsed.packs.essentials || !parsed.packs.must_solve || !parsed.packs.drills) {
        throw new Error("Invalid LLM response structure");
      }

      logger.info(`[generate-personalized-study-pack] Generated pack with ${parsed.packs.essentials.length} essentials, ${parsed.packs.must_solve.length} must-solve, ${parsed.packs.drills.length} drills`);

      // STEP 5: Store in final_packs table (3 separate records for each tier)
      const tiers = ['essentials', 'must_solve', 'drills'] as const;
      
      for (const tier of tiers) {
        const content = parsed.packs[tier];
        
        // Upsert personalized pack for this tier
        const { error: upsertError } = await supabase
          .from('final_packs')
          .upsert({
            user_id: userId,
            course_id: courseId,
            tier: tier,
            content: { items: content }, // Store as items array
            is_personalized: true,
            generated_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,course_id,tier'
          });

        if (upsertError) {
          logger.error(`[generate-personalized-study-pack] Failed to upsert ${tier} pack:`, { error: upsertError.message, code: upsertError.code });
          throw new Error(`Failed to save ${tier} pack: ${upsertError.message}`);
        }
      }

      const totalTime = Date.now() - startTime;
      logger.info(`[generate-personalized-study-pack] ✅ Personalized study pack generated in ${totalTime}ms`);

      return {
        success: true,
        userId,
        courseId,
        weakTopicsCount: weakTopics.length,
        essentialsCount: parsed.packs.essentials.length,
        mustSolveCount: parsed.packs.must_solve.length,
        drillsCount: parsed.packs.drills.length
      };

    } catch (error) {
      logger.error(`[generate-personalized-study-pack] ❌ Failed:`, error);
      throw error;
    }
  }
});

