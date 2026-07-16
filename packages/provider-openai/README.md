# @bonsai/provider-openai

OpenAI-compatible `LLMProvider` adapter for [`@bonsai/core`](../core). Works
against the OpenAI API and any endpoint that speaks the same
`/chat/completions` streaming contract (Azure OpenAI, groq, together.ai, local
`llama.cpp` servers with `--openai-compat`, etc.).

## Install

```bash
npm install @bonsai/provider-openai @bonsai/core
```

## Usage

```ts
import { Bonsai } from '@bonsai/core';
import { OpenAIProvider } from '@bonsai/provider-openai';

const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  baseUrl: process.env.OPENAI_BASE_URL, // optional; defaults to https://api.openai.com/v1
  defaultModel: 'gpt-4o-mini',
});

const bonsai = new Bonsai({ provider, /* storage, wiki, retriever */ });
```

## Environment variables (generic)

Bonsai does not read env vars directly. The **embedding app** is responsible
for reading these and passing them to the constructor. These are the names the
reference app uses; you may map them however you like.

- `OPENAI_API_KEY` — provider key. Required.
- `OPENAI_BASE_URL` — optional override for OpenAI-compatible endpoints.
- `OPENAI_DEFAULT_MODEL` — optional fallback model id.

Secrets are never persisted by this package and never appear on the
`ContextPacket` — inspectable-context output stays free of provider material.

## Provider limit table

`getLimit(model)` returns the token bounds core uses for context assembly and
`max_tokens` in streaming requests. The default table covers common OpenAI
models; unknown ids fall back to a conservative 8k/4k pair. Override or extend
via the `limits` constructor option:

```ts
new OpenAIProvider({
  apiKey,
  limits: {
    'my-fine-tune': { contextTokens: 32_000, maxOutputTokens: 4_096 },
  },
});
```

## Testing

The adapter accepts an injected `fetch` — tests never hit the network:

```ts
new OpenAIProvider({ apiKey: 'sk-test', fetch: myMockFetch });
```

See `src/provider.test.ts` for the reference pattern.
