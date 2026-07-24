---
title: ContextPacket
description: The inspectable, reconstructable record of everything a model call saw.
---

A `ContextPacket` is the exact input the model was given for a chat turn: the node walk (which messages), the wiki hits (which pages, at what rank), the system rules, and the deterministic truncation applied to respect provider limits. Every chat call returns one; every packet is persisted and addressable by id.

> **Read these first.** Stub. Full concept page lands in a future content pass — see the [issue tracker](https://github.com/Joaoha/Bonsai/issues) for progress.

## Invariants

<div class="invariants">

**These invariants MUST hold for any embedder or provider adapter.**

- Every model call must be reconstructable from its `ContextPacket`. If a user cannot see why the model knew something, the feature is broken.
- Truncation is deterministic and typed (`nodeWalkTruncated`, `wikiHitsTruncated`, `systemRulesTruncated`) — never silent drops.
- Included wiki hits carry their retriever, score, and source path — no anonymous retrieval.
- The packet is written **before** the provider call starts, not after it succeeds, so failed calls are still auditable.

</div>

## Use this in a recipe

- [Embed in Next.js](/recipes/embed-nextjs/)
- [Custom Retriever](/recipes/custom-retriever/)
