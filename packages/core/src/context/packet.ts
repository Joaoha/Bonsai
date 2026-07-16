import type { Id } from '../domain/ids.js';

export interface ContextPacketMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * ContextPacket — inspectable representation of the exact context sent to
 * an LLM for a single completion. Directive B: every model call's context
 * must be inspectable.
 */
export interface ContextPacket {
  projectId: Id;
  branchId: Id;
  model: string;
  provider: string;
  timestamp: string;
  messages: ContextPacketMessage[];
  includedMessageIds: Id[];
  includedMergeIds: Id[];
  includedWikiPageIds: Id[];
  tokenEstimate: number;
  renderedPromptPreview: string;
  systemPreamble: string;
  truncated: boolean;
}

// Stable key ordering for JSON round-trip.
const PACKET_KEYS: Array<keyof ContextPacket> = [
  'projectId',
  'branchId',
  'model',
  'provider',
  'timestamp',
  'messages',
  'includedMessageIds',
  'includedMergeIds',
  'includedWikiPageIds',
  'tokenEstimate',
  'renderedPromptPreview',
  'systemPreamble',
  'truncated',
];

export function serializeContextPacket(packet: ContextPacket): string {
  const ordered: Record<string, unknown> = {};
  for (const k of PACKET_KEYS) {
    ordered[k] = packet[k];
  }
  return JSON.stringify(ordered);
}

export function deserializeContextPacket(json: string): ContextPacket {
  const raw = JSON.parse(json) as ContextPacket;
  return raw;
}
