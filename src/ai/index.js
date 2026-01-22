import { createProvider } from "./factory.js";

export class AIService {
  constructor(provider) {
    this.provider = provider;
  }

  async generateResponse(systemPrompt, userPrompt) {
    return this.provider.generateResponse(systemPrompt, userPrompt);
  }
}

export function createAIService(env = process.env) {
  const provider = createProvider(env);
  return new AIService(provider);
}
