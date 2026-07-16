import type { ContextPacket } from '../context/packet.js';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface LLMChunk {
  content: string;
  done: boolean;
  usage?: LLMUsage;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface BuildContextPacketOptions {
  model?: string;
}

export interface LLMProvider {
  readonly providerId: string;
  streamCompletion(packet: ContextPacket): AsyncIterable<LLMChunk>;
  buildContextPacket(
    messages: LLMMessage[],
    opts?: BuildContextPacketOptions,
  ): ContextPacket;
  countTokens?(text: string): number;
}
