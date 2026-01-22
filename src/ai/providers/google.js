const DEFAULT_GOOGLE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

export class GoogleAIProvider {
  constructor({ apiKey, model, apiUrl } = {}) {
    if (!apiKey) {
      throw new Error("Google AI provider requires SHERLOCK_API_KEY to be set.");
    }
    if (!model) {
      throw new Error("Google AI provider requires SHERLOCK_MODEL to be set.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = apiUrl || DEFAULT_GOOGLE_URL;
  }

  async generateResponse(systemPrompt, userPrompt) {
    const url = `${this.apiUrl}/${encodeURIComponent(
      this.model
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: `System:\n${systemPrompt}` },
              { text: `\nUser:\n${userPrompt}` },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Google AI request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") {
      throw new Error("Google AI response missing expected text content.");
    }

    return text;
  }
}
