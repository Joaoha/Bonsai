import type {
  BuildContextPacketOptions,
  ContextPacket,
  LLMChunk,
  LLMMessage,
  LLMProvider,
} from '@bonsai/core';

export const FAKE_PROVIDER_ID = 'fake-openai';

/**
 * Deterministic LLMProvider for the headless demo. Emits a canned response
 * derived from the last user message, so the demo asserts stable output
 * without any network call.
 */
export class FakeProvider implements LLMProvider {
  readonly providerId = FAKE_PROVIDER_ID;

  buildContextPacket(
    messages: LLMMessage[],
    opts: BuildContextPacketOptions = {},
  ): ContextPacket {
    return {
      projectId: 'fake-project',
      branchId: 'fake-branch',
      model: opts.model ?? 'fake-model',
      provider: this.providerId,
      timestamp: '1970-01-01T00:00:00.000Z',
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
    const seed = lastUser?.content ?? '(no user prompt)';
    const reply = `echo:${seed}`;
    // Emit in a couple of chunks so streaming path is exercised.
    const mid = Math.max(1, Math.floor(reply.length / 2));
    yield { content: reply.slice(0, mid), done: false };
    yield { content: reply.slice(mid), done: true };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
