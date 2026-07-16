import type { Message } from '../domain/message.js';
import type { LLMMessage } from '../interfaces/llm-provider.js';

/**
 * Build the deterministic prompt used to summarize a branch prior to merge.
 * Given the same source name and messages, always returns the same prompt.
 */
export function buildMergeSummaryPrompt(
  sourceBranchName: string,
  sourceMessages: Message[],
): LLMMessage[] {
  const system: LLMMessage = {
    role: 'system',
    content:
      'You summarize a conversation branch for a merge into its parent. ' +
      'Output a concise, factual summary (5-15 sentences) that captures the ' +
      'durable knowledge and decisions from the branch. No preamble; just the summary.',
  };
  const body = sourceMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n\n');
  const user: LLMMessage = {
    role: 'user',
    content: `Summarize branch "${sourceBranchName}" for merge:\n\n${body}`,
  };
  return [system, user];
}
