---
title: Tree Model
description: Projects, branches, messages, and fork points — the shape of a Bonsai conversation.
---

A Bonsai project is a tree of messages. Every project has exactly one `main` branch at creation; every other branch forks from a specific message on some parent branch (the fork point). Branches are the unit of exploration; messages are the unit of context.

Stub. Full concept page lands under [BONA-238](/BONA/issues/BONA-238)'s Phase 2 content pass — see the [IA](/BONA/issues/BONA-222#document-ia) §4 for the intended structure.

## Invariants

<div class="invariants">

**These invariants MUST hold for any storage adapter or embedder built on `@bonsai/core`.**

- Every project starts with exactly one `main` branch.
- Every non-`main` branch records a fork point: `(parentBranchId, forkMessageId)`.
- Messages on a branch are strictly ordered; message ordering never rewinds.
- Sibling branches never leak into each other's context unless explicitly merged or explicitly selected via ContextPacket rules.
- Deleting a branch never deletes messages that other branches fork from.

</div>

## Use this in a recipe

- [Embed in Next.js](/recipes/embed-nextjs/)
- [Custom Storage](/recipes/custom-storage/)
