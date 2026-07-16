import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMigrations } from './migrations.js';

const MIGRATIONS_DIR = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '..',
  'migrations',
);

describe('loadMigrations', () => {
  it('loads bundled SQL files in ascending order', async () => {
    const migs = await loadMigrations(MIGRATIONS_DIR);
    expect(migs.length).toBeGreaterThan(0);
    const names = migs.map((m) => m.name);
    expect(names).toEqual([...names].sort());
    expect(names[0]).toBe('0001_init.sql');
    expect(migs[0]?.sql).toContain('bonsai_projects');
    expect(migs[0]?.sql).toContain('bonsai_wiki_pages');
    expect(migs[0]?.sql).toContain('tsvector');
  });
});
