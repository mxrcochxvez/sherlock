# Sherlock

Sherlock is an AI-powered developer assistant CLI that helps you understand and navigate complex codebases.

## Auth

Store a single active provider locally for npx usage:

```bash
node bin/sherlock.js auth login
node bin/sherlock.js auth logout
```

## Usage

```bash
node bin/sherlock.js investigate
node bin/sherlock.js explain src/ai/factory.js -p "Security"
node bin/sherlock.js blueprint "Add a new command for audit logs"
```

## npx

> 🚧 Once published 🚧

```bash
npx sherlock investigate
```

## Local Configuration (testing)

### Install

```bash
npm install
```

### Set environment variables or add a `.env` file:

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

Optional headers for OpenAI-compatible providers:

```bash
SHERLOCK_REFERER=https://your-app.com
SHERLOCK_APP_NAME=Sherlock
```