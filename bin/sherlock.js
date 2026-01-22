#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { createAIService } from "../src/ai/index.js";

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

const program = new Command();
program
  .name("sherlock")
  .description("AI-powered developer assistant CLI")
  .version("0.1.0");

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

program.parseAsync(process.argv);
