import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getLLMClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY!,
    });
  }
  return client;
}

export function getLLMModel(): string {
  return process.env.LLM_MODEL || 'anthropic/claude-sonnet-4';
}
