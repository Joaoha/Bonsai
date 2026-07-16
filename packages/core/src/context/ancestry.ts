import type { Id } from '../domain/ids.js';
import type { Branch } from '../domain/branch.js';
import type { Message } from '../domain/message.js';
import type { AssembleAncestryMessage } from './assemble.js';

export interface AncestryWalkStep {
  branchId: Id;
  branchName: string;
  messages: Message[];
}

/**
 * Walk the ancestor chain of `startBranchId` toward the root, truncating each
 * parent branch's messages at the fork point. Returns child→root order.
 * Skips already-visited branches (cycle protection).
 */
export function walkAncestry(
  startBranchId: Id,
  branches: Map<Id, Branch>,
  messagesByBranch: Map<Id, Message[]>,
): AncestryWalkStep[] {
  const out: AncestryWalkStep[] = [];
  const visited = new Set<Id>();
  let currentId: Id | null = startBranchId;
  let forkPointFromChild: Id | null = null;

  while (currentId !== null) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const branch = branches.get(currentId);
    if (!branch) break;
    const branchMessages = messagesByBranch.get(currentId) ?? [];

    let effectiveMessages = branchMessages;
    if (forkPointFromChild !== null) {
      const forkMsg = branchMessages.find((m) => m.id === forkPointFromChild);
      if (forkMsg) {
        const forkSeq = forkMsg.sequence;
        effectiveMessages = branchMessages.filter((m) => m.sequence <= forkSeq);
      }
    }

    out.push({
      branchId: branch.id,
      branchName: branch.name,
      messages: effectiveMessages,
    });

    forkPointFromChild = branch.forkPoint;
    currentId = branch.parentBranchId;
  }

  return out;
}

/**
 * Flatten a walk into the ancestryMessages shape expected by assembleContext.
 * Emits messages in root→child order so `truncateFromOldest` drops the oldest.
 */
export function flattenAncestryToContextMessages(
  walk: AncestryWalkStep[],
): AssembleAncestryMessage[] {
  const out: AssembleAncestryMessage[] = [];
  for (let i = walk.length - 1; i >= 0; i--) {
    const step = walk[i];
    if (!step) continue;
    for (const m of step.messages) {
      const entry: AssembleAncestryMessage = {
        id: m.id,
        role: m.role,
        content: m.content,
        sequence: m.sequence,
        branchId: step.branchId,
        branchName: step.branchName,
        isMergeCommit: m.isMergeCommit,
      };
      if (m.mergedBranchName !== null) {
        entry.mergedBranchName = m.mergedBranchName;
      }
      out.push(entry);
    }
  }
  return out;
}
