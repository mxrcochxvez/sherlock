import { AnthropicProvider } from "./providers/anthropic.js";
import { GoogleAIProvider } from "./providers/google.js";
import { OllamaProvider } from "./providers/ollama.js";
import { OpenAIProvider } from "./providers/openai.js";

const OPENAI_COMPATIBLE = {
  openai: "https://api.openai.com/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  huggingface: "https://api-inference.huggingface.co/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  perplexity: "https://api.perplexity.ai/chat/completions",
};

type EnvLike = NodeJS.ProcessEnv;

export function createProvider(env: EnvLike = process.env) {
  const provider = env.SHERLOCK_PROVIDER;
  const model = env.SHERLOCK_MODEL;
  const apiKey = env.SHERLOCK_API_KEY;
  const apiUrl = env.SHERLOCK_API_URL;
  const referer = env.SHERLOCK_REFERER;
  const appName = env.SHERLOCK_APP_NAME;

  if (!provider) {
    throw new Error(
      "SHERLOCK_PROVIDER is required (openai, ollama, anthropic)."
    );
  }

  switch (provider) {
    case "ollama":
      return new OllamaProvider({ model, apiUrl });
    case "anthropic":
      if (!apiKey) {
        throw new Error("SHERLOCK_API_KEY is required for Anthropic.");
      }
      return new AnthropicProvider({ apiKey, model, apiUrl });
    case "google":
    case "googleai":
    case "gemini":
      if (!apiKey) {
        throw new Error("SHERLOCK_API_KEY is required for Google AI.");
      }
      return new GoogleAIProvider({ apiKey, model, apiUrl });
    default: {
      const compatibleUrl =
        OPENAI_COMPATIBLE[provider as keyof typeof OPENAI_COMPATIBLE];
      if (!compatibleUrl) {
        throw new Error(
          `Unknown SHERLOCK_PROVIDER '${provider}'. Use 'openai', 'ollama', 'anthropic', 'google', or an OpenAI-compatible provider.`
        );
      }
      if (!apiKey) {
        throw new Error(`SHERLOCK_API_KEY is required for ${provider}.`);
      }
      const extraHeaders: Record<string, string> = {};
      if (referer) {
        extraHeaders["HTTP-Referer"] = referer;
      }
      if (appName) {
        extraHeaders["X-Title"] = appName;
      }
      return new OpenAIProvider({
        apiKey,
        model,
        apiUrl: apiUrl || compatibleUrl,
        extraHeaders,
      });
    }
  }
}
