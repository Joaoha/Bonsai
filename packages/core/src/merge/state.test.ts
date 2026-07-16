import { describe, it, expect } from 'vitest';
import { advanceMerge } from './state.js';
import type { Merge } from '../domain/merge.js';
import { BonsaiInvariantError } from '../domain/errors.js';

const base: Merge = {
  id: 'mg1',
  sourceBranchId: 's',
  targetBranchId: 't',
  status: 'proposed',
  summary: null,
  appliedMessageId: null,
  createdAt: new Date(0),
  appliedAt: null,
};

describe('advanceMerge', () => {
  it('walks proposed -> summarized -> applied', () => {
    const summarized = advanceMerge(base, { type: 'summarize', summary: 'sum' });
    expect(summarized.status).toBe('summarized');
    expect(summarized.summary).toBe('sum');

    const applied = advanceMerge(summarized, {
      type: 'apply',
      appliedMessageId: 'msg1',
      appliedAt: new Date(1),
    });
    expect(applied.status).toBe('applied');
    expect(applied.appliedMessageId).toBe('msg1');
  });

  it('throws on invalid transitions', () => {
    expect(() =>
      advanceMerge(base, {
        type: 'apply',
        appliedMessageId: 'x',
        appliedAt: new Date(0),
      }),
    ).toThrow(BonsaiInvariantError);
    const summarized = advanceMerge(base, { type: 'summarize', summary: 's' });
    expect(() => advanceMerge(summarized, { type: 'summarize', summary: 'again' }))
      .toThrow(BonsaiInvariantError);
  });
});
