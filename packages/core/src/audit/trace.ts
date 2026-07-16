import type { Id } from '../domain/ids.js';
import type { Branch } from '../domain/branch.js';
import type { Message } from '../domain/message.js';
import type { Merge } from '../domain/merge.js';
import type { Distillation } from '../domain/distillation.js';

export interface AuditTraceTranscriptEntry {
  messageId: Id;
  role: string;
  content: string;
}

export interface AuditTraceMerge {
  id: Id;
  sourceBranchName: string;
  targetBranchName?: string;
}

export interface AuditTraceBranch {
  id: Id;
  name: string;
}

export interface AuditTrace {
  wikiSlug: string;
  wikiTitle: string;
  merge?: AuditTraceMerge;
  branch?: AuditTraceBranch;
  transcript: AuditTraceTranscriptEntry[];
}

export interface ResolveTraceInput {
  distillation: Distillation;
  merge?: Merge | null;
  sourceBranch?: Branch | null;
  targetBranch?: Branch | null;
  sourceMessages?: Message[];
}

/**
 * Pure trace resolver: assemble the wiki ↔ merge ↔ branch ↔ transcript view.
 * The adapter is responsible for fetching the inputs; this function only
 * arranges them into the AuditTrace shape.
 */
export function resolveTrace(input: ResolveTraceInput): AuditTrace {
  const trace: AuditTrace = {
    wikiSlug: input.distillation.wikiPageSlug,
    wikiTitle: input.distillation.wikiPageTitle,
    transcript: (input.sourceMessages ?? []).map((m) => ({
      messageId: m.id,
      role: m.role,
      content: m.content,
    })),
  };
  if (input.merge && input.sourceBranch) {
    const merge: AuditTraceMerge = {
      id: input.merge.id,
      sourceBranchName: input.sourceBranch.name,
    };
    if (input.targetBranch) merge.targetBranchName = input.targetBranch.name;
    trace.merge = merge;
  }
  if (input.sourceBranch) {
    trace.branch = { id: input.sourceBranch.id, name: input.sourceBranch.name };
  }
  return trace;
}

/**
 * Adapter interface for wiki-slug → AuditTrace lookup. The concrete
 * implementation lives in the host app (needs Storage access); core only
 * publishes the contract.
 */
export interface AuditTraceResolver {
  resolveByWikiSlug(slug: string): Promise<AuditTrace | null>;
}
