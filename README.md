# Sherlock

Sherlock is an AI-powered developer assistant CLI that helps you understand and navigate complex codebases.

## Install

```bash
npm install
```

## Configure

Set environment variables or add a `.env` file:

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

## Usage

```bash
node bin/sherlock.js investigate
node bin/sherlock.js explain src/ai/factory.js -p "Security"
node bin/sherlock.js blueprint "Add a new command for audit logs"
```

## npx

Once published, you can run:

```bash
npx sherlock investigate
```
