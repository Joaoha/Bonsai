---
title: ContextPacket
description: The inspectable, reconstructable record of everything a model call saw.
---

A `ContextPacket` is the exact input assembled for a chat turn: the ancestry messages walked, which wiki pages and merge summaries were folded in, the rendered system preamble, and whether anything was dropped to fit the token budget. `Bonsai.assembleContext(branchId, opts?)` returns one directly — call it any time to inspect what a chat call *would* send, before spending a token. `Bonsai.chat()` builds the same packet internally and streams the reply; it does not return the packet itself, so inspect via `assembleContext` if you need to see it.

```ts
interface ContextPacket {
  projectId: Id;
  branchId: Id;
  model: string;
  provider: string;
  timestamp: string;
  messages: ContextPacketMessage[];   // conversation only — merge-commit rows excluded
  includedMessageIds: Id[];           // includes merge-commit ids, for audit
  includedMergeIds: Id[];
  includedWikiPageIds: Id[];
  tokenEstimate: number;
  renderedPromptPreview: string;      // wiki + merges + conversation, concatenated
  systemPreamble: string;             // wiki + merges only
  truncated: boolean;
}
```

## Invariants

<div class="invariants">

**These invariants MUST hold for any embedder or provider adapter.**

- Every model call must be reconstructable from its `ContextPacket`. If a user cannot see why the model knew something, the feature is broken.
- Wiki pages and merge summaries are included **whole or not at all** (wiki capped at 20% of the token budget, merges at 30% of what's left) — assembly never truncates a single page or summary mid-content.
- Conversation messages fill the remaining budget and are dropped oldest-first when they don't fit; `truncated: true` signals this happened. There is no separate flag for wiki/merge exclusion — check `includedWikiPageIds` / `includedMergeIds` against what you queried for.
- `includedMessageIds` records every message folded into the packet, including merge-commit messages whose text was promoted into `systemPreamble` rather than `messages[]` — so the id trail stays complete even though the commit text itself isn't repeated in the conversation array.

</div>

## Use this in a recipe

- [Embed in Next.js](/recipes/embed-nextjs/)
- [Custom Retriever](/recipes/custom-retriever/)
