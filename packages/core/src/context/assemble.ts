import type { Id } from '../domain/ids.js';
import type { ContextPacket, ContextPacketMessage } from './packet.js';
import { estimateTokens, truncateFromOldest } from './token-budget.js';

export interface AssembleAncestryMessage {
  id: Id;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sequence: number;
  branchId: Id;
  branchName: string;
  isMergeCommit: boolean;
  mergedBranchName?: string;
}

export interface AssembleMergeSummary {
  id: Id;
  sourceBranchName: string;
  summary: string;
}

export interface AssembleWikiPage {
  id: Id;
  title: string;
  content: string;
}

export interface AssembleContextInput {
  projectId: Id;
  branchId: Id;
  model: string;
  provider: string;
  timestamp: string;
  ancestryMessages: AssembleAncestryMessage[];
  merges: AssembleMergeSummary[];
  wikiPages: AssembleWikiPage[];
  tokenBudget: number;
}

/**
 * Pure ContextPacket assembly. Priority (matches reference implementation):
 *  1. Wiki pages up to 20% of budget (dropped if over).
 *  2. Merge summaries up to 30% of remaining budget (dropped if over).
 *  3. Conversation messages fill the remaining budget, oldest dropped first.
 *
 * Merge-commit messages are EXCLUDED from `messages[]` (their content is
 * already in the systemPreamble) but their IDs remain in
 * `includedMessageIds` for audit.
 */
export function assembleContext(input: AssembleContextInput): ContextPacket {
  const {
    projectId,
    branchId,
    model,
    provider,
    timestamp,
    ancestryMessages,
    merges,
    wikiPages,
    tokenBudget,
  } = input;

  let systemPreamble = '';
  let rendered = '';
  let tokenCount = 0;

  // 1. Wiki pages
  const wikiText = wikiPages
    .map((w) => `[Wiki: ${w.title}]\n${w.content}`)
    .join('\n\n');
  const wikiTokens = estimateTokens(wikiText);
  const includeWiki = wikiPages.length > 0 && wikiTokens <= tokenBudget * 0.2;
  const includedWikiPageIds: Id[] = includeWiki ? wikiPages.map((w) => w.id) : [];
  if (includeWiki) {
    const block = '# Knowledge Base\n\n' + wikiText + '\n\n';
    rendered += block;
    systemPreamble += block;
    tokenCount += wikiTokens;
  }

  // 2. Merge summaries
  const mergeText = merges
    .map((m) => `[Merged from ${m.sourceBranchName}]: ${m.summary}`)
    .join('\n');
  const mergeTokens = estimateTokens(mergeText);
  const remainingAfterWiki = tokenBudget - tokenCount;
  const includeMerges =
    merges.length > 0 && mergeTokens <= remainingAfterWiki * 0.3;
  const includedMergeIds: Id[] = includeMerges ? merges.map((m) => m.id) : [];
  if (includeMerges) {
    const block = '# Merged Insights\n\n' + mergeText + '\n\n';
    rendered += block;
    systemPreamble += block;
    tokenCount += mergeTokens;
  }

  // 3. Messages fill remaining budget
  const messageBudget = tokenBudget - tokenCount;
  const sized = ancestryMessages.map((m) => ({
    m,
    text: `[${m.branchName}] ${m.role}: ${m.content}\n\n`,
  }));
  const { kept, dropped } = truncateFromOldest(
    sized,
    (s) => estimateTokens(s.text),
    messageBudget,
  );

  const truncated = dropped.length > 0;
  const includedMessageIds: Id[] = kept.map((s) => s.m.id);

  // Conversation-only messages exclude merge-commit rows (their content is
  // already promoted into the systemPreamble). But we still count their
  // id in includedMessageIds for auditability.
  const conversation: ContextPacketMessage[] = kept
    .filter((s) => !s.m.isMergeCommit)
    .map((s) => ({ role: s.m.role, content: s.m.content }));

  const messageSection = kept.map((s) => s.text).join('');
  const messageTokens = estimateTokens(messageSection);
  rendered += '# Conversation\n\n' + messageSection;
  tokenCount += messageTokens;

  return {
    projectId,
    branchId,
    model,
    provider,
    timestamp,
    messages: conversation,
    includedMessageIds,
    includedMergeIds,
    includedWikiPageIds,
    tokenEstimate: tokenCount,
    renderedPromptPreview: rendered,
    systemPreamble,
    truncated,
  };
}
