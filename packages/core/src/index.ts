// Public API surface for @bonsai/core. Every export from the package MUST
// be listed here; deep paths (dist/**/*.js) are NOT part of the contract.

export { Bonsai } from './bonsai.js';
export type {
  BonsaiOptions,
  CreateProjectInput,
  CreateBranchInput,
  AssembleContextOptions,
  MergeInput,
  DistillInput,
} from './bonsai.js';

// Domain types
export type { Id, IdFactory } from './domain/ids.js';
export { RandomIdFactory } from './domain/ids.js';
export type { Clock } from './domain/clock.js';
export { SystemClock } from './domain/clock.js';
export type { Project } from './domain/project.js';
export type { Branch } from './domain/branch.js';
export { assertForkPointConsistency } from './domain/branch.js';
export type { Message, MessageRole } from './domain/message.js';
export { assertSequenceMonotonic } from './domain/message.js';
export type { Merge, MergeStatus, MergeTransition } from './domain/merge.js';
export { canTransition, nextMergeState } from './domain/merge.js';
export type { Distillation } from './domain/distillation.js';
export { assertDistillationSource } from './domain/distillation.js';

// Errors
export {
  BonsaiError,
  BonsaiInvariantError,
  BonsaiTokenBudgetError,
  BonsaiNotFoundError,
  BonsaiInterfaceError,
} from './domain/errors.js';

// Interfaces
export type {
  Storage,
  ProjectRepository,
  BranchRepository,
  MessageRepository,
  MergeRepository,
  DistillationRepository,
  WikiPageRepository,
  ProjectCreateInput,
  BranchCreateInput,
  BranchPatch,
  MessageCreateInput,
  MergeCreateInput,
  MergePatch,
  DistillationCreateInput,
  WikiPage,
  WikiPageHit,
  WikiPageUpsertInput,
  WikiPageSearchInput,
} from './interfaces/storage.js';
export type {
  LLMProvider,
  LLMMessage,
  LLMChunk,
  LLMUsage,
  BuildContextPacketOptions,
} from './interfaces/llm-provider.js';
export type {
  WikiStore,
  WikiPageInput,
  WikiLogEntry,
  WikiIndexEntry,
} from './interfaces/wiki-store.js';
export type {
  Retriever,
  RetrieverHit,
  RetrieverSearchOptions,
} from './interfaces/retriever.js';

// Context
export type { ContextPacket, ContextPacketMessage } from './context/packet.js';
export {
  serializeContextPacket,
  deserializeContextPacket,
} from './context/packet.js';
export { estimateTokens, truncateFromOldest } from './context/token-budget.js';
export type {
  AssembleContextInput,
  AssembleAncestryMessage,
  AssembleMergeSummary,
  AssembleWikiPage,
} from './context/assemble.js';
export { assembleContext } from './context/assemble.js';
export type { AncestryWalkStep } from './context/ancestry.js';
export {
  walkAncestry,
  flattenAncestryToContextMessages,
} from './context/ancestry.js';

// Merge helpers
export { buildMergeSummaryPrompt } from './merge/summary-prompt.js';
export type { BuildMergeCommitInput, NewMessage } from './merge/apply.js';
export { buildMergeCommitMessage } from './merge/apply.js';
export type { MergeEvent } from './merge/state.js';
export { advanceMerge } from './merge/state.js';

// Distill helpers
export { slugifyTitle, disambiguate } from './distill/slug.js';
export { renderFrontmatter, parseFrontmatter } from './distill/frontmatter.js';
export type { BuildWikiPageInput } from './distill/page.js';
export { buildWikiPage } from './distill/page.js';
export type { WikiIndexRow } from './distill/index.js';
export { updateWikiIndex } from './distill/index.js';
export { formatWikiLogLine } from './distill/log.js';

// Retrieval helpers
export { scoreHit, snippetAround } from './retrieval/ranking.js';

// Audit
export type {
  AuditTrace,
  AuditTraceMerge,
  AuditTraceBranch,
  AuditTraceTranscriptEntry,
  AuditTraceResolver,
  ResolveTraceInput,
} from './audit/trace.js';
export { resolveTrace } from './audit/trace.js';
