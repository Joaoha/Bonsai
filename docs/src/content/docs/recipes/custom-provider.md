---
title: Custom Provider
description: Implement the LLMProvider interface for a non-OpenAI-compatible model or an in-process fake.
---

**Concepts you should know:** [ContextPacket](/concepts/context-packet/).

`@bonsai/core` talks to models through the `LLMProvider` interface. `@bonsai/provider-openai` is one implementation, built for any endpoint that speaks the OpenAI `/chat/completions` streaming contract — it is not required. Implement `LLMProvider` directly for a different vendor's SDK, a local model runner, or a deterministic fake for tests.

## The interface

```ts
interface LLMProvider {
  readonly providerId: string;
  streamCompletion(packet: ContextPacket): AsyncIterable<LLMChunk>;
  buildContextPacket(messages: LLMMessage[], opts?: BuildContextPacketOptions): ContextPacket;
  countTokens?(text: string): number;
}
```

- **`providerId`** — a short stable string (`'openai'`, `'anthropic'`, `'fake'`). Bonsai stamps it onto every `ContextPacket` and every persisted assistant `Message`, so keep it constant across restarts.
- **`buildContextPacket`** — pure and synchronous. Given already-assembled `LLMMessage[]`, render them into a `ContextPacket`. No network calls here — `@bonsai/core` calls it internally when building the merge-summary prompt (see `Bonsai.merge`).
- **`streamCompletion`** — the only method that talks to the network. It receives the `ContextPacket` that `Bonsai.chat()` assembled and must yield `LLMChunk`s (`{ content, done, usage?, sessionId?, metadata? }`), ending with one chunk where `done: true`.
- **`countTokens`** — optional. If present, callers doing their own budget accounting can use it instead of a rough estimate.

## A minimal fake provider

This mirrors the `FakeProvider` used by `examples/minimal-node`'s CI smoke test — copy it for deterministic tests instead of hitting a real API:

```ts
import type {
  BuildContextPacketOptions,
  ContextPacket,
  LLMChunk,
  LLMMessage,
  LLMProvider,
} from '@bonsai/core';

export class FakeProvider implements LLMProvider {
  readonly providerId = 'fake';

  buildContextPacket(
    messages: LLMMessage[],
    opts: BuildContextPacketOptions = {},
  ): ContextPacket {
    return {
      projectId: 'fake-project',
      branchId: 'fake-branch',
      model: opts.model ?? 'fake-model',
      provider: this.providerId,
      timestamp: new Date().toISOString(),
      messages,
      includedMessageIds: [],
      includedMergeIds: [],
      includedWikiPageIds: [],
      tokenEstimate: 0,
      renderedPromptPreview: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      systemPreamble: '',
      truncated: false,
    };
  }

  async *streamCompletion(packet: ContextPacket): AsyncIterable<LLMChunk> {
    const lastUser = [...packet.messages].reverse().find((m) => m.role === 'user');
    yield { content: `echo:${lastUser?.content ?? ''}`, done: true };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
```

Pass an instance of it as `provider` in the `Bonsai` constructor — nothing else in `@bonsai/core` changes.

## Streaming and cancellation

- Yield as many chunks as you like before the final `done: true` chunk; `Bonsai.chat()` concatenates `chunk.content` across all of them into the persisted assistant message.
- To support cancellation, accept an `AbortSignal` in your provider's constructor and thread it into your underlying HTTP client — see `OpenAIProviderOptions.signal` in `@bonsai/provider-openai` for the pattern.
- Report `usage` (`promptTokens` / `completionTokens` / `totalTokens`) on the final chunk if your API returns it. `@bonsai/core` does not require it, but it is useful for callers displaying cost.

## Reference implementation

Read [`@bonsai/provider-openai`'s `OpenAIProvider`](/api/provider-openai/classes/openaiprovider/) for a complete adapter: SSE parsing, per-model token limits, and injectable `fetch` / `clock` for tests.
