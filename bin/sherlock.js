#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createAIService } from "../src/ai/index.js";
import {
  clearConfig,
  loadConfig,
  saveConfig,
  CONFIG_PATH,
} from "../src/config.js";

async function readTextFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function listDepthOne(cwd) {
  const entries = await readdir(cwd, { withFileTypes: true });
  return entries
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function applyConfigToEnv(config) {
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

async function listFilesRecursive(rootDir, ignoreNames) {
  const results = [];
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

async function investigateCommand() {
  const spinner = ora("Analyzing project...").start();
  try {
    const cwd = process.cwd();
    const [packageJson, readme, tree] = await Promise.all([
      readTextFile(join(cwd, "package.json")),
      readTextFile(join(cwd, "README.md")),
      listDepthOne(cwd),
    ]);

    const systemPrompt =
      "You are Sherlock, a senior engineer assistant. Provide a concise mental model of the project.";
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
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

async function explainCommand(filePath, options) {
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
      "You are Sherlock, a senior engineer assistant. Explain code clearly and succinctly.";
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
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

async function blueprintCommand(request) {
  const spinner = ora("Scanning project...").start();
  try {
    const cwd = process.cwd();
    const ignore = new Set(["node_modules", ".git"]);
    const files = await listFilesRecursive(cwd, ignore);
    const relativePaths = files
      .map((file) => relative(cwd, file))
      .sort((a, b) => a.localeCompare(b));

    const systemPrompt =
      "You are Sherlock, a senior engineer assistant. Identify relevant files for implementing the request.";
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
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

async function authLoginCommand() {
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
    const defaultModels = {
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
    const answers = await inquirer.prompt([
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
        when: (a) => a.provider !== "ollama",
        validate: (input) =>
          input && input.trim().length > 0 ? true : "API key is required",
      },
      {
        type: "input",
        name: "model",
        message: "Model",
        default: (a) =>
          defaultModels[a.provider] || "gpt-4o",
        validate: (input) =>
          input && input.trim().length > 0 ? true : "Model is required",
      },
      {
        type: "input",
        name: "apiUrl",
        message: "API URL (optional)",
        default: (a) =>
          a.provider === "ollama"
            ? "http://localhost:11434/api/generate"
            : "",
      },
    ]);

    const config = {
      SHERLOCK_PROVIDER: answers.provider,
      SHERLOCK_API_KEY: answers.apiKey,
      SHERLOCK_MODEL: answers.model,
      SHERLOCK_API_URL: answers.apiUrl || undefined,
    };

    spinner.start("Writing config...");
    await saveConfig(config);
    spinner.stop();
    process.stdout.write(
      `${chalk.green("Saved:")} ${CONFIG_PATH}\n`
    );
  } catch (error) {
    spinner.stop();
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
    process.exitCode = 1;
  }
}

async function authLogoutCommand() {
  const spinner = ora("Removing credentials...").start();
  try {
    await clearConfig();
    spinner.stop();
    process.stdout.write(`${chalk.green("Removed:")} ${CONFIG_PATH}\n`);
  } catch (error) {
    spinner.stop();
    const message = error && error.message ? error.message : String(error);
    process.stderr.write(`${chalk.red("Error:")} ${message}\n`);
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
