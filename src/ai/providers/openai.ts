const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/chat/completions";

type OpenAIProviderOptions = {
  apiKey?: string;
  model?: string;
  apiUrl?: string;
  extraHeaders?: Record<string, string>;
};

export class OpenAIProvider {
  private apiKey: string;
  private model: string;
  private apiUrl: string;
  private extraHeaders: Record<string, string>;

  constructor({ apiKey, model, apiUrl, extraHeaders }: OpenAIProviderOptions = {}) {
    if (!apiKey) {
      throw new Error("OpenAI provider requires SHERLOCK_API_KEY to be set.");
    }
    if (!model) {
      throw new Error("OpenAI provider requires SHERLOCK_MODEL to be set.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = apiUrl || DEFAULT_OPENAI_URL;
    this.extraHeaders = extraHeaders || {};
  }

  async generateResponse(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...this.extraHeaders,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenAI request failed (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const message = data?.choices?.[0]?.message?.content;
    if (typeof message !== "string") {
      throw new Error("OpenAI response missing expected message content.");
    }

    return message;
  }
}
