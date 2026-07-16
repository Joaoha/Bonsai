import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PgQueryable } from './pool.js';

export interface Migration {
  name: string;
  sql: string;
}

// Resolve the on-disk `migrations/` directory shipped with the published
// package (sibling of `dist/`). At runtime `import.meta.url` points at
// `dist/migrations.js`, so we go up one level.
function migrationsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'migrations');
}

/** Load all `*.sql` files under `migrations/` in ascending filename order. */
export async function loadMigrations(dir: string = migrationsDir()): Promise<Migration[]> {
  const entries = await readdir(dir);
  const sqlFiles = entries.filter((f) => f.endsWith('.sql')).sort();
  const out: Migration[] = [];
  for (const name of sqlFiles) {
    const sql = await readFile(join(dir, name), 'utf8');
    out.push({ name, sql });
  }
  return out;
}

/**
 * Apply all bundled migrations idempotently. Every migration file uses
 * `IF NOT EXISTS` so re-applying is a no-op. A `bonsai_schema_migrations`
 * table records which files have been applied, letting embedders inspect
 * schema state without re-parsing SQL.
 */
export async function applyMigrations(
  pool: PgQueryable,
  dir?: string,
): Promise<{ applied: string[]; skipped: string[] }> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS bonsai_schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
  const migrations = await loadMigrations(dir);
  const { rows } = await pool.query<{ name: string }>(
    `SELECT name FROM bonsai_schema_migrations`,
  );
  const alreadyApplied = new Set(rows.map((r) => r.name));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const m of migrations) {
    if (alreadyApplied.has(m.name)) {
      skipped.push(m.name);
      continue;
    }
    await pool.query(m.sql);
    await pool.query(
      `INSERT INTO bonsai_schema_migrations (name) VALUES ($1)
       ON CONFLICT (name) DO NOTHING`,
      [m.name],
    );
    applied.push(m.name);
  }
  return { applied, skipped };
}
