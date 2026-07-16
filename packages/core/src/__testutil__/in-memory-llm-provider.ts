import type {
  LLMProvider,
  LLMMessage,
  LLMChunk,
  BuildContextPacketOptions,
} from '../interfaces/llm-provider.js';
import type { ContextPacket } from '../context/packet.js';

/**
 * Deterministic in-memory provider. Streams a scripted list of chunks and
 * echoes the last user message back with a fixed prefix. For tests only.
 */
export class InMemoryLLMProvider implements LLMProvider {
  readonly providerId = 'in-memory';
  private script: string | null = null;

  setScript(text: string): void {
    this.script = text;
  }

  buildContextPacket(
    messages: LLMMessage[],
    opts?: BuildContextPacketOptions,
  ): ContextPacket {
    const rendered = messages.map((m) => `${m.role}: ${m.content}`).join('\n\n');
    return {
      projectId: '',
      branchId: '',
      model: opts?.model ?? 'in-memory',
      provider: this.providerId,
      timestamp: new Date(0).toISOString(),
      messages,
      includedMessageIds: [],
      includedMergeIds: [],
      includedWikiPageIds: [],
      tokenEstimate: Math.ceil(rendered.length / 4),
      renderedPromptPreview: rendered,
      systemPreamble: '',
      truncated: false,
    };
  }

  async *streamCompletion(_packet: ContextPacket): AsyncIterable<LLMChunk> {
    void _packet;
    const text = this.script ?? 'ok';
    yield { content: text, done: false };
    yield { content: '', done: true };
  }

  countTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
