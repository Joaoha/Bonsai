import type { Storage, IdFactory, Clock } from '@bonsai/core';
import { SystemClock } from '@bonsai/core';
import type { PgQueryable } from './pool.js';
import { defaultIdFactory } from './ids.js';
import { createProjectRepository } from './repositories/projects.js';
import { createBranchRepository } from './repositories/branches.js';
import { createMessageRepository } from './repositories/messages.js';
import { createMergeRepository } from './repositories/merges.js';
import { createDistillationRepository } from './repositories/distillations.js';
import { createWikiPageRepository } from './repositories/wiki-pages.js';

export interface CreatePostgresStorageOptions {
  pool: PgQueryable;
  ids?: IdFactory;
  clock?: Clock;
}

/**
 * Compose a `@bonsai/core` Storage backed by Postgres. Bring your own
 * `pg.Pool` (or any object satisfying PgQueryable). The pool is used
 * lazily — no queries are issued during construction.
 */
export function createPostgresStorage(opts: CreatePostgresStorageOptions): Storage {
  const ids = opts.ids ?? defaultIdFactory;
  const clock = opts.clock ?? new SystemClock();
  const pool = opts.pool;
  return {
    projects: createProjectRepository(pool, ids, clock),
    branches: createBranchRepository(pool, ids, clock),
    messages: createMessageRepository(pool, ids, clock),
    merges: createMergeRepository(pool, ids, clock),
    distillations: createDistillationRepository(pool, ids, clock),
    wikiPages: createWikiPageRepository(pool, ids, clock),
  };
}
