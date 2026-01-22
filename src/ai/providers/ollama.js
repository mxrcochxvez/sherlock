const DEFAULT_OLLAMA_URL = "http://localhost:11434/api/generate";

export class OllamaProvider {
  constructor({ model, apiUrl } = {}) {
    if (!model) {
      throw new Error("Ollama provider requires SHERLOCK_MODEL to be set.");
    }
    this.model = model;
    this.apiUrl = apiUrl || DEFAULT_OLLAMA_URL;
  }

  async generateResponse(systemPrompt, userPrompt) {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Ollama request failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    if (typeof data.response !== "string") {
      throw new Error("Ollama response missing expected 'response' field.");
    }

    return data.response;
  }
}
