// trigger/lib/llm.ts
// LLM helper for Trigger.dev tasks - supports OpenAI and Groq
//
// MODEL STRATEGY (Nov 2025):
// - GPT-5 Mini: Primary model - reliable JSON mode, good quality
// - Groq Llama 3.1 8B: Fallback - fast & free but rate limited

import { logger } from "@trigger.dev/sdk";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** Use GPT-5 Mini for intensive/quality-critical tasks */
  intensive?: boolean;
}

/**
 * Call Groq API with Llama 3.1 8B (SLM for cost efficiency)
 * Used as fallback when OpenAI is unavailable
 */
export async function callGroqSLM(
  messages: ChatMessage[],
  opts: LLMOptions = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const { temperature = 0.2, maxTokens = 4096, model = "llama-3.1-8b-instant" } = opts;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error("Groq API error", { status: response.status, error: err });
    throw new Error(`Groq API error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  
  if (!content || content.trim() === "") {
    logger.error("Groq returned empty response", { model });
    throw new Error("Groq returned empty response");
  }
  
  return content;
}

/**
 * Call OpenAI API with GPT-5 Mini (default)
 * GPT-5 Mini: Reliable JSON mode, good balance of cost/quality
 */
export async function callOpenAI(
  messages: ChatMessage[],
  opts: LLMOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  // Default to GPT-5 Mini - reliable JSON mode support
  const { temperature = 0.2, maxTokens = 4096, model = "gpt-5-mini" } = opts;

  logger.info(`Calling OpenAI with model: ${model}`);

  // GPT-5 models (Mini, Nano) require max_completion_tokens instead of max_tokens
  const isGpt5Model = model.startsWith("gpt-5");
  
  // For GPT-5 models, use higher token limit to avoid empty responses from reasoning token consumption
  // Reasoning can consume many tokens, so we need headroom for the actual response
  const gpt5MaxTokens = Math.max(maxTokens, 16384); // Minimum 16k for GPT-5 models

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      // GPT-5 models (Mini, Nano, Base) do NOT support temperature, top_p, or logprobs
      // Only GPT-5.1 supports these when reasoning_effort is "none"
      // GPT-5 models use max_completion_tokens, older models use max_tokens
      ...(isGpt5Model 
        ? { 
            max_completion_tokens: gpt5MaxTokens, // Increased to prevent empty responses
            reasoning_effort: "minimal", // Reduces reasoning token consumption
          } 
        : { max_tokens: maxTokens, temperature }),
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    logger.error("OpenAI API error", { status: response.status, error: err });
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  
  // Log full response structure for debugging GPT-5 empty response issues
  logger.info("OpenAI API response structure", {
    model,
    choicesLength: data.choices?.length,
    hasMessage: !!data.choices[0]?.message,
    messageKeys: data.choices[0]?.message ? Object.keys(data.choices[0].message) : [],
    hasContent: !!data.choices[0]?.message?.content,
    contentType: typeof data.choices[0]?.message?.content,
    contentLength: data.choices[0]?.message?.content?.length,
    contentPreview: data.choices[0]?.message?.content?.slice(0, 200),
    fullResponsePreview: JSON.stringify(data).slice(0, 1000), // First 1000 chars for debugging
    // Check for usage/ratelimit info
    usage: (data as any).usage,
    finishReason: data.choices[0]?.finish_reason,
  });
  
  const content = data.choices[0]?.message?.content;
  
  if (!content || content.trim() === "") {
    logger.error("OpenAI returned empty response", { 
      model,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices[0]?.message,
      fullData: JSON.stringify(data),
    });
    throw new Error("OpenAI returned empty response");
  }
  
  return content;
}

/**
 * Primary LLM call function
 * 
 * MODEL STRATEGY (Nov 2025):
 * - GPT-5 Mini: Primary - reliable JSON mode, good quality
 * - Groq Llama 3.1 8B: Fallback - fast & free but rate limited
 */
export async function callLLM(
  messages: ChatMessage[],
  opts: LLMOptions = {}
): Promise<string> {
  const { intensive = false, ...llmOpts } = opts;
  
  // PRIMARY: Use GPT-5 Mini for reliable JSON output
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(messages, llmOpts);
    } catch (error) {
      // If OpenAI fails, try Groq as fallback
      if (process.env.GROQ_API_KEY) {
        logger.warn("OpenAI failed, falling back to Groq", { error });
        return await callGroqSLM(messages, llmOpts);
      }
      throw error;
    }
  }
  
  // FALLBACK: Use Groq if no OpenAI key
  if (process.env.GROQ_API_KEY) {
    return await callGroqSLM(messages, llmOpts);
  }
  
  throw new Error("No LLM API key configured (OPENAI_API_KEY or GROQ_API_KEY required)");
}
