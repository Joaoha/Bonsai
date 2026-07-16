# bonsai-core

Public monorepo for the `@bonsai/*` packages: framework-agnostic Bonsai primitives (tree/branch/merge/distill, ContextPacket assembly) plus pluggable Storage / LLMProvider / WikiStore / Retriever adapters.

## Status

Phase 1 scaffold. No package is published yet.

## Layout

```
packages/
  core/              # @bonsai/core — framework-agnostic domain (Storage/LLMProvider/WikiStore/Retriever interfaces)
  storage-postgres/  # @bonsai/storage-postgres — Postgres migrations + repositories + FTS retriever
  provider-openai/   # @bonsai/provider-openai — OpenAI-compatible chat/streaming provider
  wiki-fs/           # @bonsai/wiki-fs — Markdown-on-disk WikiStore
  server/            # @bonsai/server — thin optional HTTP layer
examples/            # example embedders (added in later phases)
```

## Prerequisites

- Node `>=20.11.0`
- pnpm `9.15.4` (pinned via `packageManager`)

## Commands

```
pnpm install              # install workspace dependencies
pnpm typecheck            # tsc -b across all packages via project references
pnpm build                # build all packages that define a build script
pnpm test                 # run tests across the workspace
pnpm lint                 # lint across the workspace
pnpm changeset            # add a changeset entry for a release
pnpm changeset:status     # show pending changesets
```

## References

- Extraction plan and boundary map: [EXTRACTION_PLAN.md](./EXTRACTION_PLAN.md)
- Library conversion tracking issue: [BONA-217](/BONA/issues/BONA-217)
- Phase 1 parent issue: [BONA-226](/BONA/issues/BONA-226)
