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
  return data.choices[0].message.content;
}
__name(callGroqSLM, "callGroqSLM");
async function callOpenAI(messages, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  const { temperature = 0.2, maxTokens = 4096, model = "gpt-5-nano" } = opts;
  const isGpt5Nano = model === "gpt-5-nano";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      // GPT-5 Nano only supports temperature=1 (default), so omit for that model
      ...!isGpt5Nano && { temperature },
      // GPT-5 Nano uses max_completion_tokens, older models use max_tokens
      ...isGpt5Nano ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens },
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    const err = await response.text();
    logger.error("OpenAI API error", { status: response.status, error: err });
    throw new Error(`OpenAI API error: ${err}`);
  }
  const data = await response.json();
  return data.choices[0].message.content;
}
__name(callOpenAI, "callOpenAI");
async function callLLM(messages, opts = {}) {
  const { intensive = false, ...llmOpts } = opts;
  if (intensive && process.env.OPENAI_API_KEY) {
    logger.info("Using GPT-5 Nano for intensive task");
    return await callOpenAI(messages, llmOpts);
  }
  if (process.env.GROQ_API_KEY) {
    try {
      return await callGroqSLM(messages, llmOpts);
    } catch (error) {
      if (process.env.OPENAI_API_KEY) {
        logger.warn("Groq rate limited, falling back to GPT-5 Nano", { error });
        return await callOpenAI(messages, llmOpts);
      }
      throw error;
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return await callOpenAI(messages, llmOpts);
  }
  throw new Error("No LLM API key configured (GROQ_API_KEY or OPENAI_API_KEY required)");
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
//# sourceMappingURL=chunk-UOZ3A5TH.mjs.map
