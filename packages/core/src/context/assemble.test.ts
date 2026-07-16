import { describe, it, expect } from 'vitest';
import { assembleContext } from './assemble.js';
import {
  serializeContextPacket,
  deserializeContextPacket,
} from './packet.js';

const baseInput = {
  projectId: 'p1',
  branchId: 'b1',
  model: 'm',
  provider: 'test',
  timestamp: '2024-01-01T00:00:00.000Z',
  tokenBudget: 4000,
};

describe('assembleContext', () => {
  it('includes wiki pages when within 20% budget', () => {
    const packet = assembleContext({
      ...baseInput,
      ancestryMessages: [],
      merges: [],
      wikiPages: [{ id: 'w1', title: 'API', content: 'hello world' }],
    });
    expect(packet.includedWikiPageIds).toEqual(['w1']);
    expect(packet.systemPreamble).toContain('# Knowledge Base');
  });

  it('adds merge summaries to preamble', () => {
    const packet = assembleContext({
      ...baseInput,
      ancestryMessages: [],
      merges: [{ id: 'mg1', sourceBranchName: 'feature', summary: 'did stuff' }],
      wikiPages: [],
    });
    expect(packet.includedMergeIds).toEqual(['mg1']);
    expect(packet.systemPreamble).toContain('# Merged Insights');
    expect(packet.systemPreamble).toContain('feature');
  });

  it('truncates oldest-first when over budget and sets truncated=true', () => {
    const many = Array.from({ length: 40 }).map((_, i) => ({
      id: `m${i}`,
      role: 'user' as const,
      content: 'x'.repeat(200),
      sequence: i,
      branchId: 'b1',
      branchName: 'main',
      isMergeCommit: false,
    }));
    const packet = assembleContext({
      ...baseInput,
      tokenBudget: 500,
      ancestryMessages: many,
      merges: [],
      wikiPages: [],
    });
    expect(packet.truncated).toBe(true);
    expect(packet.includedMessageIds.length).toBeLessThan(many.length);
    // Newest kept, oldest dropped
    expect(packet.includedMessageIds[packet.includedMessageIds.length - 1]).toBe(
      'm39',
    );
  });

  it('excludes merge-commit rows from conversation but keeps them in includedMessageIds', () => {
    const packet = assembleContext({
      ...baseInput,
      ancestryMessages: [
        {
          id: 'm1',
          role: 'user',
          content: 'hi',
          sequence: 1,
          branchId: 'b1',
          branchName: 'main',
          isMergeCommit: false,
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'merge-content',
          sequence: 2,
          branchId: 'b1',
          branchName: 'main',
          isMergeCommit: true,
          mergedBranchName: 'feature',
        },
      ],
      merges: [],
      wikiPages: [],
    });
    expect(packet.includedMessageIds).toContain('m2');
    expect(packet.messages.find((m) => m.content === 'merge-content')).toBeUndefined();
  });

  it('empty input produces a valid packet', () => {
    const packet = assembleContext({
      ...baseInput,
      ancestryMessages: [],
      merges: [],
      wikiPages: [],
    });
    expect(packet.messages).toEqual([]);
    expect(packet.truncated).toBe(false);
    expect(packet.includedMessageIds).toEqual([]);
  });

  it('serialize/deserialize round-trips stably', () => {
    const packet = assembleContext({
      ...baseInput,
      ancestryMessages: [
        {
          id: 'm1',
          role: 'user',
          content: 'hi',
          sequence: 1,
          branchId: 'b1',
          branchName: 'main',
          isMergeCommit: false,
        },
      ],
      merges: [],
      wikiPages: [],
    });
    const a = serializeContextPacket(packet);
    const b = serializeContextPacket(deserializeContextPacket(a));
    expect(a).toEqual(b);
  });
});
