# Sherlock

Sherlock is an AI-powered developer assistant CLI that helps you understand and navigate complex codebases.

Built with TypeScript, Commander.js, and a model-agnostic AI layer.

## Install

```bash
npm install
```

## Build

```bash
npm run build
```

Run the compiled CLI:

```bash
node dist/bin/sherlock.js investigate
```

## Configure

Use the built-in auth flow to store a single active provider locally:

```bash
node dist/bin/sherlock.js auth login
node dist/bin/sherlock.js auth logout
```

You can still use environment variables if needed:

```bash
SHERLOCK_PROVIDER=ollama
SHERLOCK_MODEL=llama3
SHERLOCK_API_URL=http://localhost:11434/api/generate
```

OpenAI example:

```bash
SHERLOCK_PROVIDER=openai
SHERLOCK_MODEL=gpt-4o
SHERLOCK_API_KEY=your_api_key_here
```

Anthropic example:

```bash
SHERLOCK_PROVIDER=anthropic
SHERLOCK_MODEL=claude-3-5-sonnet-20240620
SHERLOCK_API_KEY=your_api_key_here
```

Google AI (Gemini) example:

```bash
SHERLOCK_PROVIDER=google
SHERLOCK_MODEL=gemini-1.5-pro
SHERLOCK_API_KEY=your_api_key_here
```

OpenAI-compatible examples:

```bash
SHERLOCK_PROVIDER=openrouter
SHERLOCK_MODEL=openai/gpt-4o
SHERLOCK_API_KEY=your_api_key_here
```

```bash
SHERLOCK_PROVIDER=groq
SHERLOCK_MODEL=llama3-70b-8192
SHERLOCK_API_KEY=your_api_key_here
```

Hugging Face (router) example:

```bash
SHERLOCK_PROVIDER=huggingface
SHERLOCK_MODEL=meta-llama/Meta-Llama-3-8B-Instruct
SHERLOCK_API_KEY=your_api_key_here
```

Optional headers for OpenAI-compatible providers:

```bash
SHERLOCK_REFERER=https://your-app.com
SHERLOCK_APP_NAME=Sherlock
```

## Usage

```bash
node dist/bin/sherlock.js investigate
node dist/bin/sherlock.js explain src/ai/factory.ts -p "Security"
node dist/bin/sherlock.js blueprint "Add a new command for audit logs"
```

## npx

Once published, you can run:

```bash
npx sherlock investigate
```

## Demo site (GitHub Pages)

The demo lives in `docs/`. To publish:

1. Push `docs/` to `main`.
2. In GitHub repo settings, enable Pages and choose `main` + `/docs`.
