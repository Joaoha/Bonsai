---
title: Tree Model
description: Projects, branches, messages, and fork points — the shape of a Bonsai conversation.
---

A Bonsai project is a tree of messages. Every project has exactly one `main` branch at creation; every other branch forks from a specific message on some parent branch (the fork point). Branches are the unit of exploration; messages are the unit of context.

```ts
interface Branch {
  id: Id;
  projectId: Id;
  name: string;
  parentBranchId: Id | null;
  forkPoint: Id | null; // the message id this branch forked from
  lane: number;
  autoNamed: boolean;
  mergedToParent: boolean;
  createdAt: Date;
}
```

## Invariants

<div class="invariants">

**These invariants MUST hold for any storage adapter or embedder built on `@bonsai/core`.**

- Every project starts with exactly one `main` branch: `parentBranchId: null`, `forkPoint: null`, `lane: 0`.
- Every non-`main` branch records a fork point: `(parentBranchId, forkPoint)`, where `forkPoint` is the id of the message it forked from. Both are set together, or both are null — never one without the other.
- Messages on a branch are strictly ordered by `sequence`; message ordering never rewinds.
- Sibling branches never leak into each other's context unless explicitly merged — `Bonsai.assembleContext()` walks only the current branch's ancestry chain.
- `lane` distinguishes sibling branches forked from the same point for display purposes; it has no effect on context assembly.

</div>

## Use this in a recipe

- [Embed in Next.js](/recipes/embed-nextjs/)
- [Custom Storage](/recipes/custom-storage/)
