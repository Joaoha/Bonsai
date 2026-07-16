import { describe, expect, it } from 'vitest';
import {
  BonsaiInvariantError,
  BonsaiNotFoundError,
  type Bonsai,
  type LLMChunk,
  type Retriever,
} from '@bonsai/core';
import {
  handleChat,
  handleCreateBranch,
  handleCreateProject,
  handleDistill,
  handleInspectContext,
  handleMerge,
  handleResolveTrace,
  handleRetrieve,
  HttpNotImplementedError,
  parseChat,
  parseCreateBranch,
  parseCreateProject,
  parseDistill,
  parseInspectContext,
  parseMerge,
  parseRetrieve,
} from './handlers.js';
import { HttpValidationError, mapErrorToHttp } from './errors.js';

// Structural stub of Bonsai. We only implement what the handlers call.
type Calls = {
  createProject?: unknown[];
  createBranch?: unknown[];
  chat?: unknown[];
  merge?: unknown[];
  distill?: unknown[];
  assembleContext?: unknown[];
  resolveTrace?: unknown[];
};

function stubBonsai(overrides: Partial<Bonsai>): { bonsai: Bonsai; calls: Calls } {
  const calls: Calls = {};
  const base: Partial<Bonsai> = {
    async createProject(input) {
      calls.createProject = [input];
      return {
        id: 'p1',
        name: 'proj',
        createdAt: new Date(0),
      };
    },
    async createBranch(input) {
      calls.createBranch = [input];
      return {
        id: 'b2',
        projectId: 'p1',
        name: 'feature',
        parentBranchId: 'b1',
        forkPoint: 'm0',
        lane: 1,
        autoNamed: false,
        pinnedAgent: null,
        mergedToParent: false,
        createdAt: new Date(0),
      };
    },
    // chat/merge/distill/assemble/resolveTrace overridden per test
    ...overrides,
  };
  return { bonsai: base as Bonsai, calls };
}

describe('parsers', () => {
  it('parseCreateProject rejects missing name', () => {
    expect(() => parseCreateProject({})).toThrow(HttpValidationError);
  });
  it('parseCreateProject accepts optional description', () => {
    expect(parseCreateProject({ name: 'x', description: 'y' })).toEqual({
      name: 'x',
      description: 'y',
    });
  });
  it('parseCreateBranch requires forkPoint to be string or null', () => {
    expect(() =>
      parseCreateBranch({ fromBranchId: 'b1', forkPoint: 42 }),
    ).toThrow(HttpValidationError);
    expect(parseCreateBranch({ fromBranchId: 'b1', forkPoint: null })).toMatchObject({
      fromBranchId: 'b1',
      forkPoint: null,
    });
  });
  it('parseChat requires branchId and message', () => {
    expect(() => parseChat({ message: 'hi' })).toThrow(HttpValidationError);
    expect(() => parseChat({ branchId: 'b1' })).toThrow(HttpValidationError);
    expect(parseChat({ branchId: 'b1', message: 'hi', tokenBudget: 100 })).toEqual({
      branchId: 'b1',
      message: 'hi',
      tokenBudget: 100,
    });
  });
  it('parseMerge requires source and target', () => {
    expect(() => parseMerge({ sourceBranchId: 'a' })).toThrow(HttpValidationError);
    expect(
      parseMerge({ sourceBranchId: 'a', targetBranchId: 'b', overrideSummary: 's' }),
    ).toEqual({ sourceBranchId: 'a', targetBranchId: 'b', overrideSummary: 's' });
  });
  it('parseDistill requires exactly one of branchId/mergeId', () => {
    expect(() => parseDistill({})).toThrow(HttpValidationError);
    expect(() => parseDistill({ branchId: 'a', mergeId: 'b' })).toThrow(
      HttpValidationError,
    );
    expect(parseDistill({ branchId: 'a' })).toEqual({ branchId: 'a' });
  });
  it('parseInspectContext requires branchId', () => {
    expect(() => parseInspectContext({})).toThrow(HttpValidationError);
    expect(parseInspectContext({ branchId: 'b1' })).toEqual({ branchId: 'b1' });
  });
  it('parseRetrieve requires query', () => {
    expect(() => parseRetrieve({})).toThrow(HttpValidationError);
    expect(parseRetrieve({ query: 'q', limit: 5 })).toEqual({ query: 'q', limit: 5 });
  });
});

describe('handleCreateProject', () => {
  it('forwards to Bonsai and returns project', async () => {
    const { bonsai, calls } = stubBonsai({});
    const p = await handleCreateProject({ bonsai }, { name: 'proj' });
    expect(p.id).toBe('p1');
    expect(calls.createProject).toEqual([{ name: 'proj' }]);
  });
});

describe('handleCreateBranch', () => {
  it('forwards input verbatim', async () => {
    const { bonsai, calls } = stubBonsai({});
    const b = await handleCreateBranch(
      { bonsai },
      { fromBranchId: 'b1', forkPoint: null, name: 'x' },
    );
    expect(b.name).toBe('feature');
    expect(calls.createBranch).toEqual([
      { fromBranchId: 'b1', forkPoint: null, name: 'x' },
    ]);
  });
});

describe('handleChat', () => {
  it('yields chunks from Bonsai.chat', async () => {
    const script: LLMChunk[] = [
      { content: 'hel', done: false },
      { content: 'lo', done: false },
      { content: '', done: true },
    ];
    const { bonsai } = stubBonsai({
      chat: async function* (branchId, msg, opts) {
        expect(branchId).toBe('b1');
        expect(msg).toBe('hi');
        expect(opts).toEqual({ tokenBudget: 100, model: 'm' });
        for (const c of script) yield c;
      } as Bonsai['chat'],
    });
    const out: LLMChunk[] = [];
    for await (const c of handleChat(
      { bonsai },
      { branchId: 'b1', message: 'hi', tokenBudget: 100, model: 'm' },
    )) {
      out.push(c);
    }
    expect(out).toEqual(script);
  });
});

describe('handleMerge', () => {
  it('threads overrideSummary through editSummary callback', async () => {
    let seenEdit: ((s: string) => string | Promise<string>) | undefined;
    const { bonsai } = stubBonsai({
      merge: (async (input) => {
        seenEdit = input.editSummary as (s: string) => string | Promise<string>;
        return {
          merge: {
            id: 'm1',
            sourceBranchId: input.sourceBranchId,
            targetBranchId: input.targetBranchId,
            status: 'applied',
            summary: 'edited',
            appliedMessageId: 'msg1',
            appliedAt: new Date(0),
            createdAt: new Date(0),
          },
          appliedMessage: {
            id: 'msg1',
            branchId: input.targetBranchId,
            role: 'assistant',
            content: 'merge commit',
            sequence: 2,
            parentIds: [],
            isMergeCommit: true,
            mergedBranchName: 'x',
            createdAt: new Date(0),
          },
        };
      }) as Bonsai['merge'],
    });
    const res = await handleMerge(
      { bonsai },
      { sourceBranchId: 'a', targetBranchId: 'b', overrideSummary: 'edited' },
    );
    expect(res.merge.summary).toBe('edited');
    expect(seenEdit).toBeTypeOf('function');
    expect(await (seenEdit as (s: string) => string | Promise<string>)('draft')).toBe(
      'edited',
    );
  });
});

describe('handleDistill', () => {
  it('forwards input', async () => {
    const { bonsai } = stubBonsai({
      distill: (async (input) => ({
        id: 'd1',
        branchId: input.branchId ?? null,
        mergeId: input.mergeId ?? null,
        wikiPageSlug: 's',
        wikiPageTitle: 't',
        createdAt: new Date(0),
      })) as Bonsai['distill'],
    });
    const d = await handleDistill({ bonsai }, { branchId: 'b1' });
    expect(d.branchId).toBe('b1');
  });
});

describe('handleInspectContext', () => {
  it('returns the ContextPacket assembled by Bonsai', async () => {
    const { bonsai } = stubBonsai({
      assembleContext: (async () => ({
        projectId: 'p1',
        branchId: 'b1',
        model: 'm',
        provider: 'in-memory',
        timestamp: new Date(0).toISOString(),
        messages: [],
        includedMessageIds: [],
        includedMergeIds: [],
        includedWikiPageIds: [],
        tokenEstimate: 0,
        renderedPromptPreview: '',
        systemPreamble: '',
        truncated: false,
      })) as Bonsai['assembleContext'],
    });
    const packet = await handleInspectContext(
      { bonsai },
      { branchId: 'b1', model: 'm' },
    );
    expect(packet.branchId).toBe('b1');
  });
});

describe('handleRetrieve', () => {
  it('throws HttpNotImplementedError if retriever missing', async () => {
    const { bonsai } = stubBonsai({});
    await expect(handleRetrieve({ bonsai }, { query: 'q' })).rejects.toBeInstanceOf(
      HttpNotImplementedError,
    );
  });
  it('calls retriever.search when present', async () => {
    const { bonsai } = stubBonsai({});
    const retriever: Retriever = {
      async search(q, opts) {
        expect(q).toBe('q');
        expect(opts).toEqual({ limit: 3 });
        return [{ id: 'w1', kind: 'wiki', title: 't', snippet: 's', score: 1 }];
      },
    };
    const hits = await handleRetrieve({ bonsai, retriever }, { query: 'q', limit: 3 });
    expect(hits).toHaveLength(1);
  });
});

describe('handleResolveTrace', () => {
  it('returns null when Bonsai has no trace', async () => {
    const { bonsai } = stubBonsai({
      resolveTrace: (async () => null) as Bonsai['resolveTrace'],
    });
    expect(await handleResolveTrace({ bonsai }, 'slug')).toBeNull();
  });
});

describe('mapErrorToHttp', () => {
  it('maps NotFound to 404', () => {
    expect(mapErrorToHttp(new BonsaiNotFoundError('nope')).status).toBe(404);
  });
  it('maps Invariant to 422', () => {
    expect(mapErrorToHttp(new BonsaiInvariantError('bad')).status).toBe(422);
  });
  it('maps unknown errors to 500', () => {
    expect(mapErrorToHttp(new Error('boom')).status).toBe(500);
  });
});
