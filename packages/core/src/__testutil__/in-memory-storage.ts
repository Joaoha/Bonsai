import type { Id } from '../domain/ids.js';
import type { Project } from '../domain/project.js';
import type { Branch } from '../domain/branch.js';
import type { Message } from '../domain/message.js';
import type { Merge } from '../domain/merge.js';
import type { Distillation } from '../domain/distillation.js';
import type {
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
} from '../interfaces/storage.js';

let seq = 0;
const nextId = (): Id => `id-${++seq}`;
const clone = <T>(v: T): T => structuredClone(v);

export function createInMemoryStorage(now: () => Date = () => new Date(0)): Storage {
  const projects = new Map<Id, Project>();
  const branches = new Map<Id, Branch>();
  const messages = new Map<Id, Message>();
  const merges = new Map<Id, Merge>();
  const distillations = new Map<Id, Distillation>();
  const wikiPages = new Map<string, WikiPage>();

  const projectRepo: ProjectRepository = {
    async create(input: ProjectCreateInput): Promise<Project> {
      const p: Project = {
        id: nextId(),
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        createdAt: now(),
      };
      projects.set(p.id, p);
      return clone(p);
    },
    async findById(id: Id): Promise<Project | null> {
      const p = projects.get(id);
      return p ? clone(p) : null;
    },
  };

  const branchRepo: BranchRepository = {
    async create(input: BranchCreateInput): Promise<Branch> {
      const b: Branch = {
        id: nextId(),
        projectId: input.projectId,
        name: input.name,
        parentBranchId: input.parentBranchId,
        forkPoint: input.forkPoint,
        lane: input.lane,
        autoNamed: input.autoNamed,
        mergedToParent: false,
        createdAt: now(),
      };
      branches.set(b.id, b);
      return clone(b);
    },
    async findById(id: Id): Promise<Branch | null> {
      const b = branches.get(id);
      return b ? clone(b) : null;
    },
    async findByProjectId(projectId: Id): Promise<Branch[]> {
      return Array.from(branches.values()).filter((b) => b.projectId === projectId).map(clone);
    },
    async update(id: Id, patch: BranchPatch): Promise<Branch> {
      const b = branches.get(id);
      if (!b) throw new Error(`branch ${id} not found`);
      const updated: Branch = {
        ...b,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.autoNamed !== undefined ? { autoNamed: patch.autoNamed } : {}),
        ...(patch.mergedToParent !== undefined
          ? { mergedToParent: patch.mergedToParent }
          : {}),
      };
      branches.set(id, updated);
      return clone(updated);
    },
    async maxLane(projectId: Id): Promise<number> {
      let max = -1;
      for (const b of branches.values()) {
        if (b.projectId === projectId && b.lane > max) max = b.lane;
      }
      return max;
    },
  };

  const messageRepo: MessageRepository = {
    async create(input: MessageCreateInput): Promise<Message> {
      const m: Message = {
        id: nextId(),
        branchId: input.branchId,
        role: input.role,
        content: input.content,
        sequence: input.sequence,
        parentIds: [...input.parentIds],
        sourceMessageId: input.sourceMessageId ?? null,
        isMergeCommit: input.isMergeCommit ?? false,
        mergedBranchName: input.mergedBranchName ?? null,
        mergedBranchId: input.mergedBranchId ?? null,
        mergedSourceLastMessageId: input.mergedSourceLastMessageId ?? null,
        provider: input.provider ?? null,
        adapterMetadata: input.adapterMetadata ?? null,
        createdAt: now(),
      };
      messages.set(m.id, m);
      return clone(m);
    },
    async findById(id: Id): Promise<Message | null> {
      const m = messages.get(id);
      return m ? clone(m) : null;
    },
    async findByBranchId(branchId: Id): Promise<Message[]> {
      return Array.from(messages.values())
        .filter((m) => m.branchId === branchId)
        .sort((a, b) => a.sequence - b.sequence)
        .map(clone);
    },
    async findManyByIds(ids: Id[]): Promise<Message[]> {
      const set = new Set(ids);
      return Array.from(messages.values()).filter((m) => set.has(m.id)).map(clone);
    },
    async lastByBranch(branchId: Id): Promise<Message | null> {
      const list = Array.from(messages.values())
        .filter((m) => m.branchId === branchId)
        .sort((a, b) => a.sequence - b.sequence);
      const last = list[list.length - 1];
      return last ? clone(last) : null;
    },
  };

  const mergeRepo: MergeRepository = {
    async create(input: MergeCreateInput): Promise<Merge> {
      const mg: Merge = {
        id: nextId(),
        sourceBranchId: input.sourceBranchId,
        targetBranchId: input.targetBranchId,
        status: input.status,
        summary: input.summary ?? null,
        appliedMessageId: null,
        createdAt: now(),
        appliedAt: null,
      };
      merges.set(mg.id, mg);
      return clone(mg);
    },
    async findById(id: Id): Promise<Merge | null> {
      const mg = merges.get(id);
      return mg ? clone(mg) : null;
    },
    async update(id: Id, patch: MergePatch): Promise<Merge> {
      const mg = merges.get(id);
      if (!mg) throw new Error(`merge ${id} not found`);
      const updated: Merge = {
        ...mg,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
        ...(patch.appliedMessageId !== undefined
          ? { appliedMessageId: patch.appliedMessageId }
          : {}),
        ...(patch.appliedAt !== undefined ? { appliedAt: patch.appliedAt } : {}),
      };
      merges.set(id, updated);
      return clone(updated);
    },
    async lastMergeCommitBetween(sourceId: Id, targetId: Id): Promise<Message | null> {
      const list = Array.from(messages.values())
        .filter(
          (m) =>
            m.branchId === targetId &&
            m.isMergeCommit &&
            m.mergedBranchId === sourceId,
        )
        .sort((a, b) => a.sequence - b.sequence);
      const last = list[list.length - 1];
      return last ? clone(last) : null;
    },
  };

  const distillationRepo: DistillationRepository = {
    async create(input: DistillationCreateInput): Promise<Distillation> {
      const d: Distillation = {
        id: nextId(),
        branchId: input.branchId,
        mergeId: input.mergeId,
        wikiPageSlug: input.wikiPageSlug,
        wikiPageTitle: input.wikiPageTitle,
        createdAt: now(),
      };
      distillations.set(d.id, d);
      return clone(d);
    },
    async findById(id: Id): Promise<Distillation | null> {
      const d = distillations.get(id);
      return d ? clone(d) : null;
    },
  };

  const wikiRepo: WikiPageRepository = {
    async upsert(input: WikiPageUpsertInput): Promise<WikiPage> {
      const key = `${input.projectId}::${input.slug}`;
      const existing = wikiPages.get(key);
      const page: WikiPage = {
        id: existing?.id ?? nextId(),
        projectId: input.projectId,
        slug: input.slug,
        title: input.title,
        content: input.content,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      wikiPages.set(key, page);
      return clone(page);
    },
    async list(projectId: Id): Promise<WikiPage[]> {
      return Array.from(wikiPages.values())
        .filter((p) => p.projectId === projectId)
        .map(clone);
    },
    async search(input: WikiPageSearchInput): Promise<WikiPageHit[]> {
      const kw = input.keywords.toLowerCase();
      const hits = Array.from(wikiPages.values())
        .filter((p) => p.projectId === input.projectId)
        .filter(
          (p) =>
            p.title.toLowerCase().includes(kw) ||
            p.content.toLowerCase().includes(kw),
        )
        .slice(0, input.limit ?? 10)
        .map((p) => ({ ...clone(p), score: 1 }));
      return hits;
    },
  };

  return {
    projects: projectRepo,
    branches: branchRepo,
    messages: messageRepo,
    merges: mergeRepo,
    distillations: distillationRepo,
    wikiPages: wikiRepo,
  };
}
