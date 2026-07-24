---
title: Distill
description: Turn a merge (and its transcript) into a durable wiki page that future conversations can retrieve.
---

Distill takes a merge id and produces a Markdown wiki page: title, frontmatter linking back to the merge and its source messages, and a body that is a compact restatement of the merged summary. It is user-triggered — Bonsai never distills automatically on every message.

> **Read these first.** Stub. Full concept page lands in a future content pass — see the [issue tracker](https://github.com/Joaoha/Bonsai/issues) for progress.

## Invariants

<div class="invariants">

**These invariants MUST hold for any WikiStore adapter and any embedder that exposes distill.**

- Distill only accepts a merge that is `applied`.
- Every wiki page written by distill carries `frontmatter.mergeId` and `frontmatter.sources[]` — the audit trail from claim to raw transcript.
- Distill is idempotent per merge id — re-running produces the same page path.
- Distill never runs automatically. If your product wants a "distill this" button, it MUST be explicit user intent.
- Distill writes only into the configured `wiki/` root — never outside the workspace.

</div>

## Use this in a recipe

- [Custom Storage](/recipes/custom-storage/)
- [Custom Retriever](/recipes/custom-retriever/)
