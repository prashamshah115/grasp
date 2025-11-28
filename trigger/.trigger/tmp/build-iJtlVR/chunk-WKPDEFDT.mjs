import {
  logger
} from "./chunk-F2S4DK4N.mjs";
import {
  __name,
  init_esm
} from "./chunk-NH7PIQAW.mjs";

// lib/llm.ts
init_esm();
async function callGroqSLM(messages, opts = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }
  const { temperature = 0.2, maxTokens = 4096, model = "llama-3.1-8b-instant" } = opts;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const err = await response.text();
    logger.error("Groq API error", { status: response.status, error: err });
    throw new Error(`Groq API error: ${err}`);
  }
  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  if (!content || content.trim() === "") {
    logger.error("Groq returned empty response", { model });
    throw new Error("Groq returned empty response");
  }
  return content;
}
__name(callGroqSLM, "callGroqSLM");
async function callOpenAI(messages, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const { temperature = 0.2, maxTokens = 4096, model = "gpt-5-mini" } = opts;
  logger.info(`Calling OpenAI with model: ${model}`);
  const isGpt5Model = model.startsWith("gpt-5");
  const gpt5MaxTokens = Math.max(maxTokens, 16384);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      // GPT-5 models (Mini, Nano, Base) do NOT support temperature, top_p, or logprobs
      // Only GPT-5.1 supports these when reasoning_effort is "none"
      // GPT-5 models use max_completion_tokens, older models use max_tokens
      ...isGpt5Model ? {
        max_completion_tokens: gpt5MaxTokens,
        // Increased to prevent empty responses
        reasoning_effort: "minimal"
        // Reduces reasoning token consumption
      } : { max_tokens: maxTokens, temperature },
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const err = await response.text();
    logger.error("OpenAI API error", { status: response.status, error: err });
    throw new Error(`OpenAI API error: ${err}`);
  }
  const data = await response.json();
  logger.info("OpenAI API response structure", {
    model,
    choicesLength: data.choices?.length,
    hasMessage: !!data.choices[0]?.message,
    messageKeys: data.choices[0]?.message ? Object.keys(data.choices[0].message) : [],
    hasContent: !!data.choices[0]?.message?.content,
    contentType: typeof data.choices[0]?.message?.content,
    contentLength: data.choices[0]?.message?.content?.length,
    contentPreview: data.choices[0]?.message?.content?.slice(0, 200),
    fullResponsePreview: JSON.stringify(data).slice(0, 1e3),
    // First 1000 chars for debugging
    // Check for usage/ratelimit info
    usage: data.usage,
    finishReason: data.choices[0]?.finish_reason
  });
  const content = data.choices[0]?.message?.content;
  if (!content || content.trim() === "") {
    logger.error("OpenAI returned empty response", {
      model,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices[0]?.message,
      fullData: JSON.stringify(data)
    });
    throw new Error("OpenAI returned empty response");
  }
  return content;
}
__name(callOpenAI, "callOpenAI");
async function callLLM(messages, opts = {}) {
  const { intensive = false, ...llmOpts } = opts;
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(messages, llmOpts);
    } catch (error) {
      if (process.env.GROQ_API_KEY) {
        logger.warn("OpenAI failed, falling back to Groq", { error });
        return await callGroqSLM(messages, llmOpts);
      }
      throw error;
    }
  }
  if (process.env.GROQ_API_KEY) {
    return await callGroqSLM(messages, llmOpts);
  }
  throw new Error("No LLM API key configured (OPENAI_API_KEY or GROQ_API_KEY required)");
}
__name(callLLM, "callLLM");

// lib/utils.ts
init_esm();
function safeParseJSON(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (e2) {
      }
    }
    const objectMatch = raw.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch (e3) {
      }
    }
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        return JSON.parse(arrayMatch[0]);
      } catch (e4) {
      }
    }
    logger.error("Failed to parse LLM JSON:", {
      error: e,
      rawPreview: raw.slice(0, 500)
    });
    throw new Error("LLM returned invalid JSON");
  }
}
__name(safeParseJSON, "safeParseJSON");

export {
  callLLM,
  safeParseJSON
};
//# sourceMappingURL=chunk-WKPDEFDT.mjs.map
