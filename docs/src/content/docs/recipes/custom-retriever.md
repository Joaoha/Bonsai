---
title: Custom Retriever
description: Implement the Retriever interface — e.g. a pgvector embedding retriever — and slot it into ContextPacket assembly.
---

**Concepts you should know:** [ContextPacket](/concepts/context-packet/) · [Retrieval](/concepts/retrieval/) · [Wiki](/concepts/wiki/).

Retrieval is a pluggable boundary in `@bonsai/core`. `@bonsai/storage-postgres` ships `PostgresFtsRetriever` (keyword search via `to_tsvector`/`ts_rank`) as the default. Implement `Retriever` yourself to swap in embeddings, a hosted vector DB, or a hybrid ranker.

## The interface

```ts
interface RetrieverHit {
  id: Id;
  kind: 'wiki' | 'message';
  title: string;
  snippet: string;
  score: number;
}

interface RetrieverSearchOptions {
  limit?: number;
}

interface Retriever {
  search(query: string, opts?: RetrieverSearchOptions): Promise<RetrieverHit[]>;
}
```

`search` is the only method. It must:

- never mutate anything — retrieval only reads
- respect `opts?.limit` when provided
- return hits sorted by `score` descending (callers do not re-sort)
- return `[]` rather than throwing for an empty or unmatched query

## Where retrieval plugs in

`Bonsai` itself does not hold a `Retriever` — it takes one optionally, and does not call `.search()` internally today (`Bonsai.assembleContext` reads wiki pages straight from `Storage.wikiPages`, keyed by `opts.keywords`). Embedders that want ranked retrieval call their `Retriever` directly, or expose it over HTTP via `@bonsai/server`'s `handleRetrieve` (`POST /retrieve`, 501 if no retriever is configured). See the [Embed in Next.js recipe](/recipes/embed-nextjs/) for the HTTP wiring.

## A pgvector sketch

```ts
import type { Retriever, RetrieverHit, RetrieverSearchOptions, Id } from '@bonsai/core';
import type { PgQueryable } from '@bonsai/storage-postgres';

export interface EmbeddingRetrieverOptions {
  pool: PgQueryable;
  projectId: Id;
  embed(query: string): Promise<number[]>;
  defaultLimit?: number;
}

export class EmbeddingRetriever implements Retriever {
  constructor(private readonly opts: EmbeddingRetrieverOptions) {}

  async search(query: string, opts?: RetrieverSearchOptions): Promise<RetrieverHit[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) return [];
    const vector = await this.opts.embed(trimmed);
    const limit = opts?.limit ?? this.opts.defaultLimit ?? 10;
    const { rows } = await this.opts.pool.query<{
      id: string;
      title: string;
      snippet: string;
      score: number;
    }>(
      `SELECT id, title, left(content, 200) AS snippet,
              1 - (embedding <=> $2) AS score
       FROM bonsai_wiki_pages
       WHERE project_id = $1
       ORDER BY embedding <=> $2
       LIMIT $3`,
      [this.opts.projectId, vector, limit],
    );
    return rows.map((r) => ({ id: r.id, kind: 'wiki' as const, ...r }));
  }
}
```

This assumes a `pgvector` extension and an `embedding` column you maintain yourself — `@bonsai/storage-postgres`'s built-in schema does not include one. Populate it in your own write path (e.g. after `bonsai.distill()` succeeds).

## Benchmark before switching

`PostgresFtsRetriever` is keyword-only by design — no embedding cost, no drift between index and content. Before replacing it in a product, benchmark your embedding retriever against it on real queries from your corpus: embeddings tend to win on paraphrase/semantic queries and lose on exact terms (error codes, API names, quoted strings). Many embedders run both and merge results client-side rather than fully switching.

## Reference implementation

Read [`PostgresFtsRetriever`](/api/storage-postgres/classes/postgresftsretriever/) for the full FTS query, including `ts_headline` snippet extraction.
