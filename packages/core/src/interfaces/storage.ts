// Storage abstraction. Adapters (Postgres, SQLite, in-memory) implement this.
// Every method returns Promise<T | null> or Promise<T[]> — no throws for
// not-found. The Bonsai façade converts null into BonsaiNotFoundError where
// the caller expects a value.

import type { Id } from '../domain/ids.js';
import type { Project } from '../domain/project.js';
import type { Branch } from '../domain/branch.js';
import type { Message, MessageRole } from '../domain/message.js';
import type { Merge, MergeStatus } from '../domain/merge.js';
import type { Distillation } from '../domain/distillation.js';

export interface ProjectCreateInput {
  name: string;
  description?: string;
}

export interface ProjectRepository {
  create(input: ProjectCreateInput): Promise<Project>;
  findById(id: Id): Promise<Project | null>;
}

export interface BranchCreateInput {
  projectId: Id;
  name: string;
  parentBranchId: Id | null;
  forkPoint: Id | null;
  lane: number;
  autoNamed: boolean;
}

export interface BranchPatch {
  name?: string;
  autoNamed?: boolean;
  mergedToParent?: boolean;
}

export interface BranchRepository {
  create(input: BranchCreateInput): Promise<Branch>;
  findById(id: Id): Promise<Branch | null>;
  findByProjectId(projectId: Id): Promise<Branch[]>;
  update(id: Id, patch: BranchPatch): Promise<Branch>;
  /** Returns highest lane number currently in use in the project, or -1 if none. */
  maxLane(projectId: Id): Promise<number>;
}

export interface MessageCreateInput {
  branchId: Id;
  role: MessageRole;
  content: string;
  sequence: number;
  parentIds: Id[];
  sourceMessageId?: Id | null;
  isMergeCommit?: boolean;
  mergedBranchName?: string | null;
  mergedBranchId?: Id | null;
  mergedSourceLastMessageId?: Id | null;
  provider?: string | null;
  adapterMetadata?: string | null;
}

export interface MessageRepository {
  create(input: MessageCreateInput): Promise<Message>;
  findById(id: Id): Promise<Message | null>;
  findByBranchId(branchId: Id): Promise<Message[]>;
  findManyByIds(ids: Id[]): Promise<Message[]>;
  lastByBranch(branchId: Id): Promise<Message | null>;
}

export interface MergeCreateInput {
  sourceBranchId: Id;
  targetBranchId: Id;
  status: MergeStatus;
  summary?: string | null;
}

export interface MergePatch {
  status?: MergeStatus;
  summary?: string | null;
  appliedMessageId?: Id | null;
  appliedAt?: Date | null;
}

export interface MergeRepository {
  create(input: MergeCreateInput): Promise<Merge>;
  findById(id: Id): Promise<Merge | null>;
  update(id: Id, patch: MergePatch): Promise<Merge>;
  /**
   * Returns the most recent merge-commit Message (isMergeCommit=true) whose
   * mergedBranchId matches sourceId on branch targetId, or null if none.
   */
  lastMergeCommitBetween(sourceId: Id, targetId: Id): Promise<Message | null>;
}

export interface DistillationCreateInput {
  branchId: Id | null;
  mergeId: Id | null;
  wikiPageSlug: string;
  wikiPageTitle: string;
}

export interface DistillationRepository {
  create(input: DistillationCreateInput): Promise<Distillation>;
  findById(id: Id): Promise<Distillation | null>;
}

export interface WikiPage {
  id: Id;
  projectId: Id;
  slug: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WikiPageHit extends WikiPage {
  score?: number;
}

export interface WikiPageUpsertInput {
  projectId: Id;
  slug: string;
  title: string;
  content: string;
}

export interface WikiPageSearchInput {
  projectId: Id;
  keywords: string;
  limit?: number;
}

export interface WikiPageRepository {
  upsert(input: WikiPageUpsertInput): Promise<WikiPage>;
  list(projectId: Id): Promise<WikiPage[]>;
  search(input: WikiPageSearchInput): Promise<WikiPageHit[]>;
}

export interface Storage {
  projects: ProjectRepository;
  branches: BranchRepository;
  messages: MessageRepository;
  merges: MergeRepository;
  distillations: DistillationRepository;
  wikiPages: WikiPageRepository;
}
