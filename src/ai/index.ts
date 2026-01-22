import { createProvider } from "./factory.js";

export class AIService {
  private provider: { generateResponse: (systemPrompt: string, userPrompt: string) => Promise<string> };

  constructor(provider: { generateResponse: (systemPrompt: string, userPrompt: string) => Promise<string> }) {
    this.provider = provider;
  }

  async generateResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    return this.provider.generateResponse(systemPrompt, userPrompt);
  }
}

export function createAIService(env: NodeJS.ProcessEnv = process.env): AIService {
  const provider = createProvider(env);
  return new AIService(provider);
}
