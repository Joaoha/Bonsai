---
title: Examples
description: Runnable examples from the bonsai-core monorepo.
---

Examples live under [`examples/`](https://github.com/bonsai-labs/bonsai-core/tree/main/examples) in the monorepo. They double as CI smoke tests — every assertion in an example runs on every push.

## `examples/minimal-node`

Headless end-to-end demo of the extracted packages. Walks the full loop:

```
create project → chat on main → branch → chat in branch
  → merge summary → distill → retrieve → audit trace
```

- Uses `@bonsai/storage-postgres` against a temp Postgres (env-provided URL or testcontainers).
- Uses `@bonsai/wiki-fs` against a fresh temp directory.
- Uses a deterministic in-process `FakeProvider` by default. Set `BONSAI_DEMO_USE_REAL_OPENAI=1` (plus `OPENAI_API_KEY`) to swap in `@bonsai/provider-openai`.

See the [Quickstart](/quickstart/) for a paste-and-run walkthrough that mirrors this demo.

Repo path: [`examples/minimal-node`](https://github.com/bonsai-labs/bonsai-core/tree/main/examples/minimal-node).
