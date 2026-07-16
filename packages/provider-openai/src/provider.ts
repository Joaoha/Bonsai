import type {
  BuildContextPacketOptions,
  LLMChunk,
  LLMMessage,
  LLMProvider,
} from '@bonsai/core';
import type { ContextPacket } from '@bonsai/core';
import {
  DEFAULT_OPENAI_LIMITS,
  OPENAI_FALLBACK_LIMIT,
  resolveLimit,
  type OpenAIModelLimit,
} from './limits.js';
import {
  parseOpenAISseStream,
  readableStreamToText,
  type OpenAIStreamEvent,
} from './sse.js';

export const OPENAI_PROVIDER_ID = 'openai';

/** Minimal WHATWG fetch signature; injectable for tests. */
export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}>;

/** Injectable clock so tests can freeze timestamps in ContextPackets. */
export interface OpenAIClock {
  now(): Date;
}

export interface OpenAIProviderOptions {
  /** API key. Read from `OPENAI_API_KEY` env var by the embedder — never a repo default. */
  apiKey: string;
  /** OpenAI-compatible base URL, e.g. `https://api.openai.com/v1`. */
  baseUrl?: string;
  /** Default model used when {@link BuildContextPacketOptions.model} is unset. */
  defaultModel?: string;
  /** Override or extend the provider limit table. */
  limits?: Readonly<Record<string, OpenAIModelLimit>>;
  /** Injected fetch (tests). Defaults to global `fetch`. */
  fetch?: FetchLike;
  /** Injected clock (tests). */
  clock?: OpenAIClock;
  /** Abort signal for the streaming request. */
  signal?: AbortSignal;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** 4-chars-per-token heuristic. Matches @bonsai/core's estimator. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * OpenAI-compatible {@link LLMProvider} adapter. Talks to any endpoint that
 * speaks the `/chat/completions` streaming contract (OpenAI, Azure OpenAI,
 * groq, together.ai, local llama.cpp servers with `--openai-compat`, etc.).
 *
 * Boundary invariants:
 * - Zero storage / UI / secrets logic. Callers pass `apiKey` in memory only.
 * - No I/O in the constructor; the first HTTP call happens in `streamCompletion`.
 * - `buildContextPacket` is deterministic and does not touch the network.
 */
export class OpenAIProvider implements LLMProvider {
  readonly providerId = OPENAI_PROVIDER_ID;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly limitOverrides: Readonly<Record<string, OpenAIModelLimit>>;
  private readonly fetchImpl: FetchLike;
  private readonly clock: OpenAIClock;
  private readonly signal: AbortSignal | undefined;

  constructor(opts: OpenAIProviderOptions) {
    if (!opts.apiKey) {
      throw new Error('OpenAIProvider: apiKey is required');
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.defaultModel = opts.defaultModel ?? 'gpt-4o-mini';
    this.limitOverrides = opts.limits ?? {};
    const injected = opts.fetch;
    if (injected) {
      this.fetchImpl = injected;
    } else {
      const globalFetch = (globalThis as { fetch?: FetchLike }).fetch;
      if (!globalFetch) {
        throw new Error(
          'OpenAIProvider: no global fetch available; pass opts.fetch or run on Node >= 20.',
        );
      }
      this.fetchImpl = globalFetch;
    }
    this.clock = opts.clock ?? { now: () => new Date() };
    this.signal = opts.signal;
  }

  /** Lookup the token limits for a given model, honouring constructor overrides. */
  getLimit(model: string): OpenAIModelLimit {
    return resolveLimit(model, this.limitOverrides);
  }

  buildContextPacket(
    messages: LLMMessage[],
    opts?: BuildContextPacketOptions,
  ): ContextPacket {
    const model = opts?.model ?? this.defaultModel;
    const rendered = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    return {
      projectId: '',
      branchId: '',
      model,
      provider: this.providerId,
      timestamp: this.clock.now().toISOString(),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      includedMessageIds: [],
      includedMergeIds: [],
      includedWikiPageIds: [],
      tokenEstimate: estimateTokens(rendered),
      renderedPromptPreview: rendered,
      systemPreamble: '',
      truncated: false,
    };
  }

  countTokens(text: string): number {
    return estimateTokens(text);
  }

  async *streamCompletion(packet: ContextPacket): AsyncIterable<LLMChunk> {
    const model = packet.model || this.defaultModel;
    const limit = this.getLimit(model);
    const body = JSON.stringify({
      model,
      stream: true,
      messages: packet.messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: limit.maxOutputTokens,
    });

    const initHeaders: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'text/event-stream',
      authorization: `Bearer ${this.apiKey}`,
    };
    const init: {
      method: string;
      headers: Record<string, string>;
      body: string;
      signal?: AbortSignal;
    } = {
      method: 'POST',
      headers: initHeaders,
      body,
    };
    if (this.signal) init.signal = this.signal;

    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, init);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `OpenAIProvider: HTTP ${res.status} ${res.statusText}${detail ? ` — ${detail.slice(0, 500)}` : ''}`,
      );
    }
    if (!res.body) {
      throw new Error('OpenAIProvider: response has no body to stream');
    }

    let usage: OpenAIStreamEvent['usage'] | undefined;
    let sawFinish = false;
    for await (const event of parseOpenAISseStream(readableStreamToText(res.body))) {
      if (event.usage) usage = event.usage;
      const choice = event.choices?.[0];
      const content = choice?.delta?.content ?? '';
      if (content) {
        yield { content, done: false };
      }
      if (choice?.finish_reason) {
        sawFinish = true;
      }
    }

    const doneChunk: LLMChunk = { content: '', done: true };
    if (usage) {
      const u: LLMChunk['usage'] = {};
      if (usage.prompt_tokens !== undefined) u.promptTokens = usage.prompt_tokens;
      if (usage.completion_tokens !== undefined)
        u.completionTokens = usage.completion_tokens;
      if (usage.total_tokens !== undefined) u.totalTokens = usage.total_tokens;
      doneChunk.usage = u;
    }
    if (!sawFinish && !usage) {
      // Upstream never sent a finish_reason or usage; still emit terminal chunk
      // so consumers can rely on `done: true` marking end-of-stream.
    }
    yield doneChunk;
  }
}

export { DEFAULT_OPENAI_LIMITS, OPENAI_FALLBACK_LIMIT };
export type { OpenAIModelLimit };
