# @bonsai-examples/minimal-node

Headless end-to-end demo of the published `@bonsai/*` packages. Wires
`@bonsai/core` to `@bonsai/storage-postgres`, `@bonsai/wiki-fs`, and (by
default) a deterministic in-process `FakeProvider`, then walks the full loop:

```
create project → chat on main → branch → chat in branch
  → merge (with editable summary) → distill → retrieve → audit trace
```

Every step is asserted with `node:assert`, so the demo doubles as a CI smoke
test for the extracted packages.

## Requirements

- Node.js ≥ 20.11
- Either a reachable Postgres URL exported as `BONSAI_DEMO_DATABASE_URL`, or a
  running Docker daemon (the demo will spin up an ephemeral Postgres via
  `@testcontainers/postgresql`).

## Run

```
pnpm install
pnpm --filter @bonsai-examples/minimal-node demo
```

Environment overrides:

| Var | Effect |
| --- | --- |
| `BONSAI_DEMO_DATABASE_URL` | Use this Postgres URL instead of testcontainers. |
| `BONSAI_DEMO_USE_REAL_OPENAI=1` | Swap the FakeProvider for `@bonsai/provider-openai`. Requires `OPENAI_API_KEY`. |
| `OPENAI_BASE_URL` | Override the OpenAI-compatible base URL (real-provider mode). |
| `OPENAI_MODEL` | Override the model (real-provider mode). Defaults to `gpt-4o-mini`. |

The real-provider variant is opt-in because it costs money and is
non-deterministic; CI runs the default (mocked) path.

## What it asserts

- `createProject` seeds exactly one `main` branch.
- `chat` on `main` writes a user + assistant message pair.
- `createBranch` records the fork point and parent branch.
- `chat` on a branch does not leak into `main` (branch isolation).
- `merge` transitions `proposed → summarized → applied`, invokes the
  `editSummary` hook, persists the edited summary, appends a merge-commit
  message on the target, and flips the source branch's `mergedToParent`.
- `distill(mergeId)` writes a Markdown page under `<wikiRoot>/pages/` with a
  frontmatter block (`title`, `mergeId`, `sources`) and inserts the row into
  `bonsai_wiki_pages`.
- `PostgresFtsRetriever.search` surfaces the freshly distilled page.
- `resolveTrace(slug)` returns a non-null trace for the wiki page.

Wiki output and any container are cleaned up on exit; the demo returns a
non-zero exit code on any assertion failure.
