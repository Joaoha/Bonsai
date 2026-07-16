import { describe, it, expect } from 'vitest';
import type { ContextPacket } from '@bonsai/core';
import { OpenAIProvider, type FetchLike } from './provider.js';

function sseBody(events: Array<object | '[DONE]'>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) {
        const payload = ev === '[DONE]' ? '[DONE]' : JSON.stringify(ev);
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }
      controller.close();
    },
  });
}

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body?: ReadableStream<Uint8Array> | null;
  textBody?: string;
}): {
  fetch: FetchLike;
  calls: Array<{ url: string; body: unknown; headers: Record<string, string> }>;
} {
  const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> =
    [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({
      url,
      body: init?.body ? JSON.parse(init.body) : undefined,
      headers: init?.headers ?? {},
    });
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? 'OK',
      body: response.body ?? null,
      async text() {
        return response.textBody ?? '';
      },
    };
  };
  return { fetch, calls };
}

async function collectContent(
  iter: AsyncIterable<{ content: string; done: boolean }>,
): Promise<{ text: string; terminalSeen: boolean }> {
  let text = '';
  let terminalSeen = false;
  for await (const chunk of iter) {
    text += chunk.content;
    if (chunk.done) terminalSeen = true;
  }
  return { text, terminalSeen };
}

const clock = { now: () => new Date('2026-01-01T00:00:00.000Z') };

describe('OpenAIProvider', () => {
  it('constructor rejects a missing api key', () => {
    expect(() => new OpenAIProvider({ apiKey: '', fetch: async () => ({}) as never })).toThrow(
      /apiKey is required/,
    );
  });

  it('buildContextPacket produces a deterministic inspectable packet', () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk-test',
      fetch: mockFetch({}).fetch,
      clock,
    });
    const packet = provider.buildContextPacket(
      [
        { role: 'system', content: 'you are helpful' },
        { role: 'user', content: 'hi' },
      ],
      { model: 'gpt-4o-mini' },
    );
    expect(packet.provider).toBe('openai');
    expect(packet.model).toBe('gpt-4o-mini');
    expect(packet.messages).toHaveLength(2);
    expect(packet.timestamp).toBe('2026-01-01T00:00:00.000Z');
    expect(packet.renderedPromptPreview).toContain('user: hi');
    expect(packet.tokenEstimate).toBeGreaterThan(0);
    expect(packet.truncated).toBe(false);
  });

  it('countTokens follows the 4-chars-per-token heuristic', () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk',
      fetch: mockFetch({}).fetch,
    });
    expect(provider.countTokens('12345678')).toBe(2);
    expect(provider.countTokens('')).toBe(0);
  });

  it('getLimit resolves overrides then defaults then fallback', () => {
    const provider = new OpenAIProvider({
      apiKey: 'sk',
      fetch: mockFetch({}).fetch,
      limits: { 'my-model': { contextTokens: 999, maxOutputTokens: 100 } },
    });
    expect(provider.getLimit('my-model').contextTokens).toBe(999);
    expect(provider.getLimit('gpt-4o').contextTokens).toBe(128_000);
    expect(provider.getLimit('unknown-model').contextTokens).toBe(8_192);
  });

  it('streamCompletion posts to /chat/completions with bearer auth and stream=true', async () => {
    const { fetch, calls } = mockFetch({
      body: sseBody([
        { choices: [{ delta: { content: 'hello' } }] },
        { choices: [{ delta: { content: ' world' }, finish_reason: 'stop' }] },
        '[DONE]',
      ]),
    });
    const provider = new OpenAIProvider({
      apiKey: 'sk-XYZ',
      baseUrl: 'https://example.test/v1/',
      fetch,
      clock,
    });
    const packet: ContextPacket = {
      projectId: 'p',
      branchId: 'b',
      model: 'gpt-4o-mini',
      provider: 'openai',
      timestamp: '2026-01-01T00:00:00.000Z',
      messages: [{ role: 'user', content: 'hi' }],
      includedMessageIds: [],
      includedMergeIds: [],
      includedWikiPageIds: [],
      tokenEstimate: 1,
      renderedPromptPreview: 'user: hi',
      systemPreamble: '',
      truncated: false,
    };
    const { text, terminalSeen } = await collectContent(
      provider.streamCompletion(packet),
    );
    expect(text).toBe('hello world');
    expect(terminalSeen).toBe(true);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    // Trailing slash is normalized out of baseUrl.
    expect(call.url).toBe('https://example.test/v1/chat/completions');
    expect(call.headers.authorization).toBe('Bearer sk-XYZ');
    expect(call.headers['content-type']).toBe('application/json');
    expect(call.body).toMatchObject({
      model: 'gpt-4o-mini',
      stream: true,
      max_tokens: 16_384,
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('streamCompletion surfaces terminal usage when the upstream sends it', async () => {
    const { fetch } = mockFetch({
      body: sseBody([
        { choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] },
        { choices: [], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } },
        '[DONE]',
      ]),
    });
    const provider = new OpenAIProvider({ apiKey: 'sk', fetch, clock });
    const chunks: Array<{ content: string; done: boolean; usage?: unknown }> = [];
    for await (const c of provider.streamCompletion(
      provider.buildContextPacket([{ role: 'user', content: 'x' }]),
    )) {
      chunks.push(c);
    }
    const terminal = chunks.at(-1)!;
    expect(terminal.done).toBe(true);
    expect(terminal.usage).toEqual({
      promptTokens: 3,
      completionTokens: 1,
      totalTokens: 4,
    });
  });

  it('streamCompletion throws with status detail on non-2xx', async () => {
    const { fetch } = mockFetch({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      textBody: '{"error":{"message":"bad key"}}',
    });
    const provider = new OpenAIProvider({ apiKey: 'sk', fetch, clock });
    await expect(async () => {
      for await (const _c of provider.streamCompletion(
        provider.buildContextPacket([{ role: 'user', content: 'x' }]),
      )) {
        void _c;
      }
    }).rejects.toThrow(/HTTP 401 Unauthorized.*bad key/s);
  });

  it('streamCompletion never emits provider secrets in packet metadata', () => {
    // Guards a real leak class: buildContextPacket must not surface the api key.
    const provider = new OpenAIProvider({ apiKey: 'sk-SECRET', fetch: mockFetch({}).fetch });
    const packet = provider.buildContextPacket([{ role: 'user', content: 'hi' }]);
    expect(JSON.stringify(packet)).not.toContain('sk-SECRET');
  });
});
