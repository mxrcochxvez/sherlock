#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createAIService } from "../ai/index.js";
import {
  clearConfig,
  loadConfig,
  saveConfig,
  CONFIG_PATH,
  type SherlockConfig,
} from "../config.js";

type ExplainOptions = {
  perspective?: string;
  model?: string;
  plain?: boolean;
};

type AuthAnswers = {
  provider: string;
  apiKey?: string;
  model: string;
  apiUrl?: string;
};

type ModelListOptions = {
  provider?: string;
};

const GOOGLE_DEFAULT_MODEL = "gemini-3-flash-preview";
const GOOGLE_MODELS_URL = "https://generativelanguage.googleapis.com/v1/models";
const DEFAULT_OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";

const API_KEY_LINKS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/app/apikey",
  openrouter: "https://openrouter.ai/keys",
  huggingface: "https://huggingface.co/settings/tokens",
  groq: "https://console.groq.com/keys",
  together: "https://api.together.xyz/settings/api-keys",
  mistral: "https://console.mistral.ai/api-keys/",
  perplexity: "https://www.perplexity.ai/settings/api",
};

const OPENAI_COMPATIBLE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  huggingface: "https://router.huggingface.co/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  mistral: "https://api.mistral.ai/v1",
  perplexity: "https://api.perplexity.ai",
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showIntro(): Promise<void> {
  if (!process.stdout.isTTY) {
    return;
  }
  if (process.env.SHERLOCK_NO_INTRO === "1" || process.env.SHERLOOK_NO_INTRO === "1") {
    return;
  }

  const brand = chalk.hex("#f2d18b").bold("SHERLOOK");
  const accent = chalk.hex("#f2d18b");
  const line = chalk.dim("Minimal-lux CLI intelligence");
  const frames = [
    `${brand} ${accent(".")}`,
    `${brand} ${accent("..")}`,
    `${brand} ${accent("...")}`,
  ];

  for (const frame of frames) {
    process.stdout.write(`\r${frame}`);
    await sleep(90);
  }
  process.stdout.write(`\r${brand} ${accent("...")}\n`);
  process.stdout.write(`${line}\n\n`);
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function listDepthOne(cwd: string): Promise<string[]> {
  const entries = await readdir(cwd, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function applyConfigToEnv(config: SherlockConfig): void {
  const entries = Object.entries(config || {});
  for (const [key, value] of entries) {
    if (value == null || value === "") {
      continue;
    }
    if (!process.env[key]) {
      process.env[key] = String(value);
    }
  }
}

async function listFilesRecursive(
  rootDir: string,
  ignoreNames: Set<string>
): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (ignoreNames.has(entry.name)) {
      continue;
    }
    const fullPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFilesRecursive(fullPath, ignoreNames);
      results.push(...nested);
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function stripMarkdown(text: string): string {
  let output = text;
  output = output.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```[a-zA-Z0-9_-]*\n?/, "").replace(/```$/, "")
  );
  output = output.replace(/`([^`]+)`/g, "$1");
  output = output.replace(/!\[.*?\]\(.*?\)/g, "");
  output = output.replace(/\[(.*?)\]\(.*?\)/g, "$1");
  output = output.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  output = output.replace(/^\s*[-*+]\s+/gm, "");
  output = output.replace(/^\s*\d+\.\s+/gm, "");
  output = output.replace(/\*\*(.*?)\*\*/g, "$1");
  output = output.replace(/\*(.*?)\*/g, "$1");
  output = output.replace(/_(.*?)_/g, "$1");
  return output.trim();
}

function buildApiKeyMessage(provider: string): string {
  const link = API_KEY_LINKS[provider];
  return link ? `API key (${link})` : "API key";
}

function buildEnvOverrides(model?: string): NodeJS.ProcessEnv {
  if (!model) {
    return process.env;
  }
  return {
    ...process.env,
    SHERLOCK_MODEL: model,
  };
}

function renderAuthSetupHint(error: unknown): string | null {
  const message = getErrorMessage(error);
  if (message.includes("SHERLOCK_PROVIDER is required")) {
    return [
      "No provider configured yet.",
      "Run `sherlook auth login` to set up a provider and API key.",
      "Example: sherlook auth login",
    ].join("\n");
  }
  if (message.includes("SHERLOCK_API_KEY is required")) {
    return [
      "Missing API key for the configured provider.",
      "Run `sherlook auth login` to save your credentials.",
    ].join("\n");
  }
  if (message.includes("Ollama provider requires SHERLOCK_MODEL")) {
    return [
      "Ollama model not configured yet.",
      "Run `sherlook list --provider ollama` to select a model.",
    ].join("\n");
  }
  return null;
}

function isOllamaModelNotFound(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("ollama request failed") &&
    message.includes("model") &&
    message.includes("not found")
  );
}

async function handleUserSetupError(error: unknown): Promise<boolean> {
  const hint = renderAuthSetupHint(error);
  if (hint) {
    process.stderr.write(`${chalk.yellow("Setup required:")}\n${hint}\n`);
    return true;
  }

  if (process.env.SHERLOCK_PROVIDER !== "ollama") {
    return false;
  }
  if (!isOllamaModelNotFound(error)) {
    return false;
  }

  process.stderr.write(
    `${chalk.yellow("Model not found for Ollama.")}\nSelect a model to continue.\n`
  );
  await listModelsCommand({ provider: "ollama" });
  process.stderr.write("Re-run your command after selecting a model.\n");
  return true;
}

function deriveOllamaTagsUrl(apiUrl?: string): string {
  if (!apiUrl) {
    return DEFAULT_OLLAMA_TAGS_URL;
  }
  try {
    const url = new URL(apiUrl);
    if (url.pathname.endsWith("/api/generate")) {
      url.pathname = url.pathname.replace(/\/api\/generate$/, "/api/tags");
      return url.toString();
    }
    if (!url.pathname.endsWith("/api/tags")) {
      url.pathname = "/api/tags";
    }
    return url.toString();
  } catch {
    return DEFAULT_OLLAMA_TAGS_URL;
  }
}

function deriveOpenAIModelsUrl(provider: string, apiUrl?: string): string {
  const base = apiUrl || OPENAI_COMPATIBLE[provider];
  if (!base) {
    throw new Error(`Provider '${provider}' does not support model listing.`);
  }
  if (base.endsWith("/models")) {
    return base;
  }
  if (base.includes("/chat/completions")) {
    return base.replace(/\/chat\/completions$/, "/models");
  }
  try {
    const url = new URL(base);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/v1/models";
      return url.toString();
    }
    if (!url.pathname.endsWith("/models")) {
      url.pathname = url.pathname.replace(/\/$/, "");
      url.pathname = `${url.pathname}/models`;
    }
    return url.toString();
  } catch {
    return `${base.replace(/\/$/, "")}/models`;
  }
}

async function listGoogleModels(apiKey: string): Promise<string[]> {
  const url = `${GOOGLE_MODELS_URL}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google AI model list failed (${response.status})`);
  }
  const data = (await response.json()) as {
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
  };
  const models = data.models || [];
  return models
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => model.name || "")
    .filter((name) => name.length > 0)
    .map((name) => name.replace(/^models\//, ""))
    .sort((a, b) => a.localeCompare(b));
}

async function listOllamaModels(apiUrl?: string): Promise<string[]> {
  const url = deriveOllamaTagsUrl(apiUrl);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ollama model list failed (${response.status})`);
  }
  const data = (await response.json()) as { models?: Array<{ name?: string }> };
  return (data.models || [])
    .map((model) => model.name || "")
    .filter((name) => name.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

async function listOpenAIModels(
  provider: string,
  apiKey: string,
  apiUrl?: string
): Promise<string[]> {
  const url = deriveOpenAIModelsUrl(provider, apiUrl);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Model list failed (${response.status}): ${errorText}`);
  }
  const data = (await response.json()) as { data?: Array<{ id?: string }> };
  return (data.data || [])
    .map((model) => model.id || "")
    .filter((name) => name.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

async function investigateCommand(options: {
  model?: string;
  plain?: boolean;
}): Promise<void> {
  const spinner = ora("Analyzing project...").start();
  try {
    const cwd = process.cwd();
    const [packageJson, readme, tree] = await Promise.all([
      readTextFile(join(cwd, "package.json")),
      readTextFile(join(cwd, "README.md")),
      listDepthOne(cwd),
    ]);

    const systemPrompt = [
      "You are Sherlook, a senior engineer assistant. Provide a concise, multi-perspective mental model of the project. Cover architecture, entry points, core flows, design system/UI patterns (if any), documented conventions, and common software patterns. Call out known issues or caveats if mentioned, and highlight likely hotspots (e.g., frequently touched or central files inferred from the structure). Keep it short, specific, and actionable.",
      options.plain ? "Respond in plain text without Markdown." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const userPrompt = [
      "Project metadata:",
      "",
      "package.json:",
      packageJson || "(missing)",
      "",
      "README.md:",
      readme || "(missing)",
      "",
      "Top-level structure (depth 1):",
      tree.join("\n") || "(empty)",
      "",
      "Return a short mental model covering stack, entry point, and core purpose.",
    ].join("\n");

    const ai = createAIService(buildEnvOverrides(options.model));
    const response = await ai.generateResponse(systemPrompt, userPrompt);
    spinner.stop();
    const output = options.plain ? stripMarkdown(response) : response;
    process.stdout.write(`${chalk.green("Sherlook:")}\n${output}\n`);
  } catch (error) {
    spinner.stop();
    if (!(await handleUserSetupError(error))) {
      process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    }
    process.exitCode = 1;
  }
}

async function explainCommand(
  filePath: string,
  options: ExplainOptions
): Promise<void> {
  const spinner = ora("Reading file...").start();
  try {
    const cwd = process.cwd();
    const absolutePath = resolve(cwd, filePath);
    const fileContents = await readTextFile(absolutePath);
    if (fileContents === null) {
      spinner.stop();
      process.stderr.write(
        `${chalk.red("Error:")} File not found: ${filePath}\n`
      );
      process.exitCode = 1;
      return;
    }

    const perspective = options.perspective || "general";
    const systemPrompt = [
      "You are Sherlook, a senior engineer assistant. Explain code clearly and succinctly. Include architecture role, design/system considerations, data flow, common patterns, and any risks or caveats you can infer. Keep it focused and actionable.",
      options.plain ? "Respond in plain text without Markdown." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const userPrompt = [
      `Perspective: ${perspective}`,
      `File: ${relative(cwd, absolutePath)}`,
      "",
      fileContents,
    ].join("\n");

    const ai = createAIService(buildEnvOverrides(options.model));
    const response = await ai.generateResponse(systemPrompt, userPrompt);
    spinner.stop();
    const output = options.plain ? stripMarkdown(response) : response;
    process.stdout.write(`${chalk.green("Sherlook:")}\n${output}\n`);
  } catch (error) {
    spinner.stop();
    if (!(await handleUserSetupError(error))) {
      process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    }
    process.exitCode = 1;
  }
}

async function blueprintCommand(
  request: string,
  options: { model?: string; plain?: boolean }
): Promise<void> {
  const spinner = ora("Scanning project...").start();
  try {
    const cwd = process.cwd();
    const ignore = new Set(["node_modules", ".git"]);
    const files = await listFilesRecursive(cwd, ignore);
    const relativePaths = files
      .map((file) => relative(cwd, file))
      .sort((a, b) => a.localeCompare(b));

    const systemPrompt = [
      "You are Sherlook, a senior engineer assistant. Identify relevant files for implementing the request. Consider architecture boundaries, design system/UI implications, shared patterns, and likely hotspots to change. Return a short, actionable list.",
      options.plain ? "Respond in plain text without Markdown." : "",
    ]
      .filter(Boolean)
      .join(" ");
    const userPrompt = [
      "Project file structure (paths only):",
      "",
      relativePaths.join("\n") || "(empty)",
      "",
      `User request: ${request}`,
      "",
      "Which specific files should be modified to implement this? Return a short, actionable list.",
    ].join("\n");

    const ai = createAIService(buildEnvOverrides(options.model));
    const response = await ai.generateResponse(systemPrompt, userPrompt);
    spinner.stop();
    const output = options.plain ? stripMarkdown(response) : response;
    process.stdout.write(`${chalk.green("Sherlook:")}\n${output}\n`);
  } catch (error) {
    spinner.stop();
    if (!(await handleUserSetupError(error))) {
      process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    }
    process.exitCode = 1;
  }
}

async function authLoginCommand(): Promise<void> {
  const spinner = ora("Saving credentials...").start();
  try {
    spinner.stop();
    const providers = [
      "openai",
      "anthropic",
      "google",
      "ollama",
      "openrouter",
      "huggingface",
      "groq",
      "together",
      "mistral",
      "perplexity",
    ];
    process.stdout.write(
      `${chalk.dim(
        "Note: credentials are stored locally and only used to authenticate API requests."
      )}\n`
    );
    const defaultModels: Record<string, string> = {
      openai: "gpt-4o",
      anthropic: "claude-3-5-sonnet-20240620",
      google: GOOGLE_DEFAULT_MODEL,
      ollama: "llama3",
      openrouter: "openai/gpt-4o",
      huggingface: "meta-llama/Meta-Llama-3-8B-Instruct",
      groq: "llama3-70b-8192",
      together: "meta-llama/Llama-3.1-70B-Instruct-Turbo",
      mistral: "mistral-large-latest",
      perplexity: "sonar-pro",
    };

    const providerAnswer = (await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select provider",
        choices: providers,
      },
    ])) as { provider: string };

    const apiKeyAnswer =
      providerAnswer.provider === "ollama"
        ? ({ apiKey: undefined } as { apiKey?: string })
        : ((await inquirer.prompt([
            {
              type: "password",
              name: "apiKey",
              message: buildApiKeyMessage(providerAnswer.provider),
              mask: "*",
              validate: (input: string) =>
                input && input.trim().length > 0 ? true : "API key is required",
            },
          ])) as { apiKey: string });

    let model: string | undefined;
    if (providerAnswer.provider === "google") {
      model = GOOGLE_DEFAULT_MODEL;
      process.stdout.write(
        `${chalk.yellow("Note:")} Google uses ${GOOGLE_DEFAULT_MODEL} by default.\n`
      );
    }

    if (!model) {
      const modelAnswer = (await inquirer.prompt([
        {
          type: "input",
          name: "model",
          message: "Model",
          default: defaultModels[providerAnswer.provider] || "gpt-4o",
          validate: (input: string) =>
            input && input.trim().length > 0 ? true : "Model is required",
        },
      ])) as { model: string };
      model = modelAnswer.model;
    }

    const apiUrlAnswer = (await inquirer.prompt([
      {
        type: "input",
        name: "apiUrl",
        message: "API URL (optional)",
        default:
          providerAnswer.provider === "ollama"
            ? "http://localhost:11434/api/generate"
            : "",
      },
    ])) as { apiUrl?: string };

    const answers: AuthAnswers = {
      provider: providerAnswer.provider,
      apiKey: apiKeyAnswer.apiKey,
      model,
      apiUrl: apiUrlAnswer.apiUrl,
    };

    const config: SherlockConfig = {
      SHERLOCK_PROVIDER: answers.provider,
      SHERLOCK_API_KEY: answers.apiKey,
      SHERLOCK_MODEL: answers.model,
      SHERLOCK_API_URL: answers.apiUrl || undefined,
    };

    spinner.start("Writing config...");
    await saveConfig(config);
    spinner.stop();
    process.stdout.write(`${chalk.green("Saved:")} ${CONFIG_PATH}\n`);
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

async function authLogoutCommand(): Promise<void> {
  const spinner = ora("Removing credentials...").start();
  try {
    await clearConfig();
    spinner.stop();
    process.stdout.write(`${chalk.green("Removed:")} ${CONFIG_PATH}\n`);
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

async function listModelsCommand(options: ModelListOptions): Promise<void> {
  const spinner = ora("Listing models...").start();
  try {
    const config = await loadConfig();
    const provider = options.provider || config.SHERLOCK_PROVIDER;
    if (!provider) {
      throw new Error("No provider configured. Run `sherlook auth login` first.");
    }

    let models: string[] = [];
    if (provider === "ollama") {
      models = await listOllamaModels(config.SHERLOCK_API_URL);
    } else if (provider === "google") {
      spinner.stop();
      process.stdout.write(
        `${chalk.yellow("Note:")} Google uses ${GOOGLE_DEFAULT_MODEL} by default.\n`
      );
      if (config.SHERLOCK_MODEL !== GOOGLE_DEFAULT_MODEL) {
        const nextConfig: SherlockConfig = {
          ...config,
          SHERLOCK_PROVIDER: provider,
          SHERLOCK_MODEL: GOOGLE_DEFAULT_MODEL,
        };
        await saveConfig(nextConfig);
        process.stdout.write(
          `${chalk.green("Saved model:")} ${GOOGLE_DEFAULT_MODEL}\n`
        );
      }
      return;
    } else if (provider === "anthropic") {
      throw new Error(
        "Anthropic model listing is not supported yet. Set SHERLOCK_MODEL manually."
      );
    } else {
      if (!config.SHERLOCK_API_KEY) {
        throw new Error(`SHERLOCK_API_KEY is required for ${provider}.`);
      }
      models = await listOpenAIModels(
        provider,
        config.SHERLOCK_API_KEY,
        config.SHERLOCK_API_URL
      );
    }

    spinner.stop();
    if (models.length === 0) {
      process.stdout.write("No models returned.\n");
      return;
    }

    const selection = (await inquirer.prompt([
      {
        type: "list",
        name: "model",
        message: `Select model for ${provider}`,
        pageSize: 12,
        choices: [...models, { name: "Cancel", value: "__cancel__" }],
      },
    ])) as { model: string };

    if (selection.model === "__cancel__") {
      process.stdout.write("No changes made.\n");
      return;
    }

    const nextConfig: SherlockConfig = {
      ...config,
      SHERLOCK_PROVIDER: provider,
      SHERLOCK_MODEL: selection.model,
    };
    await saveConfig(nextConfig);
    process.stdout.write(`${chalk.green("Saved model:")} ${selection.model}\n`);
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

const program = new Command();
program
  .name("sherlook")
  .description("AI-powered developer assistant CLI")
  .version("0.1.0");

program.hook("preAction", async () => {
  const config = await loadConfig();
  applyConfigToEnv(config);
  await showIntro();
});

program
  .command("investigate")
  .description("Summarize the project with a mental model")
  .option("-m, --model <model>", "Override model for this run")
  .option("--plain", "Return plain text output")
  .action(investigateCommand);

program
  .command("explain")
  .argument("<path>", "File path to explain")
  .option("-p, --perspective <role>", "Explanation perspective", "general")
  .option("-m, --model <model>", "Override model for this run")
  .option("--plain", "Return plain text output")
  .description("Explain a file from a specific perspective")
  .action(explainCommand);

program
  .command("blueprint")
  .argument("<request>", "Feature or change request")
  .option("-m, --model <model>", "Override model for this run")
  .option("--plain", "Return plain text output")
  .description("Suggest which files to modify for a request")
  .action(blueprintCommand);

program
  .command("list")
  .description("List available models and select one")
  .option("-p, --provider <provider>", "Provider to query")
  .action(listModelsCommand);

const auth = program.command("auth").description("Manage credentials");
auth
  .command("login")
  .description("Save provider credentials")
  .action(authLoginCommand);
auth
  .command("logout")
  .description("Remove saved credentials")
  .action(authLogoutCommand);

program.parseAsync(process.argv);
