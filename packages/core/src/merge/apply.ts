import type { Id } from '../domain/ids.js';
import type { Branch } from '../domain/branch.js';
import type { Message } from '../domain/message.js';
import { BonsaiInvariantError } from '../domain/errors.js';

export interface BuildMergeCommitInput {
  sourceBranchId: Id;
  sourceBranchName: string;
  targetBranch: Branch;
  targetLastMessage: Message;
  sourceLastMessage: Message;
  summary: string;
}

export type NewMessage = Omit<Message, 'id' | 'createdAt'>;

/**
 * Pure builder for a merge-commit message. The caller (façade) is
 * responsible for assigning id + createdAt via the injected factories and
 * persisting the row.
 */
export function buildMergeCommitMessage(input: BuildMergeCommitInput): NewMessage {
  if (input.targetLastMessage.branchId !== input.targetBranch.id) {
    throw new BonsaiInvariantError(
      `targetLastMessage.branchId (${input.targetLastMessage.branchId}) must match targetBranch.id (${input.targetBranch.id})`,
    );
  }
  if (input.sourceLastMessage.branchId !== input.sourceBranchId) {
    throw new BonsaiInvariantError(
      `sourceLastMessage.branchId (${input.sourceLastMessage.branchId}) must match sourceBranchId (${input.sourceBranchId})`,
    );
  }
  return {
    branchId: input.targetBranch.id,
    role: 'assistant',
    content: input.summary,
    sequence: input.targetLastMessage.sequence + 1,
    parentIds: [input.targetLastMessage.id, input.sourceLastMessage.id],
    sourceMessageId: null,
    isMergeCommit: true,
    mergedBranchName: input.sourceBranchName,
    mergedBranchId: input.sourceBranchId,
    mergedSourceLastMessageId: input.sourceLastMessage.id,
    provider: null,
    adapterMetadata: null,
  };
}
