---
title: Retrieval
description: Query → ranked hits → ContextPacket. Pluggable Retriever with FTS by default; embeddings deferred.
---

Retrieval maps a query (typically the current user message) to a ranked list of wiki-page hits, which the ContextPacket assembler then splices into the model input. The `Retriever` interface is a pluggable boundary — Bonsai ships a Postgres FTS retriever by default; embeddings are opt-in and deferred until FTS is demonstrably weak on real corpora.

> **Read these first.** Stub. Full concept page lands under [BONA-238](/BONA/issues/BONA-238)'s Phase 2 content pass — see the [IA](/BONA/issues/BONA-222#document-ia) §4 for the intended structure.

## Invariants

<div class="invariants">

**These invariants MUST hold for any Retriever adapter.**

- Every returned hit carries `path`, `score`, and `retriever` — no anonymous sources.
- Retrieval never mutates the wiki; it only reads.
- Scores are comparable within a single retriever, not across retrievers. Merging retrievers is an embedder concern.
- Retrievers respect a query token budget — they may truncate but must report `truncated: true` on the packet.
- The FTS default is keyword-only. Any embedding-backed retriever MUST document its cost, latency, and update semantics.

</div>

## Use this in a recipe

- [Custom Retriever](/recipes/custom-retriever/)
