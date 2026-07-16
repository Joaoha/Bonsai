import { describe, it, expect } from 'vitest';
import { resolveTrace } from './trace.js';

describe('resolveTrace', () => {
  it('returns a trace with wiki + branch + merge + transcript when all inputs present', () => {
    const trace = resolveTrace({
      distillation: {
        id: 'd1',
        branchId: null,
        mergeId: 'mg1',
        wikiPageSlug: 'foo',
        wikiPageTitle: 'Foo',
        createdAt: new Date(0),
      },
      merge: {
        id: 'mg1',
        sourceBranchId: 's',
        targetBranchId: 't',
        status: 'applied',
        summary: 'sum',
        appliedMessageId: 'msg-x',
        createdAt: new Date(0),
        appliedAt: new Date(0),
      },
      sourceBranch: {
        id: 's',
        projectId: 'p',
        name: 'feature',
        parentBranchId: null,
        forkPoint: null,
        lane: 1,
        autoNamed: false,
        mergedToParent: true,
        createdAt: new Date(0),
      },
      sourceMessages: [
        {
          id: 'm1',
          branchId: 's',
          role: 'user',
          content: 'hi',
          sequence: 1,
          parentIds: [],
          sourceMessageId: null,
          isMergeCommit: false,
          mergedBranchName: null,
          mergedBranchId: null,
          mergedSourceLastMessageId: null,
          provider: null,
          adapterMetadata: null,
          createdAt: new Date(0),
        },
      ],
    });
    expect(trace.wikiSlug).toBe('foo');
    expect(trace.merge?.sourceBranchName).toBe('feature');
    expect(trace.branch?.name).toBe('feature');
    expect(trace.transcript).toHaveLength(1);
  });
});
