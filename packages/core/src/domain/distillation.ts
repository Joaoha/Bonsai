import type { Id } from './ids.js';
import { BonsaiInvariantError } from './errors.js';

export interface Distillation {
  id: Id;
  branchId: Id | null;
  mergeId: Id | null;
  wikiPageSlug: string;
  wikiPageTitle: string;
  createdAt: Date;
}

/**
 * A distillation is sourced from exactly one of: a branch OR a merge.
 * Both-null or both-set is invalid.
 */
export function assertDistillationSource(d: Distillation): void {
  const hasBranch = d.branchId !== null;
  const hasMerge = d.mergeId !== null;
  if (hasBranch === hasMerge) {
    throw new BonsaiInvariantError(
      `distillation ${d.id} must have exactly one of branchId/mergeId set`,
    );
  }
}
