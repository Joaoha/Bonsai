import type { Id } from './ids.js';
import { BonsaiInvariantError } from './errors.js';

export interface Branch {
  id: Id;
  projectId: Id;
  name: string;
  parentBranchId: Id | null;
  forkPoint: Id | null;
  lane: number;
  autoNamed: boolean;
  mergedToParent: boolean;
  createdAt: Date;
}

/**
 * Pure invariant check. Ensures parent-branch/fork-point consistency:
 *  - The main branch has no parent and no fork point.
 *  - A non-main branch must have both parent+fork set, or neither
 *    (a rootless orphan is legal for import scenarios; the invariant
 *    only rejects half-set state).
 */
export function assertForkPointConsistency(branch: Branch): void {
  if (branch.name === 'main') {
    if (branch.parentBranchId !== null || branch.forkPoint !== null) {
      throw new BonsaiInvariantError(
        `main branch must have parentBranchId=null and forkPoint=null (branch ${branch.id})`,
      );
    }
    return;
  }
  const hasParent = branch.parentBranchId !== null;
  const hasFork = branch.forkPoint !== null;
  if (hasParent !== hasFork) {
    throw new BonsaiInvariantError(
      `branch ${branch.id} has inconsistent fork state (parent=${String(branch.parentBranchId)}, fork=${String(branch.forkPoint)})`,
    );
  }
}
