/**
 * LLM Provider Abstraction Layer
 * 
 * Model-agnostic interface for calling various LLM providers.
 * Supports: OpenAI, Google Gemini (extensible to Anthropic, DeepSeek, etc.)
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface LLMUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage?: LLMUsage;
  raw: unknown;
  finishReason?: string;
}

export interface LLMProvider {
  name: string;
  generate(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse>;
}

// ============================================
// OPENAI PROVIDER
// ============================================

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  async generate(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxTokens ?? 800,
        top_p: options.topP ?? 0.9,
        frequency_penalty: options.frequencyPenalty ?? 0.2,
        presence_penalty: options.presencePenalty ?? 0.1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      text: choice?.message?.content ?? '',
      model: data.model || options.model,
      usage: data.usage ? {
        input_tokens: data.usage.prompt_tokens,
        output_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined,
      raw: data,
      finishReason: choice?.finish_reason,
    };
  }
}

// ============================================
// GEMINI PROVIDER
// ============================================

export class GeminiProvider implements LLMProvider {
  name = 'gemini';
  
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error('Gemini API key is required');
    }
  }

  async generate(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    // Convert messages to Gemini format
    // Gemini uses 'user' and 'model' roles, and requires alternating turns
    const contents = this.convertMessagesToGeminiFormat(messages);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.4,
            maxOutputTokens: options.maxTokens ?? 800,
            topP: options.topP ?? 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? '';

    return {
      text,
      model: options.model,
      usage: data.usageMetadata ? {
        input_tokens: data.usageMetadata.promptTokenCount ?? 0,
        output_tokens: data.usageMetadata.candidatesTokenCount ?? 0,
        total_tokens: data.usageMetadata.totalTokenCount ?? 0,
      } : undefined,
      raw: data,
      finishReason: candidate?.finishReason,
    };
  }

  private convertMessagesToGeminiFormat(messages: LLMMessage[]): Array<{ role: string; parts: Array<{ text: string }> }> {
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    
    // Gemini doesn't support system messages directly - prepend to first user message
    let systemPrompt = '';
    const nonSystemMessages: LLMMessage[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt += (systemPrompt ? '\n\n' : '') + msg.content;
      } else {
        nonSystemMessages.push(msg);
      }
    }

    for (let i = 0; i < nonSystemMessages.length; i++) {
      const msg = nonSystemMessages[i];
      const role = msg.role === 'assistant' ? 'model' : 'user';
      let content = msg.content;

      // Prepend system prompt to first user message
      if (i === 0 && systemPrompt && role === 'user') {
        content = `${systemPrompt}\n\n---\n\n${content}`;
      }

      // Gemini requires alternating roles - merge consecutive same-role messages
      const lastContent = contents[contents.length - 1];
      if (lastContent && lastContent.role === role) {
        lastContent.parts[0].text += '\n\n' + content;
      } else {
        contents.push({
          role,
          parts: [{ text: content }],
        });
      }
    }

    // Ensure we have at least one user message
    if (contents.length === 0 || contents[0].role !== 'user') {
      contents.unshift({
        role: 'user',
        parts: [{ text: systemPrompt || 'Hello' }],
      });
    }

    return contents;
  }
}

// ============================================
// PROVIDER FACTORY
// ============================================

export type SupportedModel = 
  // OpenAI models (Nov 2025)
  | 'gpt-5-nano'        // Latest: 200x cheaper than GPT-4 Turbo
  | 'gpt-5-mini'
  | 'gpt-5'
  | 'gpt-4-turbo-preview'
  | 'gpt-4-turbo'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4'
  | 'gpt-3.5-turbo'
  // Gemini models
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash'
  | 'gemini-1.0-pro';

const MODEL_TO_PROVIDER: Record<string, 'openai' | 'gemini'> = {
  // OpenAI GPT-5 Series (Nov 2025)
  'gpt-5-nano': 'openai',    // Best value: $0.05/1M input, $0.40/1M output
  'gpt-5-mini': 'openai',
  'gpt-5': 'openai',
  // OpenAI GPT-4 Series (Legacy)
  'gpt-4-turbo-preview': 'openai',
  'gpt-4-turbo': 'openai',
  'gpt-4o': 'openai',
  'gpt-4o-mini': 'openai',
  'gpt-4': 'openai',
  'gpt-3.5-turbo': 'openai',
  // Gemini
  'gemini-1.5-pro': 'gemini',
  'gemini-1.5-flash': 'gemini',
  'gemini-1.0-pro': 'gemini',
};

export function getProviderForModel(model: string): 'openai' | 'gemini' {
  // Check exact match first
  if (MODEL_TO_PROVIDER[model]) {
    return MODEL_TO_PROVIDER[model];
  }
  
  // Check prefix match
  if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('chatgpt-')) {
    return 'openai';
  }
  if (model.startsWith('gemini-')) {
    return 'gemini';
  }
  
  // Default to OpenAI
  return 'openai';
}

export function createProvider(model: string): LLMProvider {
  const providerType = getProviderForModel(model);
  
  switch (providerType) {
    case 'openai': {
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }
      return new OpenAIProvider(apiKey);
    }
    case 'gemini': {
      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
      }
      return new GeminiProvider(apiKey);
    }
    default:
      throw new Error(`Unsupported provider type: ${providerType}`);
  }
}

// ============================================
// HELPER: Call LLM with automatic provider selection
// ============================================

export async function callLLM(
  systemPrompt: string,
  userMessage: string,
  options: Partial<LLMOptions> & { model?: string } = {}
): Promise<LLMResponse> {
  const model = options.model || 'gpt-5-nano';
  const provider = createProvider(model);
  
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];
  
  return provider.generate(messages, {
    model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
  });
}

export async function callLLMWithHistory(
  systemPrompt: string,
  conversationHistory: LLMMessage[],
  userMessage: string,
  options: Partial<LLMOptions> & { model?: string } = {}
): Promise<LLMResponse> {
  const model = options.model || 'gpt-5-nano';
  const provider = createProvider(model);
  
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];
  
  return provider.generate(messages, {
    model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    topP: options.topP,
    frequencyPenalty: options.frequencyPenalty,
    presencePenalty: options.presencePenalty,
  });
}

// ============================================
// DEFAULT MODEL CONSTANTS (Nov 2025)
// ============================================

export const DEFAULT_MODEL = 'gpt-5-nano';  // Best value: $0.05/1M input, $0.40/1M output
export const FALLBACK_MODEL = 'gemini-1.5-flash';

