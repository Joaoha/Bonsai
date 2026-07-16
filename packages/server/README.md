# @bonsai/server

Thin optional HTTP layer wrapping the [@bonsai/core](../core) `Bonsai` façade.

This package is **not required** to use Bonsai. It exists so an embedder that just wants "put Bonsai behind HTTP for my Next.js API routes / minimal Node service" can drop it in without gluing routes together themselves.

## Scope

- Handlers for: `createProject`, `createBranch`, `chat` (streaming), `merge`, `distill`, `inspectContext`, `retrieve`, `resolveTrace`.
- Framework-agnostic. The bundled `createRequestListener` targets Node's built-in `http.createServer`. The individual `handle*` functions are plain async functions and can be called from Fastify, Express, Next route handlers, or anywhere else.
- No auth, no session, no telemetry, no CORS. Those are private-app concerns; wrap this listener yourself if you need them.

## Usage — bundled Node listener

```ts
import { createServer } from 'node:http';
import { Bonsai } from '@bonsai/core';
import { createRequestListener } from '@bonsai/server';

const bonsai = new Bonsai({ storage, provider, wiki });
const server = createServer(createRequestListener({ bonsai }));
server.listen(3001);
```

## Routes

| Method | Path | Body | Notes |
|---|---|---|---|
| `POST` | `/projects` | `{ name, description? }` | Creates project + default `main` branch. |
| `POST` | `/branches` | `{ fromBranchId, forkPoint, name?, pinnedAgent? }` | |
| `POST` | `/chat` | `{ branchId, message, tokenBudget?, keywords?, model? }` | Response is `text/event-stream`. |
| `POST` | `/merges` | `{ sourceBranchId, targetBranchId, overrideSummary? }` | `overrideSummary` replaces the LLM-drafted summary before apply. |
| `POST` | `/distillations` | `{ branchId? \| mergeId? }` | Exactly one of the two must be set. |
| `POST` | `/context:assemble` | `{ branchId, tokenBudget?, keywords?, model? }` | Returns a `ContextPacket` (Directive B — inspectable context). |
| `POST` | `/retrieve` | `{ query, limit? }` | Returns `{ hits }`. 501 if no retriever was passed to `createRequestListener`. |
| `GET` | `/traces/:wikiSlug` | — | Audit trace from wiki slug → distillation → transcript. |

### Chat SSE format

Each chunk from `LLMProvider.streamCompletion` is emitted as:

```
event: chunk
data: {"content":"hel","done":false}

event: chunk
data: {"content":"lo","done":false}

event: chunk
data: {"content":"","done":true}

event: end
data: {}
```

Errors that occur mid-stream are emitted as `event: error` with the mapped status code (404, 422, etc.). Errors before the first byte flush are returned as a normal JSON error response.

## Error mapping

| Domain error | HTTP status | Error code |
|---|---|---|
| `BonsaiNotFoundError` | 404 | `not_found` |
| `BonsaiInvariantError` | 422 | `invariant_violation` |
| `BonsaiTokenBudgetError` | 413 | `token_budget_exceeded` |
| `BonsaiInterfaceError` | 502 | `adapter_error` |
| Validation | 400 | `invalid_request` |
| Anything else | 500 | `internal_error` |

## Framework-agnostic handlers

If you already have a router, skip `createRequestListener` and call handlers directly:

```ts
import { handleChat, parseChat } from '@bonsai/server';

app.post('/chat', async (req, reply) => {
  const chatReq = parseChat(req.body);
  for await (const chunk of handleChat({ bonsai }, chatReq)) {
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  reply.raw.end();
});
```

## Non-goals

- No route-level auth, no rate limits, no CORS, no request logging. Compose those in your host app.
- No JSON schema library dependency. Parsing is hand-rolled and rejects unknown or malformed input with 400.
- Body size limited to 1 MiB per request. Wrap the listener if you need larger.
