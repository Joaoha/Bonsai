---
title: Distill
description: Turn a merge (and its transcript) into a durable wiki page that future conversations can retrieve.
---

Distill takes **exactly one** of a `branchId` or a `mergeId` (`bonsai.distill({ mergeId })` or `bonsai.distill({ branchId })`) and produces a Markdown wiki page: title, frontmatter linking back to the source, and a body built from the source branch's transcript. It is user-triggered — Bonsai never distills automatically on every message.

## Invariants

<div class="invariants">

**These invariants MUST hold for any WikiStore adapter and any embedder that exposes distill.**

- `distill()` requires exactly one of `branchId` / `mergeId` — passing both or neither throws `BonsaiInvariantError`.
- Every wiki page written by distill carries `frontmatter.sources[]` (the source message ids) and whichever of `frontmatter.mergeId` / `frontmatter.branchId` applies — never both, matching the `Distillation` record's own exclusivity rule.
- Distill writes to both the searchable `Storage.wikiPages` index and the durable `WikiStore` Markdown file in the same call — see [Custom Storage](/recipes/custom-storage/).
- Distill never runs automatically. If your product wants a "distill this" button, it MUST be explicit user intent.
- Distill writes only into the configured `wiki/` root — never outside the workspace (enforced by `WikiStore` adapters like `FsWikiStore`, not by `@bonsai/core` itself).

</div>

<div class="invariants" style="border-left-color: var(--sl-color-orange-high, orange);">

**Not yet enforced:** the façade does not currently check that a merge is `status: 'applied'` before distilling it, and re-distilling the same source does not guarantee the same slug unless the title is unchanged (the slug is derived from the title, e.g. `Merge: <branch name>`, not from the merge/branch id directly). Don't rely on either behavior until it's covered by a test in `packages/core`.

</div>

## Use this in a recipe

- [Custom Storage](/recipes/custom-storage/)
- [Custom Retriever](/recipes/custom-retriever/)
