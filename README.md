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
pnpm lint                 # ESLint (incl. `no-restricted-imports` boundary rules on packages/core)
pnpm depcruise            # dependency-cruiser — forbid core -> adapter imports
pnpm boundary:verify      # positive test: fixture must be rejected by lint + depcruise
pnpm publint              # publint --strict per package (release gate)
pnpm attw                 # arethetypeswrong per package (release gate, ESM-only profile)
pnpm release:gate         # build + publint + attw (run before publishing)
pnpm changeset            # add a changeset entry for a release
pnpm changeset:status     # show pending changesets
pnpm docs:dev             # run the docs site locally (Astro Starlight)
pnpm docs:build           # build the static docs site under docs/dist
pnpm docs:preview         # preview a built docs site
```

## Docs site

Public documentation lives under [`docs/`](./docs) as its own pnpm workspace package (`@bonsai/docs`, private), built with Astro Starlight. The API Reference is auto-generated from each package's `src/index.ts` via TypeDoc + `starlight-typedoc`. Several concept and recipe pages are still stubs.

## Boundary enforcement

`@bonsai/core` is framework- and adapter-agnostic by contract. Two layers defend that boundary:

- **ESLint `no-restricted-imports`** (scoped to `packages/core/**`) bans `react`, `react-dom`, `next/*`, `tailwindcss`, `pg`/`postgres`/`sqlite*`, `fs`/`node:fs`, `net`, node http clients, and provider SDKs.
- **dependency-cruiser** forbids `packages/core → packages/{storage-*, provider-*, wiki-fs, server}` (both by resolved path and by `@bonsai/*` module name).

`pnpm boundary:verify` runs both tools against intentional violation fixtures under `packages/core/src/__fixtures__/` and fails if either tool accepts them. CI runs it on every push/PR.

## References

- Extraction plan and boundary map: [EXTRACTION_PLAN.md](./EXTRACTION_PLAN.md)

## License

[MIT](./LICENSE)
