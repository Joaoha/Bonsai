import { describe, it, expect } from 'vitest';
import { buildMergeCommitMessage } from './apply.js';
import type { Branch } from '../domain/branch.js';
import type { Message } from '../domain/message.js';
import { BonsaiInvariantError } from '../domain/errors.js';

const targetBranch: Branch = {
  id: 't',
  projectId: 'p',
  name: 'main',
  parentBranchId: null,
  forkPoint: null,
  lane: 0,
  autoNamed: false,
  mergedToParent: false,
  createdAt: new Date(0),
};

function mkMsg(id: string, branchId: string, seq: number): Message {
  return {
    id,
    branchId,
    role: 'user',
    content: 'x',
    sequence: seq,
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

describe('buildMergeCommitMessage', () => {
  it('increments sequence, links parents, sets merge tracking fields', () => {
    const t = mkMsg('t1', 't', 5);
    const s = mkMsg('s1', 's', 3);
    const commit = buildMergeCommitMessage({
      sourceBranchId: 's',
      sourceBranchName: 'feature',
      targetBranch,
      targetLastMessage: t,
      sourceLastMessage: s,
      summary: 'sum',
    });
    expect(commit.sequence).toBe(6);
    expect(commit.parentIds).toEqual(['t1', 's1']);
    expect(commit.isMergeCommit).toBe(true);
    expect(commit.mergedBranchName).toBe('feature');
    expect(commit.mergedBranchId).toBe('s');
    expect(commit.mergedSourceLastMessageId).toBe('s1');
    expect(commit.branchId).toBe('t');
  });

  it('throws when targetLastMessage.branchId does not match target', () => {
    expect(() =>
      buildMergeCommitMessage({
        sourceBranchId: 's',
        sourceBranchName: 'feature',
        targetBranch,
        targetLastMessage: mkMsg('t1', 'wrong', 1),
        sourceLastMessage: mkMsg('s1', 's', 1),
        summary: 'sum',
      }),
    ).toThrow(BonsaiInvariantError);
  });

  it('throws when sourceLastMessage.branchId does not match source', () => {
    expect(() =>
      buildMergeCommitMessage({
        sourceBranchId: 's',
        sourceBranchName: 'feature',
        targetBranch,
        targetLastMessage: mkMsg('t1', 't', 1),
        sourceLastMessage: mkMsg('s1', 'wrong', 1),
        summary: 'sum',
      }),
    ).toThrow(BonsaiInvariantError);
  });
});
