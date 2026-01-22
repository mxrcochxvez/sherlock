const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MAX_TOKENS = 1024;

export class AnthropicProvider {
  constructor({ apiKey, model, apiUrl } = {}) {
    if (!apiKey) {
      throw new Error("Anthropic provider requires SHERLOCK_API_KEY to be set.");
    }
    if (!model) {
      throw new Error("Anthropic provider requires SHERLOCK_MODEL to be set.");
    }

    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = apiUrl || DEFAULT_ANTHROPIC_URL;
  }

  async generateResponse(systemPrompt, userPrompt) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: DEFAULT_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Anthropic request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    const content = data?.content?.[0]?.text;
    if (typeof content !== "string") {
      throw new Error("Anthropic response missing expected content text.");
    }

    return content;
  }
}
