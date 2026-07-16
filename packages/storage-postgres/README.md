# @bonsai/storage-postgres

Postgres adapter for [@bonsai/core](../core). Ships:

- **SQL migrations** — plain `.sql` files under `migrations/`, applied via any
  runner. A lightweight `applyMigrations(pool)` helper is exported for tests
  and simple deployments.
- **Repositories** for Projects, Branches, Messages, Merges, Distillations,
  and Wiki Pages — assembled into a single `Storage` via
  `createPostgresStorage`.
- **`PostgresFtsRetriever`** — a wiki-page retriever backed by Postgres
  full-text search (`tsvector` + `ts_rank` + `ts_headline`). Retriever is
  bound to one `projectId`.

## Installation

```bash
pnpm add @bonsai/storage-postgres @bonsai/core pg
```

`pg` is declared as an optional peer dependency; bring the version you want
to use.

## Usage

```ts
import { Pool } from 'pg';
import {
  createPostgresStorage,
  applyMigrations,
  PostgresFtsRetriever,
} from '@bonsai/storage-postgres';
import { Bonsai } from '@bonsai/core';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
await applyMigrations(pool);

const storage = createPostgresStorage({ pool });
const retriever = new PostgresFtsRetriever({ pool, projectId });

const bonsai = new Bonsai({ storage, provider, wiki, retriever });
```

## Integration tests

Tests use a real Postgres instance. Set `BONSAI_TEST_DATABASE_URL` (or
`DATABASE_URL`) and run:

```bash
pnpm --filter @bonsai/storage-postgres test
```

When neither variable is set, integration tests are skipped so CI on
non-Postgres jobs still passes. GitHub Actions provisions a `postgres:16`
service container so the real database path is exercised on every PR.

## Boundary

This package depends on `@bonsai/core` only. It never imports from other
adapter packages, and `@bonsai/core` never imports from it. That direction
is enforced by ESLint and dependency-cruiser at the monorepo root.
