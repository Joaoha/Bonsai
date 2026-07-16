import type {
  Project,
  Branch,
  Message,
  MessageRole,
  Merge,
  MergeStatus,
  Distillation,
  WikiPage,
} from '@bonsai/core';

const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(String(v)));
const toNullableDate = (v: unknown): Date | null =>
  v === null || v === undefined ? null : toDate(v);

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_at: Date | string;
}
export function rowToProject(r: ProjectRow): Project {
  const p: Project = { id: r.id, name: r.name, createdAt: toDate(r.created_at) };
  if (r.description !== null && r.description !== undefined) {
    p.description = r.description;
  }
  return p;
}

export interface BranchRow {
  id: string;
  project_id: string;
  name: string;
  parent_branch_id: string | null;
  fork_point: string | null;
  lane: number;
  auto_named: boolean;
  merged_to_parent: boolean;
  created_at: Date | string;
}
export function rowToBranch(r: BranchRow): Branch {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    parentBranchId: r.parent_branch_id,
    forkPoint: r.fork_point,
    lane: r.lane,
    autoNamed: r.auto_named,
    mergedToParent: r.merged_to_parent,
    createdAt: toDate(r.created_at),
  };
}

export interface MessageRow {
  id: string;
  branch_id: string;
  role: MessageRole;
  content: string;
  sequence: number;
  parent_ids: string[] | null;
  source_message_id: string | null;
  is_merge_commit: boolean;
  merged_branch_name: string | null;
  merged_branch_id: string | null;
  merged_source_last_message_id: string | null;
  provider: string | null;
  adapter_metadata: string | null;
  created_at: Date | string;
}
export function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    branchId: r.branch_id,
    role: r.role,
    content: r.content,
    sequence: r.sequence,
    parentIds: Array.isArray(r.parent_ids) ? [...r.parent_ids] : [],
    sourceMessageId: r.source_message_id,
    isMergeCommit: r.is_merge_commit,
    mergedBranchName: r.merged_branch_name,
    mergedBranchId: r.merged_branch_id,
    mergedSourceLastMessageId: r.merged_source_last_message_id,
    provider: r.provider,
    adapterMetadata: r.adapter_metadata,
    createdAt: toDate(r.created_at),
  };
}

export interface MergeRow {
  id: string;
  source_branch_id: string;
  target_branch_id: string;
  status: MergeStatus;
  summary: string | null;
  applied_message_id: string | null;
  applied_at: Date | string | null;
  created_at: Date | string;
}
export function rowToMerge(r: MergeRow): Merge {
  return {
    id: r.id,
    sourceBranchId: r.source_branch_id,
    targetBranchId: r.target_branch_id,
    status: r.status,
    summary: r.summary,
    appliedMessageId: r.applied_message_id,
    createdAt: toDate(r.created_at),
    appliedAt: toNullableDate(r.applied_at),
  };
}

export interface DistillationRow {
  id: string;
  branch_id: string | null;
  merge_id: string | null;
  wiki_page_slug: string;
  wiki_page_title: string;
  created_at: Date | string;
}
export function rowToDistillation(r: DistillationRow): Distillation {
  return {
    id: r.id,
    branchId: r.branch_id,
    mergeId: r.merge_id,
    wikiPageSlug: r.wiki_page_slug,
    wikiPageTitle: r.wiki_page_title,
    createdAt: toDate(r.created_at),
  };
}

export interface WikiPageRow {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
}
export function rowToWikiPage(r: WikiPageRow): WikiPage {
  return {
    id: r.id,
    projectId: r.project_id,
    slug: r.slug,
    title: r.title,
    content: r.content,
    createdAt: toDate(r.created_at),
    updatedAt: toDate(r.updated_at),
  };
}
