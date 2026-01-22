const DEFAULT_OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAIProvider {
  constructor({ apiKey, model, apiUrl } = {}) {
    if (!apiKey) {
      throw new Error("OpenAI provider requires SHERLOCK_API_KEY to be set.");
    }
    if (!model) {
      throw new Error("OpenAI provider requires SHERLOCK_MODEL to be set.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = apiUrl || DEFAULT_OPENAI_URL;
  }

  async generateResponse(systemPrompt, userPrompt) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
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

    const data = await response.json();
    const message = data?.choices?.[0]?.message?.content;
    if (typeof message !== "string") {
      throw new Error("OpenAI response missing expected message content.");
    }

    return message;
  }
}
