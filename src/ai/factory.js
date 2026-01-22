import { OllamaProvider } from "./providers/ollama.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";

export function createProvider(env = process.env) {
  const provider = env.SHERLOCK_PROVIDER;
  const model = env.SHERLOCK_MODEL;
  const apiKey = env.SHERLOCK_API_KEY;
  const apiUrl = env.SHERLOCK_API_URL;

  if (!provider) {
    throw new Error("SHERLOCK_PROVIDER is required (openai, ollama, anthropic).");
  }

  switch (provider) {
    case "ollama":
      return new OllamaProvider({ model, apiUrl });
    case "openai":
      if (!apiKey) {
        throw new Error("SHERLOCK_API_KEY is required for OpenAI.");
      }
      return new OpenAIProvider({ apiKey, model, apiUrl });
    case "anthropic":
      if (!apiKey) {
        throw new Error("SHERLOCK_API_KEY is required for Anthropic.");
      }
      return new AnthropicProvider({ apiKey, model, apiUrl });
    default:
      throw new Error(
        `Unknown SHERLOCK_PROVIDER '${provider}'. Use 'openai', 'ollama', or 'anthropic'.`
      );
  }
}
