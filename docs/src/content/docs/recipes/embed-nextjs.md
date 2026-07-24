---
title: Embed in Next.js
description: Wire @bonsai/core into a Next.js App Router app with a streaming chat route and a ContextPacket inspector.
---

**Concepts you should know:** [Tree Model](/concepts/tree-model/) · [ContextPacket](/concepts/context-packet/) · [Merge](/concepts/merge/).

`@bonsai/*` has no UI and no framework binding — you own the routes. `@bonsai/server` gives you typed request parsers and handlers you can call from any framework's route handler, including Next.js App Router, without pulling in its Node-`http`-specific `createRequestListener`.

## 1. Build your Bonsai instance once

```ts title="lib/bonsai.ts"
import { Bonsai } from '@bonsai/core';
import { createPostgresStorage, PostgresFtsRetriever } from '@bonsai/storage-postgres';
import { OpenAIProvider } from '@bonsai/provider-openai';
import { FsWikiStore } from '@bonsai/wiki-fs';
import { Pool } from 'pg';
import type { HandlerDeps } from '@bonsai/server';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const storage = createPostgresStorage({ pool });

const bonsai = new Bonsai({
  storage,
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! }),
  wiki: new FsWikiStore({ root: process.env.BONSAI_WIKI_ROOT! }),
});

// Retrieval is per-project; build a HandlerDeps scoped to one project id.
export function getBonsaiDeps(projectId: string): HandlerDeps {
  return { bonsai, retriever: new PostgresFtsRetriever({ pool, projectId }) };
}
```

Reuse this module across routes — do not construct a new `Pool` per request.

## 2. A streaming chat route

```ts title="app/api/chat/route.ts"
import { handleChat, parseChat } from '@bonsai/server';
import { getBonsaiDeps } from '@/lib/bonsai';

export async function POST(req: Request) {
  const body = await req.json();
  const deps = getBonsaiDeps(body.projectId);
  const chatReq = parseChat(body); // validates branchId + message, throws HttpValidationError on bad input
  const chunks = handleChat(deps, chatReq); // AsyncIterable<LLMChunk>

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      for await (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk.content));
        if (chunk.done) break;
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
```

`parseChat` accepts `{ branchId, message, tokenBudget?, keywords?, model? }` and throws `HttpValidationError` (import from `@bonsai/server`) on malformed input — catch it in your route and return a 400.

## 3. A ContextPacket inspector route

This is the "how users can experiment with the context" surface: expose the exact `ContextPacket` a chat call would send, without sending it.

```ts title="app/api/context/route.ts"
import { handleInspectContext, parseInspectContext } from '@bonsai/server';
import { getBonsaiDeps } from '@/lib/bonsai';

export async function POST(req: Request) {
  const body = await req.json();
  const deps = getBonsaiDeps(body.projectId);
  const packet = await handleInspectContext(deps, parseInspectContext(body));
  return Response.json(packet);
}
```

Point a debug panel at this route with the current `branchId` (and optionally `keywords`/`tokenBudget`/`model`) to render `packet.messages`, `packet.includedWikiPageIds`, `packet.renderedPromptPreview`, and `packet.truncated` before the user sends anything — this is the same packet `handleChat` will build.

## 4. Retrieval and merge routes follow the same shape

```ts title="app/api/retrieve/route.ts"
import { handleRetrieve, parseRetrieve } from '@bonsai/server';
import { getBonsaiDeps } from '@/lib/bonsai';

export async function POST(req: Request) {
  const body = await req.json();
  const deps = getBonsaiDeps(body.projectId);
  const hits = await handleRetrieve(deps, parseRetrieve(body)); // 501 (HttpNotImplementedError) if deps.retriever is unset
  return Response.json({ hits });
}
```

`handleMerge`, `handleDistill`, `handleCreateBranch`, and `handleResolveTrace` all follow the same `(deps, parsed input) => Promise<result>` shape — see [`@bonsai/server`'s handlers](/api/server/index/) for the complete list. `handleMerge`'s HTTP-facing `overrideSummary` field is a static string, since the façade's `editSummary` callback can't cross a request boundary — send the human's edited text as `overrideSummary` from your route.

## Error handling

Every handler throws `HttpValidationError` (400) on bad input, or a domain error from `@bonsai/core` (`BonsaiNotFoundError`, `BonsaiInvariantError`, …) that `mapErrorToHttp` from `@bonsai/server` converts to the right status code:

```ts
import { mapErrorToHttp, HttpValidationError } from '@bonsai/server';

try {
  // ... handler call
} catch (err) {
  const mapped = mapErrorToHttp(err);
  return Response.json(mapped.body, { status: mapped.status });
}
```

## Not using Next.js?

`@bonsai/server` also exports `createRequestListener(deps)`, a plain Node `http` request listener implementing the same routes (`POST /projects`, `POST /chat`, `POST /context:assemble`, etc.) as SSE/JSON over raw HTTP — usable from Express, Fastify, or a bare `http.createServer`. The App Router routes above call the same underlying `handle*` functions, just without going through that listener.
