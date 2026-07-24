---
title: Wiki
description: A Markdown-on-disk knowledge base with frontmatter-indexed pages and an append-only log.
---

The wiki is the durable memory of a Bonsai project: a directory of Markdown pages, each with YAML frontmatter, plus an `index.md` and a `log.md`. It is designed to be readable by humans, greppable by tools, and cheap to back up. `@bonsai/wiki-fs`'s `FsWikiStore` is the reference `WikiStore` implementation.

```ts
interface WikiStore {
  write(input: WikiPageInput): Promise<void>;
  read(slug: string): Promise<WikiPageInput | null>;
  list(): Promise<WikiIndexEntry[]>;
  appendLogEntry(entry: WikiLogEntry): Promise<void>;
  upsertIndex(index: WikiIndexEntry[]): Promise<void>;
}
```

## Invariants

<div class="invariants">

**These invariants MUST hold for any WikiStore adapter.**

- All writes are scoped to a configured root directory — no path escape via `..` or absolute paths (`FsWikiStore` enforces this with `assertAbsoluteRoot` / `assertSafeSlug`).
- Every page has a YAML frontmatter block with at least `title` and `sources[]`, plus whichever of `mergeId` / `branchId` the distillation was sourced from (never both — see [Distill](/concepts/distill/)).
- `index()` and `log()` are separate methods (`upsertIndex`, `appendLogEntry`) — `Bonsai.distill()` calls `write()` on the `WikiStore` but does not itself call `upsertIndex`/`appendLogEntry` today; adapters that want a maintained `index.md`/`log.md` currently need to call those themselves or extend the façade.
- Page slugs are derived from the page title (`slugifyTitle`), not a random id — re-distilling with an unchanged title writes the same slug.

</div>

## Use this in a recipe

- [Custom Storage](/recipes/custom-storage/)
- [Custom Retriever](/recipes/custom-retriever/)
