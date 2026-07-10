# EXTRACTION_PLAN.md — Bonsai → `@bonsai/core` boundary map

Status: Phase 0 exit artifact for the library conversion tracked in [BONA-217](/BONA/issues/BONA-217).
Scope: identify, for every current MVP module, whether it moves into the public library (`packages/*`) or stays in the private app. This document is the source of truth the Phase 1 subtree-split will follow.

## 1. Guiding rules (from the approved plan)

- Publish the **primitives**, not the app. External embedders should get the domain model, ContextPacket assembly, merge/distill, retrieval, and pluggable interfaces — not our Next.js UI, auth, or deployment glue. (Plan §0, §2.)
- Boundary rules are hard invariants, enforced in CI:
  - Zero UI-framework imports in `core`.
  - Zero Postgres-specific SQL in `core`; access flows through the `Storage` interface.
  - Zero I/O in constructors; use a lazy first-use or explicit `init()`.
  - Public API is the package root only; deeper paths are unstable. (Plan §2.4.)
- The private app becomes a consumer of the published packages and the reference/dogfood implementation. (Plan §1.3.)
- Deferred: React components, SQLite adapter, non-OpenAI provider, embeddings retriever — sibling packages for Phase 4. (Plan §7.)

## 2. Target package layout

Matches Plan §1.2 exactly; repeated here so the split script has a single reference.

```
bonsai-core/
  packages/
    core/              # framework-agnostic domain
    storage-postgres/  # migrations + repositories (Postgres adapter)
    provider-openai/   # OpenAI-compatible chat/streaming provider
    wiki-fs/           # Markdown-on-disk WikiStore implementation
    server/            # thin optional HTTP layer
  examples/
    minimal-node/
    nextjs-app/
  docs/
```

`storage-sqlite`, `react`, `provider-anthropic`, and `retriever-embeddings` are Phase 4 packages; not extracted now.

## 3. Module → destination table

The table below is written against the MVP source tree the app-implementer will produce under BONA-1. Where the exact file path is not yet frozen, the row names the module by responsibility; the Phase 1 subtree-split step (BONA-217 §7 Phase 1) will resolve each row to a concrete path list before running `git subtree split` / `git filter-repo`.

Legend:

- **PUBLIC → `<pkg>`** — moves into the named public package.
- **PRIVATE (app)** — stays in the private reference app.
- **SPLIT** — the module contains both public and private concerns; the row lists the split.

### 3.1 Domain model (tree, branches, messages, merges, distillations)

| Module / responsibility | Destination | Rationale |
|---|---|---|
| Node / Message entity + invariants (fork point, ordering) | PUBLIC → `core` | Core primitive; every embedder needs it. |
| Branch entity + fork-point rules | PUBLIC → `core` | Same. |
| Merge entity + status transitions (proposed → summarized → applied) | PUBLIC → `core` | Merge is a first-class primitive. |
| Distillation entity + wiki-page linkage | PUBLIC → `core` | Distill is a first-class primitive. |
| Data-model invariants + pure functions (no I/O) | PUBLIC → `core` | Testable without a DB. |
| ID generation, clock abstraction | PUBLIC → `core` | Injected; embedders may override. |

### 3.2 ContextPacket assembly

| Module | Destination | Rationale |
|---|---|---|
| `ContextPacket` type + serializer | PUBLIC → `core` | The inspectable-context contract IS the library's headline feature (Directive B). |
| Inclusion/exclusion rules (branch isolation, ancestor walk, wiki hits) | PUBLIC → `core` | Deterministic; no I/O. |
| Token-budget-aware truncation | PUBLIC → `core` | Deterministic; provider limits injected. |
| Provider limit table / adapter | PUBLIC → `provider-openai` (interface in `core`) | The limits are provider-specific; the truncation policy is generic. |
| Context inspector UI | PRIVATE (app) | UI. |

### 3.3 Merge & distill engines

| Module | Destination | Rationale |
|---|---|---|
| Merge summary generation (LLM prompt + parse) | PUBLIC → `core` | Uses `LLMProvider`; no UI. |
| Editable-summary hook (pre-apply callback) | PUBLIC → `core` | Directive C: merge and distill stay separate user actions; the hook keeps the "editable" step under embedder control. |
| Target-branch application (append merged summary node) | PUBLIC → `core` | Domain operation. |
| Distill: transcript → durable wiki page (frontmatter, wikilinks) | PUBLIC → `core` (writer uses `WikiStore`) | Domain operation; storage is pluggable. |
| Wiki index / log update logic | PUBLIC → `core` | Same. |
| Merge editor UI (diff view, editable textarea) | PRIVATE (app) | UI. |
| Distill review UI | PRIVATE (app) | UI. |

### 3.4 Retrieval

| Module | Destination | Rationale |
|---|---|---|
| `Retriever` interface | PUBLIC → `core` | Contract. |
| Postgres FTS retriever | PUBLIC → `storage-postgres` | Depends on Postgres. |
| Ranking / snippet-highlight helpers (pure) | PUBLIC → `core` | No I/O. |
| Embeddings retriever | DEFERRED (Phase 4, `retriever-embeddings`) | FTS-first per board directive. |

### 3.5 Storage abstraction

| Module | Destination | Rationale |
|---|---|---|
| `Storage` interface (Node/Branch/Merge/Distillation/Wiki repositories) | PUBLIC → `core` | Contract. |
| Postgres migration files | PUBLIC → `storage-postgres/migrations/` | Ship the SQL, not the runner (Plan §2.2). |
| Postgres repository implementations | PUBLIC → `storage-postgres` | Adapter. |
| App-specific migration runner + wiring | PRIVATE (app) | Deployment concern. |

### 3.6 LLM provider abstraction

| Module | Destination | Rationale |
|---|---|---|
| `LLMProvider` interface (chat, streaming, token count) | PUBLIC → `core` | Contract. |
| OpenAI-compatible client (base URL + api key injection) | PUBLIC → `provider-openai` | Adapter. |
| Streaming iterator adapter | PUBLIC → `provider-openai` | Same. |
| Provider-key handling in env / config UI | PRIVATE (app) | Secrets management is app concern; security audit (§7) will confirm. |

### 3.7 Wiki store

| Module | Destination | Rationale |
|---|---|---|
| `WikiStore` interface | PUBLIC → `core` | Contract. |
| Markdown-on-disk implementation (frontmatter, wikilinks, safe path scoping) | PUBLIC → `wiki-fs` | Adapter; matches board directive on scoped file writes. |
| Path-escape guard | PUBLIC → `wiki-fs` | Security-critical primitive; ships with the adapter. |

### 3.8 Auditability helpers

| Module | Destination | Rationale |
|---|---|---|
| wiki-claim ↔ merge ↔ branch ↔ transcript trace resolver | PUBLIC → `core` | Directive D; belongs with the domain. |
| Audit-trail UI | PRIVATE (app) | UI. |

### 3.9 HTTP surface

| Module | Destination | Rationale |
|---|---|---|
| Thin HTTP handlers wrapping `Bonsai` façade (create project, chat, branch, merge, distill, retrieve, inspect context) | PUBLIC → `server` | Optional; embedders may skip it. |
| Auth / session / user profile routes | PRIVATE (app) | Not a library concern. |
| Streaming chat endpoint (SSE / chunked) | PUBLIC → `server` | Streaming is a first-class UX invariant. |
| Telemetry / analytics middleware | PRIVATE (app) | Deployment concern. |

### 3.10 Frontend

| Module | Destination | Rationale |
|---|---|---|
| Next.js app router, pages, layouts | PRIVATE (app) | Reference implementation only. |
| Tailwind config, shadcn/ui components | PRIVATE (app) | Style choices are not part of the library. |
| Branch tree view, merge editor, wiki review, context inspector | PRIVATE (app) initially; **candidate for `react` package in Phase 4** | Extract only after the API is stable; premature extraction locks the UI shape. |
| React hooks that wrap `@bonsai/core` operations | PRIVATE (app) initially; move to `react` in Phase 4 | Same. |

### 3.11 Tests

| Module | Destination | Rationale |
|---|---|---|
| Unit tests for domain invariants, context assembly, merge/distill logic | PUBLIC → `core` (co-located) | The library must ship its own tests. |
| Storage adapter integration tests (Postgres container) | PUBLIC → `storage-postgres` | Same. |
| Provider adapter tests (mocked HTTP) | PUBLIC → `provider-openai` | Same. |
| Wiki adapter tests (temp dir) | PUBLIC → `wiki-fs` | Same. |
| End-to-end demo test (`create project → branch → merge → distill → retrieve`) | SPLIT: a headless variant in `examples/minimal-node`; the UI-driven variant stays in the app. | Both should exist; both should pass in CI. |

### 3.12 Config, tooling, and repo files

| Module | Destination | Rationale |
|---|---|---|
| `pnpm-workspace.yaml`, root `package.json` | PUBLIC (repo root) | Monorepo scaffold. |
| Changesets config | PUBLIC (repo root) | Release automation (Plan §3). |
| ESLint config with `no-restricted-imports` boundary rules | PUBLIC (repo root) | Enforces §2.4 rules. |
| dependency-cruiser config | PUBLIC (repo root) | Same. |
| TypeDoc config | PUBLIC (repo root) | Docs generation. |
| GitHub Actions release workflow (npm provenance, OIDC) | PUBLIC → `.github/` | Plan §3.3. |
| DCO / CONTRIBUTING / CODE_OF_CONDUCT / SECURITY / issue+PR templates | PUBLIC → `.github/` and repo root | Plan §5. |
| Devcontainer | PUBLIC (repo root) | Contributor onboarding. |
| Private-app deployment configs, secrets, telemetry keys | PRIVATE (app) | Never leaves the private repo. |
| Env-var docs for provider keys | SPLIT: generic names in `provider-openai` README; deployment-specific values in the private app | Secrets stay private. |

## 4. Explicit exclusions (never move)

The following categories must not appear in the extracted tree. If a file matches any of these, it stays private regardless of directory:

- Anything under `apps/` in the private repo.
- Any secret material: `.env`, `.env.*`, `secrets/`, provider keys, session tokens, cookies.
- Telemetry / analytics client code and keys.
- Auth (login flows, session middleware, password/OAuth handling).
- Deployment scripts (Vercel/Fly/Cloudflare), IaC.
- Board-tooling / xenonmaas skill files.
- User profile, billing, tenancy hooks.
- Any file whose git history contains a secret; the Phase 1 rehearsal (§7) runs `trufflehog` on the extracted tree before the first public push.

## 5. Public API surface (v0.1 target)

Ships from `@bonsai/core` root only (Plan §2.3). Everything else is internal.

```ts
export class Bonsai {
  constructor(opts: { storage: Storage; provider: LLMProvider; wiki: WikiStore; retriever?: Retriever });
  createProject(input): Promise<Project>;
  createBranch(from: NodeRef, input): Promise<Branch>;
  chat(branchId, message, opts?): AsyncIterable<Chunk>;
  assembleContext(branchId, opts?): Promise<ContextPacket>;
  merge(sourceBranchId, targetBranchId, opts): Promise<MergeResult>;
  distill(branchId | mergeId, opts): Promise<Distillation>;
}
export interface Storage { /* Node/Branch/Merge/Distillation/Wiki repositories */ }
export interface LLMProvider { /* chat + streaming + tokenize */ }
export interface WikiStore { /* read/write/list markdown pages */ }
export interface Retriever { /* query → ranked hits */ }
```

Types re-exported from root: `ContextPacket`, `Node`, `Branch`, `Merge`, `Distillation`, `MergeResult`, `RetrieverHit`, error classes.

## 6. Boundary enforcement (CI)

Phase 1 must land these checks before Phase 2 opens (Plan §8 mitigation for "core still leaks app assumptions"):

1. **ESLint `no-restricted-imports`** in `packages/core/**`: bans `react`, `react-dom`, `next/*`, `tailwindcss`, `pg`, `postgres`, `sqlite*`, `fs` (except explicit path-scoped helpers), `net`, `http` clients other than the injected `LLMProvider`.
2. **`dependency-cruiser`** rule set that forbids `packages/core → packages/storage-*`, `packages/core → packages/provider-*`, `packages/core → packages/wiki-fs`. Direction is one-way: adapters depend on `core`, never the reverse.
3. **`typescript` project references** with `composite: true` so violations surface as build errors, not lint warnings.
4. **`publint` + `arethetypeswrong`** on every `packages/*` package as a release gate.
5. **`trufflehog`** on the extracted tree before the first public push (rehearsal in §7).

## 7. Phase 1 execution checklist (references)

The following follow-up child issues under [BONA-217](/BONA/issues/BONA-217) will drive execution against this map:

1. Subtree-split rehearsal on a scratch remote (`git subtree split` or `git filter-repo`), `trufflehog` scan, verify diff against §3 destinations — blocks the first public push. Owned by TL, security review requested.
2. Security audit of provider-key handling and file-write path scoping (`WikiStore` adapter) — blocks the first public push. Owned by a Security sub-agent (to be requested).
3. Docs-site information architecture — opens at Phase 2 kickoff. Owned by a UX sub-agent (to be requested).

Every remaining Phase 1 exit criterion in Plan §7 will be filed as a child issue by the TL as Phase 1 opens (workspace scaffold, subtree extract, private-app rewire, CI green).

## 8. Open questions for the PE

1. **Primary core language** — TS or Python? The written recommendation is posted as a comment on [BONA-219](/BONA/issues/BONA-219); the PE makes the final call per Plan §10.4. This document assumes TS in the paths above; a Python decision renames `packages/*` to a `bonsai/` distribution with equivalent boundaries and inverts the "non-primary language ships as thin client" note.
2. **Repo name** — `bonsai-core` vs `@bonsai/core` scope on npm. Recommendation: register the `@bonsai` npm org and publish `@bonsai/core`, `@bonsai/storage-postgres`, etc. so the surface is namespaced from day one.
3. **Wiki adapter default path scoping** — confirm the app's current default `wiki/` directory is exactly what `wiki-fs` should scope to, or expose it as a constructor arg only (no filesystem default). Recommendation: no default; require an explicit absolute path from the embedder.
