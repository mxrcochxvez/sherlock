import { GoogleGenAI } from "@google/genai";

type GoogleProviderOptions = {
  apiKey?: string;
  model?: string;
};

export class GoogleAIProvider {
  private apiKey: string;
  private model: string;
  private client: GoogleGenAI;

  constructor({ apiKey, model }: GoogleProviderOptions = {}) {
    if (!apiKey) {
      throw new Error("Google AI provider requires SHERLOCK_API_KEY to be set.");
    }
    if (!model) {
      throw new Error("Google AI provider requires SHERLOCK_MODEL to be set.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.client = new GoogleGenAI({ apiKey: this.apiKey });
  }

  async generateResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    const prompt = `System:\n${systemPrompt}\n\nUser:\n${userPrompt}`;
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: prompt,
    });
    const text = (response as { text?: string }).text;
    if (typeof text !== "string") {
      throw new Error("Google AI response missing expected text content.");
    }

    return text;
  }
}
