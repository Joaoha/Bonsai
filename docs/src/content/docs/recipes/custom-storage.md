---
title: Custom Storage
description: Implement the Storage interface against a non-Postgres backend (SQLite, DynamoDB, etc.).
---

**Concepts you should know:** [Tree Model](/concepts/tree-model/) · [Wiki](/concepts/wiki/).

`@bonsai/core` is storage-agnostic: `Bonsai` depends only on the `Storage` interface. `@bonsai/storage-postgres` is one implementation. Implement `Storage` against SQLite, DynamoDB, or an in-memory map for tests — the domain logic in `Bonsai` does not change.

## The interface

`Storage` is a bag of six repositories, each a thin CRUD surface over one domain type:

```ts
interface Storage {
  projects: ProjectRepository;
  branches: BranchRepository;
  messages: MessageRepository;
  merges: MergeRepository;
  distillations: DistillationRepository;
  wikiPages: WikiPageRepository;
}
```

Every `findById` and `lastByBranch` method returns `T | null` — never throws for not-found. `Bonsai` converts `null` into `BonsaiNotFoundError` at the point it expects a value. See [`Storage`](/api/core/interfaces/storage/) for the full method list on each repository (`create`, `findById`, `findByBranchId`, `update`, `maxLane`, `search`, …).

Note `Storage.wikiPages` is a *searchable index* of wiki page content, separate from the durable Markdown-on-disk copy written by `WikiStore` (see below) — `Bonsai.distill()` writes to both.

## Invariants your adapter must preserve

These come directly from `@bonsai/core`'s domain logic (`bonsai.ts`, `merge/state.ts`, `context/ancestry.ts`) — violate them and the tree/merge/context-assembly code will misbehave in ways that are hard to debug downstream:

- `branches.create` for a new project's first branch must be named `'main'` with `parentBranchId: null`, `forkPoint: null`, `lane: 0` — `Bonsai.createProject` relies on this.
- `branches.maxLane(projectId)` returns the highest `lane` in use for the project, or `-1` if none — used to assign the next branch a unique lane.
- `messages.findByBranchId` returns messages in strictly ascending `sequence` order; `Bonsai` never re-sorts them.
- `merges.lastMergeCommitBetween(sourceId, targetId)` returns the most recent message where `isMergeCommit === true` and `mergedBranchId === sourceId`, scoped to branch `targetId`.
- `wikiPages.search` should rank hits by relevance to `keywords`; `Bonsai.assembleContext` takes the top 5 verbatim with no re-ranking.

## Implementing WikiStore too

Most storage adapters pair with a `WikiStore` implementation, since `Bonsai.distill()` writes to both `Storage.wikiPages` (the searchable index) and `WikiStore` (the durable Markdown files) in the same call. `@bonsai/wiki-fs`'s `FsWikiStore` is the reference:

```ts
interface WikiStore {
  write(input: WikiPageInput): Promise<void>;
  read(slug: string): Promise<WikiPageInput | null>;
  list(): Promise<WikiIndexEntry[]>;
  appendLogEntry(entry: WikiLogEntry): Promise<void>;
  upsertIndex(index: WikiIndexEntry[]): Promise<void>;
}
```

If you're not writing to disk (e.g. storing wiki pages purely in your database), you can implement `WikiStore` as a thin wrapper around the same tables your `Storage.wikiPages` repository uses — just keep `write()` idempotent per slug, matching `FsWikiStore`'s on-disk behavior (re-distilling a merge overwrites the same file).

## A minimal in-memory Storage (for tests)

```ts
import type { Storage, Project, Branch } from '@bonsai/core';

export function createInMemoryStorage(): Storage {
  const projects = new Map<string, Project>();
  const branches = new Map<string, Branch>();
  let nextId = 1;
  const id = () => String(nextId++);

  return {
    projects: {
      async create(input) {
        const project: Project = { id: id(), name: input.name, createdAt: new Date(), ...input };
        projects.set(project.id, project);
        return project;
      },
      async findById(pid) {
        return projects.get(pid) ?? null;
      },
    },
    branches: {
      async create(input) {
        const branch: Branch = {
          id: id(),
          mergedToParent: false,
          createdAt: new Date(),
          ...input,
        };
        branches.set(branch.id, branch);
        return branch;
      },
      async findById(bid) {
        return branches.get(bid) ?? null;
      },
      async findByProjectId(pid) {
        return [...branches.values()].filter((b) => b.projectId === pid);
      },
      async update(bid, patch) {
        const existing = branches.get(bid);
        if (!existing) throw new Error(`branch ${bid} not found`);
        const updated = { ...existing, ...patch };
        branches.set(bid, updated);
        return updated;
      },
      async maxLane(pid) {
        const lanes = [...branches.values()].filter((b) => b.projectId === pid).map((b) => b.lane);
        return lanes.length > 0 ? Math.max(...lanes) : -1;
      },
    },
    // messages / merges / distillations / wikiPages follow the same shape —
    // see `@bonsai/storage-postgres`'s repositories/*.ts for a complete,
    // fully-typed implementation to copy from.
  } as Storage;
}
```

## Reference implementation

Read [`createPostgresStorage`](/api/storage-postgres/functions/createpostgresstorage/) and the six repository modules under `packages/storage-postgres/src/repositories/` for a complete, production-grade `Storage` implementation, including the SQL migrations under `packages/storage-postgres/migrations/` that define the reference schema.
