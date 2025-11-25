/**
 * LLM Router - Smart model routing for cost optimization
 * 
 * Routes tasks to appropriate models based on:
 * - Task type (simple vs complex)
 * - Input token count (large inputs → SLM)
 * - Cost constraints
 */

export type LLMTask = 
  | 'tag'
  | 'summarize'
  | 'extract'
  | 'classify'
  | 'generate_questions'
  | 'analyze_feedback'
  | 'explain'
  | 'reason'
  | 'complex_reasoning';

export type ModelProvider = 'groq' | 'openai' | 'together';

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  costPer1kInput: number;  // USD
  costPer1kOutput: number; // USD
  maxTokens: number;
}

// Model configurations with pricing (as of Nov 2025)
export const MODELS: Record<string, ModelConfig> = {
  // SLM - Fast and cheap
  'groq:llama-3.1-8b-instant': {
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    costPer1kInput: 0.00005,
    costPer1kOutput: 0.00008,
    maxTokens: 128000,
  },
  'groq:llama-3.3-70b-versatile': {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
    maxTokens: 128000,
  },
  // Premium - Higher quality reasoning
  'openai:gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    maxTokens: 128000,
  },
  'openai:gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    maxTokens: 128000,
  },
};

// Simple tasks that can use SLM
const SIMPLE_TASKS: LLMTask[] = ['tag', 'summarize', 'extract', 'classify'];

// Token threshold for routing to SLM (large inputs are better on SLM for cost)
const LARGE_INPUT_THRESHOLD = 4096;

/**
 * Route to the appropriate model based on task and input size
 * 
 * Routing logic:
 * 1. Large inputs (>4096 tokens) → SLM (cheaper for long context)
 * 2. Simple tasks (tag, summarize, extract, classify) → SLM
 * 3. Complex reasoning → Premium model
 */
export function routeToModel(task: LLMTask, inputTokens?: number): string {
  // Large inputs → SLM (better for long context, cheaper)
  if (inputTokens && inputTokens > LARGE_INPUT_THRESHOLD) {
    return 'groq:llama-3.1-8b-instant';
  }
  
  // Simple tasks → SLM
  if (SIMPLE_TASKS.includes(task)) {
    return 'groq:llama-3.1-8b-instant';
  }
  
  // Medium complexity (question generation, feedback analysis)
  if (task === 'generate_questions' || task === 'analyze_feedback') {
    return 'groq:llama-3.3-70b-versatile';
  }
  
  // Complex reasoning → Premium
  return 'openai:gpt-4o-mini';
}

/**
 * Estimate token count from text (rough approximation)
 * ~4 characters per token for English text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Calculate cost estimate for an LLM call
 */
export function estimateCost(
  modelKey: string,
  inputTokens: number,
  outputTokens: number
): number {
  const config = MODELS[modelKey];
  if (!config) return 0;
  
  const inputCost = (inputTokens / 1000) * config.costPer1kInput;
  const outputCost = (outputTokens / 1000) * config.costPer1kOutput;
  
  return inputCost + outputCost;
}

/**
 * Get model configuration by key
 */
export function getModelConfig(modelKey: string): ModelConfig | undefined {
  return MODELS[modelKey];
}

/**
 * Parse model key into provider and model name
 */
export function parseModelKey(modelKey: string): { provider: ModelProvider; model: string } {
  const [provider, model] = modelKey.split(':') as [ModelProvider, string];
  return { provider, model };
}

