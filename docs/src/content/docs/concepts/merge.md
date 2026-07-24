---
title: Merge
description: Land what a branch should know now — with a reviewed summary — into its target branch.
---

A merge takes a source branch and lands a reviewed summary of its transcript onto a target branch (usually the parent) as a synthetic assistant message. It is a distinct, user-triggered action. The summary is editable before the merge applies.

> **Read these first.** Stub. Full concept page lands in a future content pass — see the [issue tracker](https://github.com/Joaoha/Bonsai/issues) for progress.

## Invariants

<div class="invariants">

**These invariants MUST hold for any embedder that exposes merge to end users.**

- Merge transitions are strictly ordered: `proposed → summarized → (edited?) → applied`.
- The `editSummary` hook is called exactly once per merge and its return value is what lands on the target branch.
- Applying a merge appends a merge-commit message to the target branch — it does **not** rewrite history.
- Merging flips the source branch's `mergedToParent` flag; siblings still cannot see the merge until they merge themselves.
- Merge and distill are separate user actions. A merge never writes to the wiki.

</div>

## Use this in a recipe

- [Embed in Next.js](/recipes/embed-nextjs/)
