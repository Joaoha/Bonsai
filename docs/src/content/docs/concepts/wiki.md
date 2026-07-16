---
title: Wiki
description: A Markdown-on-disk knowledge base with frontmatter-indexed pages and an append-only log.
---

The wiki is the durable memory of a Bonsai project: a directory of Markdown pages, each with YAML frontmatter, plus an `index.md` and a `log.md`. It is designed to be readable by humans, greppable by tools, and cheap to back up.

> **Read these first.** Stub. Full concept page lands under [BONA-238](/BONA/issues/BONA-238)'s Phase 2 content pass — see the [IA](/BONA/issues/BONA-222#document-ia) §4 for the intended structure.

## Invariants

<div class="invariants">

**These invariants MUST hold for any WikiStore adapter.**

- All writes are scoped to a configured root directory — no path escape via `..` or absolute paths.
- Every page has a YAML frontmatter block with at least `title`, `mergeId`, and `sources[]`.
- `index.md` and `log.md` are updated in the same transaction as the page write — no partially-indexed pages.
- Page slugs are stable per merge id — re-distilling a merge writes the same slug.
- Deleting or moving a page updates `index.md` and appends a delete entry to `log.md`.

</div>

## Use this in a recipe

- [Custom Storage](/recipes/custom-storage/)
- [Custom Retriever](/recipes/custom-retriever/)
