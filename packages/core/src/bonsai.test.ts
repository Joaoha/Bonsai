import { describe, it, expect } from 'vitest';
import { Bonsai } from './bonsai.js';
import { createInMemoryStorage } from './__testutil__/in-memory-storage.js';
import { InMemoryLLMProvider } from './__testutil__/in-memory-llm-provider.js';
import { InMemoryWikiStore } from './__testutil__/in-memory-wiki-store.js';
import { SystemClock } from './domain/clock.js';

function makeBonsai() {
  const storage = createInMemoryStorage();
  const provider = new InMemoryLLMProvider();
  const wiki = new InMemoryWikiStore();
  const b = new Bonsai({ storage, provider, wiki, clock: new SystemClock() });
  return { b, storage, provider, wiki };
}

describe('Bonsai façade', () => {
  it('createProject creates a project with a main branch', async () => {
    const { b, storage } = makeBonsai();
    const p = await b.createProject({ name: 'Demo' });
    expect(p.name).toBe('Demo');
    const branches = await storage.branches.findByProjectId(p.id);
    expect(branches.some((br) => br.name === 'main')).toBe(true);
  });

  it('createBranch off main returns a branch with fork point set', async () => {
    const { b, storage } = makeBonsai();
    const p = await b.createProject({ name: 'Demo' });
    const mainList = await storage.branches.findByProjectId(p.id);
    const main = mainList.find((br) => br.name === 'main')!;
    // Seed main with a message so we have a fork point candidate.
    const m = await storage.messages.create({
      branchId: main.id,
      role: 'user',
      content: 'seed',
      sequence: 1,
      parentIds: [],
    });
    const child = await b.createBranch({ fromBranchId: main.id, forkPoint: m.id, name: 'feature' });
    expect(child.parentBranchId).toBe(main.id);
    expect(child.forkPoint).toBe(m.id);
    expect(child.name).toBe('feature');
  });

  it('assembleContext returns a packet with ancestry messages', async () => {
    const { b, storage } = makeBonsai();
    const p = await b.createProject({ name: 'Demo' });
    const main = (await storage.branches.findByProjectId(p.id)).find((br) => br.name === 'main')!;
    const m1 = await storage.messages.create({
      branchId: main.id,
      role: 'user',
      content: 'hello',
      sequence: 1,
      parentIds: [],
    });
    const child = await b.createBranch({ fromBranchId: main.id, forkPoint: m1.id });
    await storage.messages.create({
      branchId: child.id,
      role: 'user',
      content: 'child-msg',
      sequence: 1,
      parentIds: [],
    });
    const packet = await b.assembleContext(child.id, { tokenBudget: 4000 });
    expect(packet.messages.some((m) => m.content === 'hello')).toBe(true);
    expect(packet.messages.some((m) => m.content === 'child-msg')).toBe(true);
  });

  it('chat yields at least one chunk from the provider', async () => {
    const { b, storage, provider } = makeBonsai();
    provider.setScript('assistant-reply');
    const p = await b.createProject({ name: 'Demo' });
    const main = (await storage.branches.findByProjectId(p.id)).find((br) => br.name === 'main')!;
    const chunks: string[] = [];
    for await (const chunk of b.chat(main.id, 'hi there')) {
      chunks.push(chunk.content);
    }
    expect(chunks.some((c) => c.includes('assistant-reply'))).toBe(true);
  });

  it('merge calls the editSummary hook and applies a merge commit', async () => {
    const { b, storage, provider } = makeBonsai();
    provider.setScript('draft summary');
    const p = await b.createProject({ name: 'Demo' });
    const branches0 = await storage.branches.findByProjectId(p.id);
    const main = branches0.find((br) => br.name === 'main')!;
    await storage.messages.create({
      branchId: main.id,
      role: 'user',
      content: 'main-msg',
      sequence: 1,
      parentIds: [],
    });
    const child = await b.createBranch({ fromBranchId: main.id, forkPoint: null });
    await storage.messages.create({
      branchId: child.id,
      role: 'user',
      content: 'child-msg',
      sequence: 1,
      parentIds: [],
    });
    let calledWith = '';
    const result = await b.merge({
      sourceBranchId: child.id,
      targetBranchId: main.id,
      editSummary: (draft) => {
        calledWith = draft;
        return 'edited-summary';
      },
    });
    expect(calledWith).toContain('draft summary');
    expect(result.appliedMessage.isMergeCommit).toBe(true);
    expect(result.appliedMessage.content).toBe('edited-summary');
    expect(result.merge.status).toBe('applied');
  });

  it('distill writes a wiki page and returns a Distillation', async () => {
    const { b, storage, wiki } = makeBonsai();
    const p = await b.createProject({ name: 'Demo' });
    const main = (await storage.branches.findByProjectId(p.id)).find((br) => br.name === 'main')!;
    await storage.messages.create({
      branchId: main.id,
      role: 'user',
      content: 'seed',
      sequence: 1,
      parentIds: [],
    });
    const d = await b.distill({ branchId: main.id });
    expect(d.wikiPageSlug.length).toBeGreaterThan(0);
    expect(wiki.pages.size).toBe(1);
  });
});
