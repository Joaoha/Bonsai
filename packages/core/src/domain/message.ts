import type { Id } from './ids.js';
import { BonsaiInvariantError } from './errors.js';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: Id;
  branchId: Id;
  role: MessageRole;
  content: string;
  sequence: number;
  parentIds: Id[];
  sourceMessageId: Id | null;
  isMergeCommit: boolean;
  mergedBranchName: string | null;
  mergedBranchId: Id | null;
  mergedSourceLastMessageId: Id | null;
  provider: string | null;
  adapterMetadata: string | null;
  createdAt: Date;
}

/**
 * Sequences within a single branch must be strictly increasing.
 * Cross-branch ordering is undefined here — handled by ancestry walk.
 */
export function assertSequenceMonotonic(messages: Message[]): void {
  const perBranch = new Map<Id, number>();
  for (const m of messages) {
    const prev = perBranch.get(m.branchId);
    if (prev !== undefined && m.sequence <= prev) {
      throw new BonsaiInvariantError(
        `messages on branch ${m.branchId} are not strictly increasing (saw ${prev} then ${m.sequence})`,
      );
    }
    perBranch.set(m.branchId, m.sequence);
  }
}
