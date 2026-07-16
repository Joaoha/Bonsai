import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import { createPostgresStorage, PostgresFtsRetriever } from '../src/index.js';
import { HAS_DB, getTestPool, resetSchema, closeTestPool } from './helpers.js';
import type { Storage, IdFactory } from '@bonsai/core';

const d = HAS_DB ? describe : describe.skip;

// Deterministic id factory so assertions stay stable.
function seqIds(prefix = 'id'): IdFactory {
  let n = 0;
  return { newId: () => `${prefix}-${++n}` };
}

const fixedClock = { now: () => new Date('2026-01-01T00:00:00.000Z') };

d('@bonsai/storage-postgres — integration', () => {
  let pool: Pool;
  let storage: Storage;

  beforeAll(async () => {
    pool = await getTestPool();
    await resetSchema(pool);
  });

  afterAll(async () => {
    await closeTestPool();
  });

  beforeEach(async () => {
    await resetSchema(pool);
    storage = createPostgresStorage({ pool, ids: seqIds('t'), clock: fixedClock });
  });

  it('creates and reads projects', async () => {
    const p = await storage.projects.create({ name: 'demo', description: 'x' });
    expect(p.id).toBe('t-1');
    expect(p.name).toBe('demo');
    expect(p.description).toBe('x');
    expect(p.createdAt).toEqual(fixedClock.now());
    const roundTrip = await storage.projects.findById(p.id);
    expect(roundTrip).toEqual(p);
    expect(await storage.projects.findById('missing')).toBeNull();
  });

  it('enforces branch → project foreign key', async () => {
    await expect(
      storage.branches.create({
        projectId: 'ghost',
        name: 'main',
        parentBranchId: null,
        forkPoint: null,
        lane: 0,
        autoNamed: false,
      }),
    ).rejects.toThrow();
  });

  it('tracks branches, maxLane, and updates', async () => {
    const p = await storage.projects.create({ name: 'p' });
    const main = await storage.branches.create({
      projectId: p.id,
      name: 'main',
      parentBranchId: null,
      forkPoint: null,
      lane: 0,
      autoNamed: false,
    });
    const b1 = await storage.branches.create({
      projectId: p.id,
      name: 'explore',
      parentBranchId: main.id,
      forkPoint: null,
      lane: 1,
      autoNamed: true,
    });
    expect(await storage.branches.maxLane(p.id)).toBe(1);
    const all = await storage.branches.findByProjectId(p.id);
    expect(all.map((b) => b.name)).toEqual(['main', 'explore']);
    const patched = await storage.branches.update(b1.id, {
      name: 'ideas',
      mergedToParent: true,
    });
    expect(patched.name).toBe('ideas');
    expect(patched.mergedToParent).toBe(true);
    expect((await storage.branches.findById(b1.id))?.name).toBe('ideas');
  });

  it('preserves message ordering, parent_ids JSON, and unique (branch, sequence)', async () => {
    const p = await storage.projects.create({ name: 'p' });
    const main = await storage.branches.create({
      projectId: p.id,
      name: 'main',
      parentBranchId: null,
      forkPoint: null,
      lane: 0,
      autoNamed: false,
    });
    const m1 = await storage.messages.create({
      branchId: main.id,
      role: 'user',
      content: 'hi',
      sequence: 0,
      parentIds: [],
    });
    const m2 = await storage.messages.create({
      branchId: main.id,
      role: 'assistant',
      content: 'hello',
      sequence: 1,
      parentIds: [m1.id],
    });
    const list = await storage.messages.findByBranchId(main.id);
    expect(list.map((x) => x.id)).toEqual([m1.id, m2.id]);
    expect(list[1]?.parentIds).toEqual([m1.id]);
    const many = await storage.messages.findManyByIds([m2.id, m1.id]);
    expect(many.map((x) => x.sequence)).toEqual([0, 1]);
    expect((await storage.messages.lastByBranch(main.id))?.id).toBe(m2.id);
    await expect(
      storage.messages.create({
        branchId: main.id,
        role: 'user',
        content: 'dup',
        sequence: 1,
        parentIds: [],
      }),
    ).rejects.toThrow();
  });

  it('walks merge lifecycle and finds last merge commit', async () => {
    const p = await storage.projects.create({ name: 'p' });
    const main = await storage.branches.create({
      projectId: p.id, name: 'main', parentBranchId: null,
      forkPoint: null, lane: 0, autoNamed: false,
    });
    const feat = await storage.branches.create({
      projectId: p.id, name: 'feat', parentBranchId: main.id,
      forkPoint: null, lane: 1, autoNamed: true,
    });
    const merge = await storage.merges.create({
      sourceBranchId: feat.id,
      targetBranchId: main.id,
      status: 'proposed',
    });
    const summarized = await storage.merges.update(merge.id, {
      status: 'summarized',
      summary: 'the feat branch explored X',
    });
    expect(summarized.status).toBe('summarized');
    expect(summarized.summary).toBe('the feat branch explored X');
    const mergeCommit = await storage.messages.create({
      branchId: main.id,
      role: 'assistant',
      content: 'merged',
      sequence: 0,
      parentIds: [],
      isMergeCommit: true,
      mergedBranchName: 'feat',
      mergedBranchId: feat.id,
    });
    const applied = await storage.merges.update(merge.id, {
      status: 'applied',
      appliedMessageId: mergeCommit.id,
      appliedAt: fixedClock.now(),
    });
    expect(applied.status).toBe('applied');
    expect(applied.appliedMessageId).toBe(mergeCommit.id);
    const lastCommit = await storage.merges.lastMergeCommitBetween(feat.id, main.id);
    expect(lastCommit?.id).toBe(mergeCommit.id);
  });

  it('enforces distillation XOR invariant at the DB level', async () => {
    const p = await storage.projects.create({ name: 'p' });
    const main = await storage.branches.create({
      projectId: p.id, name: 'main', parentBranchId: null,
      forkPoint: null, lane: 0, autoNamed: false,
    });
    const good = await storage.distillations.create({
      branchId: main.id,
      mergeId: null,
      wikiPageSlug: 'demo',
      wikiPageTitle: 'Demo',
    });
    expect(good.branchId).toBe(main.id);
    expect(good.mergeId).toBeNull();
    await expect(
      storage.distillations.create({
        branchId: null,
        mergeId: null,
        wikiPageSlug: 'x',
        wikiPageTitle: 'X',
      }),
    ).rejects.toThrow();
  });

  it('upserts wiki pages and runs FTS search + retriever', async () => {
    const p = await storage.projects.create({ name: 'p' });
    await storage.wikiPages.upsert({
      projectId: p.id, slug: 'trees', title: 'Binary Trees',
      content: 'A binary tree is a hierarchical data structure with two children per node.',
    });
    await storage.wikiPages.upsert({
      projectId: p.id, slug: 'graphs', title: 'Graphs',
      content: 'Graphs are collections of nodes and edges used for network problems.',
    });
    const updated = await storage.wikiPages.upsert({
      projectId: p.id, slug: 'trees', title: 'Binary Trees',
      content: 'Updated: binary trees are recursive structures used to model hierarchies.',
    });
    const list = await storage.wikiPages.list(p.id);
    expect(list).toHaveLength(2);
    expect(list.find((w) => w.slug === 'trees')?.id).toBe(updated.id);

    const hits = await storage.wikiPages.search({
      projectId: p.id, keywords: 'hierarchies recursive', limit: 5,
    });
    expect(hits[0]?.slug).toBe('trees');
    expect(hits[0]?.score).toBeGreaterThan(0);

    const retriever = new PostgresFtsRetriever({ pool, projectId: p.id });
    const rHits = await retriever.search('hierarchies');
    expect(rHits[0]?.title).toBe('Binary Trees');
    expect(rHits[0]?.kind).toBe('wiki');
    expect(rHits[0]?.snippet).toContain('<mark>');
    expect(await retriever.search('   ')).toEqual([]);
  });

  it('scopes retriever hits to a single project', async () => {
    const a = await storage.projects.create({ name: 'a' });
    const b = await storage.projects.create({ name: 'b' });
    await storage.wikiPages.upsert({
      projectId: a.id, slug: 'x', title: 'Alpha topic',
      content: 'unique keyword: quokka lives here',
    });
    await storage.wikiPages.upsert({
      projectId: b.id, slug: 'x', title: 'Beta topic',
      content: 'unique keyword: quokka also lives here',
    });
    const rA = new PostgresFtsRetriever({ pool, projectId: a.id });
    const rB = new PostgresFtsRetriever({ pool, projectId: b.id });
    const hitsA = await rA.search('quokka');
    const hitsB = await rB.search('quokka');
    expect(hitsA).toHaveLength(1);
    expect(hitsB).toHaveLength(1);
    expect(hitsA[0]?.title).toBe('Alpha topic');
    expect(hitsB[0]?.title).toBe('Beta topic');
  });
});

if (!HAS_DB) {
  describe('@bonsai/storage-postgres — integration (skipped)', () => {
    it.skip('DATABASE_URL / BONSAI_TEST_DATABASE_URL not set', () => {});
  });
}
