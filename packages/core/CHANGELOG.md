# @bonsai/core

## 0.1.0

### Minor Changes

- Bonsai 0.1.0 — first public release of the `@bonsai/*` packages.

  - `@bonsai/core`: framework-agnostic domain (branchable message trees, ContextPacket assembly, merge, distill, retrieve) with pluggable `Storage`, `LLMProvider`, `WikiStore`, and `Retriever` interfaces.
  - `@bonsai/storage-postgres`: Postgres implementation of `Storage` (migrations, repos, Postgres FTS retriever).
  - `@bonsai/provider-openai`: OpenAI-compatible `LLMProvider` adapter (streaming, model discovery, deterministic error surface).
  - `@bonsai/wiki-fs`: Markdown-on-disk `WikiStore` with slug validation and path-escape guard.
  - `@bonsai/server`: thin HTTP surface over the `Bonsai` façade for embedders that want a ready-to-mount API.

    0.x stability policy: minor bumps may include breaking changes until 1.0. See the top-level release notes for the full deferred/shipped list and the ContextPacket / branch / merge / distill overview.
