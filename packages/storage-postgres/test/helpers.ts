import { Pool } from 'pg';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyMigrations } from '../src/migrations.js';

export const DATABASE_URL = process.env.BONSAI_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
export const HAS_DB = Boolean(DATABASE_URL);

const migrationsRoot = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'migrations',
);

let cachedPool: Pool | null = null;

export async function getTestPool(): Promise<Pool> {
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set — cannot open test pool');
  if (cachedPool) return cachedPool;
  cachedPool = new Pool({ connectionString: DATABASE_URL, max: 4 });
  return cachedPool;
}

export async function resetSchema(pool: Pool): Promise<void> {
  await pool.query(`DROP TABLE IF EXISTS
    bonsai_distillations,
    bonsai_merges,
    bonsai_messages,
    bonsai_branches,
    bonsai_wiki_pages,
    bonsai_projects,
    bonsai_schema_migrations CASCADE`);
  await applyMigrations(pool, migrationsRoot);
}

export async function closeTestPool(): Promise<void> {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
