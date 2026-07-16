import { describe, it, expect } from 'vitest';
import { walkAncestry } from './ancestry.js';
import type { Branch } from '../domain/branch.js';
import type { Message } from '../domain/message.js';

function mkBranch(overrides: Partial<Branch> & Pick<Branch, 'id' | 'name'>): Branch {
  return {
    projectId: 'p1',
    parentBranchId: null,
    forkPoint: null,
    lane: 0,
    autoNamed: false,
    mergedToParent: false,
    createdAt: new Date(0),
    ...overrides,
  };
}

function mkMsg(id: string, branchId: string, sequence: number): Message {
  return {
    id,
    branchId,
    role: 'user',
    content: id,
    sequence,
    parentIds: [],
    sourceMessageId: null,
    isMergeCommit: false,
    mergedBranchName: null,
    mergedBranchId: null,
    mergedSourceLastMessageId: null,
    provider: null,
    adapterMetadata: null,
    createdAt: new Date(0),
  };
}

describe('walkAncestry', () => {
  it('truncates parent messages at fork point and excludes parent messages past the fork', () => {
    const main = mkBranch({ id: 'main', name: 'main' });
    const child = mkBranch({
      id: 'child',
      name: 'feature',
      parentBranchId: 'main',
      forkPoint: 'm2',
    });
    const msgs = new Map<string, Message[]>();
    msgs.set('main', [
      mkMsg('m1', 'main', 1),
      mkMsg('m2', 'main', 2),
      mkMsg('m3', 'main', 3), // after fork — must NOT be included
    ]);
    msgs.set('child', [mkMsg('c1', 'child', 1)]);
    const walk = walkAncestry(
      'child',
      new Map([
        ['main', main],
        ['child', child],
      ]),
      msgs,
    );
    expect(walk.map((s) => s.branchId)).toEqual(['child', 'main']);
    const mainStep = walk[1]!;
    expect(mainStep.messages.map((m) => m.id)).toEqual(['m1', 'm2']);
  });

  it('sibling branches are never included when walking the other sibling', () => {
    const main = mkBranch({ id: 'main', name: 'main' });
    const a = mkBranch({
      id: 'a',
      name: 'a',
      parentBranchId: 'main',
      forkPoint: 'm1',
    });
    const b = mkBranch({
      id: 'b',
      name: 'b',
      parentBranchId: 'main',
      forkPoint: 'm1',
    });
    const msgs = new Map<string, Message[]>([
      ['main', [mkMsg('m1', 'main', 1)]],
      ['a', [mkMsg('a1', 'a', 1)]],
      ['b', [mkMsg('b1', 'b', 1)]],
    ]);
    const walk = walkAncestry(
      'a',
      new Map([
        ['main', main],
        ['a', a],
        ['b', b],
      ]),
      msgs,
    );
    const ids = walk.flatMap((s) => s.messages.map((m) => m.id));
    expect(ids).not.toContain('b1');
  });

  it('is safe against cycles', () => {
    const a = mkBranch({ id: 'a', name: 'a', parentBranchId: 'b' });
    const b = mkBranch({ id: 'b', name: 'b', parentBranchId: 'a' });
    const walk = walkAncestry(
      'a',
      new Map([
        ['a', a],
        ['b', b],
      ]),
      new Map(),
    );
    expect(walk.length).toBe(2);
  });
});
