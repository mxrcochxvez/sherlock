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
};

type AuthAnswers = {
  provider: string;
  apiKey?: string;
  model: string;
  apiUrl?: string;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
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

async function investigateCommand(): Promise<void> {
  const spinner = ora("Analyzing project...").start();
  try {
    const cwd = process.cwd();
    const [packageJson, readme, tree] = await Promise.all([
      readTextFile(join(cwd, "package.json")),
      readTextFile(join(cwd, "README.md")),
      listDepthOne(cwd),
    ]);

    const systemPrompt =
      "You are Sherlock, a senior engineer assistant. Provide a concise, multi-perspective mental model of the project. Cover architecture, entry points, core flows, design system/UI patterns (if any), documented conventions, and common software patterns. Call out known issues or caveats if mentioned, and highlight likely hotspots (e.g., frequently touched or central files inferred from the structure). Keep it short, specific, and actionable.";
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

    const ai = createAIService();
    const response = await ai.generateResponse(systemPrompt, userPrompt);
    spinner.stop();
    process.stdout.write(`${chalk.green("Sherlock:")}\n${response}\n`);
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
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
    const systemPrompt =
      "You are Sherlock, a senior engineer assistant. Explain code clearly and succinctly. Include architecture role, design/system considerations, data flow, common patterns, and any risks or caveats you can infer. Keep it focused and actionable.";
    const userPrompt = [
      `Perspective: ${perspective}`,
      `File: ${relative(cwd, absolutePath)}`,
      "",
      fileContents,
    ].join("\n");

    const ai = createAIService();
    const response = await ai.generateResponse(systemPrompt, userPrompt);
    spinner.stop();
    process.stdout.write(`${chalk.green("Sherlock:")}\n${response}\n`);
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
    process.exitCode = 1;
  }
}

async function blueprintCommand(request: string): Promise<void> {
  const spinner = ora("Scanning project...").start();
  try {
    const cwd = process.cwd();
    const ignore = new Set(["node_modules", ".git"]);
    const files = await listFilesRecursive(cwd, ignore);
    const relativePaths = files
      .map((file) => relative(cwd, file))
      .sort((a, b) => a.localeCompare(b));

    const systemPrompt =
      "You are Sherlock, a senior engineer assistant. Identify relevant files for implementing the request. Consider architecture boundaries, design system/UI implications, shared patterns, and likely hotspots to change. Return a short, actionable list.";
    const userPrompt = [
      "Project file structure (paths only):",
      "",
      relativePaths.join("\n") || "(empty)",
      "",
      `User request: ${request}`,
      "",
      "Which specific files should be modified to implement this? Return a short, actionable list.",
    ].join("\n");

    const ai = createAIService();
    const response = await ai.generateResponse(systemPrompt, userPrompt);
    spinner.stop();
    process.stdout.write(`${chalk.green("Sherlock:")}\n${response}\n`);
  } catch (error) {
    spinner.stop();
    process.stderr.write(`${chalk.red("Error:")} ${getErrorMessage(error)}\n`);
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
    const defaultModels: Record<string, string> = {
      openai: "gpt-4o",
      anthropic: "claude-3-5-sonnet-20240620",
      google: "gemini-1.5-pro",
      ollama: "llama3",
      openrouter: "openai/gpt-4o",
      huggingface: "meta-llama/Meta-Llama-3-8B-Instruct",
      groq: "llama3-70b-8192",
      together: "meta-llama/Llama-3.1-70B-Instruct-Turbo",
      mistral: "mistral-large-latest",
      perplexity: "sonar-pro",
    };
    const answers = (await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "Select provider",
        choices: providers,
      },
      {
        type: "password",
        name: "apiKey",
        message: "API key",
        mask: "*",
        when: (a: AuthAnswers) => a.provider !== "ollama",
        validate: (input: string) =>
          input && input.trim().length > 0 ? true : "API key is required",
      },
      {
        type: "input",
        name: "model",
        message: "Model",
        default: (a: AuthAnswers) => defaultModels[a.provider] || "gpt-4o",
        validate: (input: string) =>
          input && input.trim().length > 0 ? true : "Model is required",
      },
      {
        type: "input",
        name: "apiUrl",
        message: "API URL (optional)",
        default: (a: AuthAnswers) =>
          a.provider === "ollama"
            ? "http://localhost:11434/api/generate"
            : "",
      },
    ])) as AuthAnswers;

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

const program = new Command();
program
  .name("sherlock")
  .description("AI-powered developer assistant CLI")
  .version("0.1.0");

program.hook("preAction", async () => {
  const config = await loadConfig();
  applyConfigToEnv(config);
});

program
  .command("investigate")
  .description("Summarize the project with a mental model")
  .action(investigateCommand);

program
  .command("explain")
  .argument("<path>", "File path to explain")
  .option("-p, --perspective <role>", "Explanation perspective", "general")
  .description("Explain a file from a specific perspective")
  .action(explainCommand);

program
  .command("blueprint")
  .argument("<request>", "Feature or change request")
  .description("Suggest which files to modify for a request")
  .action(blueprintCommand);

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
