import type { Id } from './ids.js';
import { BonsaiInvariantError } from './errors.js';

export type MergeStatus = 'proposed' | 'summarized' | 'applied';

export interface Merge {
  id: Id;
  sourceBranchId: Id;
  targetBranchId: Id;
  status: MergeStatus;
  summary: string | null;
  appliedMessageId: Id | null;
  createdAt: Date;
  appliedAt: Date | null;
}

const ALLOWED: ReadonlyArray<readonly [MergeStatus, MergeStatus]> = [
  ['proposed', 'summarized'],
  ['summarized', 'applied'],
];

export function canTransition(from: MergeStatus, to: MergeStatus): boolean {
  return ALLOWED.some(([f, t]) => f === from && t === to);
}

export type MergeTransition =
  | { to: 'summarized'; summary: string }
  | { to: 'applied'; appliedMessageId: Id; appliedAt: Date };

/**
 * Pure state advance. Validates transition; throws BonsaiInvariantError on
 * invalid transitions. Returns a new Merge; does not mutate.
 */
export function nextMergeState(current: Merge, transition: MergeTransition): Merge {
  if (!canTransition(current.status, transition.to)) {
    throw new BonsaiInvariantError(
      `invalid merge transition: ${current.status} -> ${transition.to}`,
    );
  }
  if (transition.to === 'summarized') {
    return { ...current, status: 'summarized', summary: transition.summary };
  }
  return {
    ...current,
    status: 'applied',
    appliedMessageId: transition.appliedMessageId,
    appliedAt: transition.appliedAt,
  };
}
