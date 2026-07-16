import type { Id } from '../domain/ids.js';
import type { Merge } from '../domain/merge.js';
import { nextMergeState } from '../domain/merge.js';

export type MergeEvent =
  | { type: 'summarize'; summary: string }
  | { type: 'apply'; appliedMessageId: Id; appliedAt: Date };

export function advanceMerge(merge: Merge, event: MergeEvent): Merge {
  if (event.type === 'summarize') {
    return nextMergeState(merge, { to: 'summarized', summary: event.summary });
  }
  return nextMergeState(merge, {
    to: 'applied',
    appliedMessageId: event.appliedMessageId,
    appliedAt: event.appliedAt,
  });
}
