---
title: Retrieval
description: Query → ranked hits → ContextPacket. Pluggable Retriever with FTS by default; embeddings deferred.
---

Retrieval maps a query to a ranked list of hits via the `Retriever` interface — a pluggable boundary. `@bonsai/storage-postgres` ships `PostgresFtsRetriever`, a Postgres full-text-search implementation, as the default; embeddings are opt-in and deferred until FTS is demonstrably weak on real corpora (see the [Custom Retriever recipe](/recipes/custom-retriever/)).

```ts
interface RetrieverHit {
  id: Id;
  kind: 'wiki' | 'message';
  title: string;
  snippet: string;
  score: number;
}

interface Retriever {
  search(query: string, opts?: { limit?: number }): Promise<RetrieverHit[]>;
}
```

<div class="invariants" style="border-left-color: var(--sl-color-orange-high, orange);">

**Current wiring:** `Bonsai.assembleContext()` does not call a `Retriever` today — it reads wiki pages straight from `Storage.wikiPages.search()`, keyed by `opts.keywords`, with no ranking beyond what your `Storage` adapter's `search` implementation does. A `Retriever` you construct is currently reached through `@bonsai/server`'s `handleRetrieve` (`POST /retrieve`) or by calling `.search()` yourself — it is not yet threaded into `ContextPacket` assembly. Don't assume swapping the `Retriever` changes what a chat call sees; today it only changes what an explicit `/retrieve` call returns.

</div>

## Invariants

<div class="invariants">

**These invariants MUST hold for any Retriever adapter.**

- Every returned hit carries `id`, `kind`, `title`, `snippet`, and `score` — no anonymous sources.
- Retrieval never mutates the wiki; it only reads.
- `search()` respects `opts.limit` when provided and returns `[]` (not a throw) for an empty or unmatched query.
- Scores are comparable within a single retriever, not across retrievers. Merging retrievers is an embedder concern.
- The FTS default is keyword-only. Any embedding-backed retriever should document its cost, latency, and index-update semantics — see the [Custom Retriever recipe](/recipes/custom-retriever/).

</div>

## Use this in a recipe

- [Custom Retriever](/recipes/custom-retriever/)
