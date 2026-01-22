# Sherlook

Sherlook is an AI-powered developer assistant CLI that helps you understand and navigate complex codebases.

Built with TypeScript, Commander.js, and a model-agnostic AI layer.

## Quick start (npx)

```bash
npx sherlook investigate
```

## Commands

Investigate a repo and get a concise multi‑perspective mental model:

```bash
npx sherlook investigate
```

Explain a file from a chosen perspective:

```bash
npx sherlook explain src/ai/factory.ts -p "Security"
```

Blueprint which files to change for a feature request:

```bash
npx sherlook blueprint "Add a new command for audit logs"
```

Pick a model for the configured provider:

```bash
npx sherlook list
```

## Options

Return plain text (no Markdown) for any command:

```bash
npx sherlook investigate --plain
```

Override the model for a single run:

```bash
npx sherlook investigate -m gemini-3-flash-preview
```

## Local development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run the compiled CLI:

```bash
node dist/bin/sherlook.js investigate
```
