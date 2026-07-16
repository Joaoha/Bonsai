import type { Id } from './domain/ids.js';
import type { IdFactory } from './domain/ids.js';
import { RandomIdFactory } from './domain/ids.js';
import type { Clock } from './domain/clock.js';
import { SystemClock } from './domain/clock.js';
import type { Project } from './domain/project.js';
import type { Branch } from './domain/branch.js';
import type { Message } from './domain/message.js';
import type { Merge } from './domain/merge.js';
import type { Distillation } from './domain/distillation.js';
import { BonsaiNotFoundError, BonsaiInvariantError } from './domain/errors.js';
import type { Storage } from './interfaces/storage.js';
import type { LLMProvider, LLMChunk } from './interfaces/llm-provider.js';
import type { WikiStore } from './interfaces/wiki-store.js';
import type { Retriever } from './interfaces/retriever.js';
import type { ContextPacket } from './context/packet.js';
import { assembleContext } from './context/assemble.js';
import { walkAncestry, flattenAncestryToContextMessages } from './context/ancestry.js';
import { buildMergeSummaryPrompt } from './merge/summary-prompt.js';
import { buildMergeCommitMessage } from './merge/apply.js';
import { advanceMerge } from './merge/state.js';
import { buildWikiPage } from './distill/page.js';
import { resolveTrace } from './audit/trace.js';
import type { AuditTrace } from './audit/trace.js';
import { slugifyTitle } from './distill/slug.js';

export interface BonsaiOptions {
  storage: Storage;
  provider: LLMProvider;
  wiki: WikiStore;
  retriever?: Retriever;
  clock?: Clock;
  ids?: IdFactory;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface CreateBranchInput {
  fromBranchId: Id;
  forkPoint: Id | null;
  name?: string;
  pinnedAgent?: string | null;
}

export interface AssembleContextOptions {
  tokenBudget?: number;
  keywords?: string;
  model?: string;
}

export interface MergeInput {
  sourceBranchId: Id;
  targetBranchId: Id;
  editSummary?: (draft: string) => Promise<string> | string;
}

export interface DistillInput {
  branchId?: Id;
  mergeId?: Id;
}

const DEFAULT_TOKEN_BUDGET = 4000;

export class Bonsai {
  private readonly storage: Storage;
  private readonly provider: LLMProvider;
  private readonly wiki: WikiStore;
  private readonly retriever: Retriever | undefined;
  private readonly clock: Clock;
  private readonly ids: IdFactory;

  constructor(opts: BonsaiOptions) {
    this.storage = opts.storage;
    this.provider = opts.provider;
    this.wiki = opts.wiki;
    this.retriever = opts.retriever;
    this.clock = opts.clock ?? new SystemClock();
    this.ids = opts.ids ?? new RandomIdFactory();
  }

  async init(): Promise<void> {
    // No-op default. Adapters may override on subclass; the façade itself
    // has nothing to eagerly do.
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const project = await this.storage.projects.create(
      input.description !== undefined
        ? { name: input.name, description: input.description }
        : { name: input.name },
    );
    await this.storage.branches.create({
      projectId: project.id,
      name: 'main',
      parentBranchId: null,
      forkPoint: null,
      lane: 0,
      autoNamed: false,
    });
    return project;
  }

  async createBranch(input: CreateBranchInput): Promise<Branch> {
    const parent = await this.storage.branches.findById(input.fromBranchId);
    if (!parent) throw new BonsaiNotFoundError(`branch ${input.fromBranchId} not found`);
    const maxLane = await this.storage.branches.maxLane(parent.projectId);
    const name = input.name && input.name.length > 0 ? input.name : `branch-${this.ids.newId().slice(0, 8)}`;
    return this.storage.branches.create({
      projectId: parent.projectId,
      name,
      parentBranchId: parent.id,
      forkPoint: input.forkPoint,
      lane: maxLane + 1,
      autoNamed: !input.name,
    });
  }

  async assembleContext(
    branchId: Id,
    opts: AssembleContextOptions = {},
  ): Promise<ContextPacket> {
    const branch = await this.storage.branches.findById(branchId);
    if (!branch) throw new BonsaiNotFoundError(`branch ${branchId} not found`);

    // Collect all branches in this project so ancestry walk can resolve.
    const allBranches = await this.storage.branches.findByProjectId(branch.projectId);
    const branchMap = new Map<Id, Branch>();
    for (const b of allBranches) branchMap.set(b.id, b);

    const messagesByBranch = new Map<Id, Message[]>();
    for (const b of allBranches) {
      messagesByBranch.set(b.id, await this.storage.messages.findByBranchId(b.id));
    }

    const walk = walkAncestry(branchId, branchMap, messagesByBranch);
    const ancestryMessages = flattenAncestryToContextMessages(walk);

    const merges: Array<{ id: Id; sourceBranchName: string; summary: string }> = [];
    for (const step of walk) {
      for (const m of step.messages) {
        if (m.isMergeCommit) {
          merges.push({
            id: m.id,
            sourceBranchName: m.mergedBranchName ?? 'unknown',
            summary: m.content,
          });
        }
      }
    }

    let wikiPages: Array<{ id: Id; title: string; content: string }> = [];
    if (opts.keywords && opts.keywords.trim().length > 0) {
      const hits = await this.storage.wikiPages.search({
        projectId: branch.projectId,
        keywords: opts.keywords,
        limit: 5,
      });
      wikiPages = hits.map((h) => ({ id: h.id, title: h.title, content: h.content }));
    } else {
      const pages = await this.storage.wikiPages.list(branch.projectId);
      wikiPages = pages.map((p) => ({ id: p.id, title: p.title, content: p.content }));
    }

    return assembleContext({
      projectId: branch.projectId,
      branchId,
      model: opts.model ?? 'unknown',
      provider: this.provider.providerId,
      timestamp: this.clock.now().toISOString(),
      ancestryMessages,
      merges,
      wikiPages,
      tokenBudget: opts.tokenBudget ?? DEFAULT_TOKEN_BUDGET,
    });
  }

  async *chat(
    branchId: Id,
    userMessage: string,
    opts: AssembleContextOptions = {},
  ): AsyncIterable<LLMChunk> {
    const packet = await this.assembleContext(branchId, opts);
    const nextSeq = await this.nextSequence(branchId);
    await this.storage.messages.create({
      branchId,
      role: 'user',
      content: userMessage,
      sequence: nextSeq,
      parentIds: [],
    });
    // Rebuild packet including the just-written user message.
    const withUser: ContextPacket = {
      ...packet,
      messages: [...packet.messages, { role: 'user', content: userMessage }],
    };
    let assembled = '';
    for await (const chunk of this.provider.streamCompletion(withUser)) {
      assembled += chunk.content;
      yield chunk;
      if (chunk.done) break;
    }
    if (assembled.length > 0) {
      const seq = await this.nextSequence(branchId);
      await this.storage.messages.create({
        branchId,
        role: 'assistant',
        content: assembled,
        sequence: seq,
        parentIds: [],
        provider: this.provider.providerId,
      });
    }
  }

  async merge(input: MergeInput): Promise<{ merge: Merge; appliedMessage: Message }> {
    const source = await this.storage.branches.findById(input.sourceBranchId);
    if (!source) throw new BonsaiNotFoundError(`branch ${input.sourceBranchId} not found`);
    const target = await this.storage.branches.findById(input.targetBranchId);
    if (!target) throw new BonsaiNotFoundError(`branch ${input.targetBranchId} not found`);

    const sourceMessages = await this.storage.messages.findByBranchId(source.id);
    const sourceLast = sourceMessages[sourceMessages.length - 1];
    if (!sourceLast) {
      throw new BonsaiInvariantError(`source branch ${source.id} has no messages to merge`);
    }
    const targetLast = await this.storage.messages.lastByBranch(target.id);
    if (!targetLast) {
      throw new BonsaiInvariantError(`target branch ${target.id} has no messages`);
    }

    let merge = await this.storage.merges.create({
      sourceBranchId: source.id,
      targetBranchId: target.id,
      status: 'proposed',
    });

    // Generate summary via provider. buildMergeSummaryPrompt is deterministic.
    const prompt = buildMergeSummaryPrompt(source.name, sourceMessages);
    const promptPacket = this.provider.buildContextPacket(prompt);
    let draft = '';
    for await (const chunk of this.provider.streamCompletion(promptPacket)) {
      draft += chunk.content;
      if (chunk.done) break;
    }

    const finalSummary =
      input.editSummary !== undefined ? await input.editSummary(draft) : draft;

    merge = advanceMerge(merge, { type: 'summarize', summary: finalSummary });
    merge = await this.storage.merges.update(merge.id, {
      status: 'summarized',
      summary: finalSummary,
    });

    // Build + persist merge commit
    const commit = buildMergeCommitMessage({
      sourceBranchId: source.id,
      sourceBranchName: source.name,
      targetBranch: target,
      targetLastMessage: targetLast,
      sourceLastMessage: sourceLast,
      summary: finalSummary,
    });
    const appliedMessage = await this.storage.messages.create(commit);

    const now = this.clock.now();
    merge = advanceMerge(merge, {
      type: 'apply',
      appliedMessageId: appliedMessage.id,
      appliedAt: now,
    });
    merge = await this.storage.merges.update(merge.id, {
      status: 'applied',
      appliedMessageId: appliedMessage.id,
      appliedAt: now,
    });
    await this.storage.branches.update(source.id, { mergedToParent: true });

    return { merge, appliedMessage };
  }

  async distill(input: DistillInput): Promise<Distillation> {
    if ((input.branchId == null) === (input.mergeId == null)) {
      throw new BonsaiInvariantError(
        'distill: exactly one of branchId / mergeId must be provided',
      );
    }
    let title: string;
    let branchIdForDistill: Id | null = null;
    let mergeIdForDistill: Id | null = null;
    let projectId: Id;
    let sourceMessages: Message[];

    if (input.branchId != null) {
      const branch = await this.storage.branches.findById(input.branchId);
      if (!branch) throw new BonsaiNotFoundError(`branch ${input.branchId} not found`);
      title = `Distillation of ${branch.name}`;
      branchIdForDistill = branch.id;
      projectId = branch.projectId;
      sourceMessages = await this.storage.messages.findByBranchId(branch.id);
    } else {
      const merge = await this.storage.merges.findById(input.mergeId as Id);
      if (!merge) throw new BonsaiNotFoundError(`merge ${input.mergeId as string} not found`);
      const src = await this.storage.branches.findById(merge.sourceBranchId);
      if (!src) throw new BonsaiNotFoundError(`branch ${merge.sourceBranchId} not found`);
      title = `Merge: ${src.name}`;
      mergeIdForDistill = merge.id;
      projectId = src.projectId;
      sourceMessages = await this.storage.messages.findByBranchId(src.id);
    }

    const slug = slugifyTitle(title);
    const page = buildWikiPage({
      title,
      branchId: branchIdForDistill,
      mergeId: mergeIdForDistill,
      sources: sourceMessages.map((m) => ({
        messageId: m.id,
        role: m.role,
        content: m.content,
      })),
      distilled: {
        summary: sourceMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n'),
        wikilinks: [],
      },
      createdAt: this.clock.now(),
    });

    await this.wiki.write(page);
    await this.storage.wikiPages.upsert({
      projectId,
      slug: page.slug,
      title: page.title,
      content: page.body,
    });

    return this.storage.distillations.create({
      branchId: branchIdForDistill,
      mergeId: mergeIdForDistill,
      wikiPageSlug: slug,
      wikiPageTitle: title,
    });
  }

  async resolveTrace(wikiSlug: string): Promise<AuditTrace | null> {
    // Minimal happy-path resolution: look up a distillation via wiki listing;
    // full search paths belong to the storage-postgres adapter which can add
    // an index. Here we fall back to iterating the wiki list.
    const list = await this.wiki.list();
    const entry = list.find((e) => e.slug === wikiSlug);
    if (!entry) return null;
    // We have no distillation index by slug in this phase; return a minimal
    // trace built purely from the wiki entry so the surface exists.
    return resolveTrace({
      distillation: {
        id: 'unknown',
        branchId: null,
        mergeId: null,
        wikiPageSlug: entry.slug,
        wikiPageTitle: entry.title,
        createdAt: this.clock.now(),
      },
      sourceMessages: [],
    });
  }

  private async nextSequence(branchId: Id): Promise<number> {
    const last = await this.storage.messages.lastByBranch(branchId);
    return (last?.sequence ?? 0) + 1;
  }
}
