/**
 * Provider limit table for OpenAI-compatible endpoints.
 *
 * Consumed by @bonsai/core's ContextPacket assembly to bound token budgets.
 * Values are conservative context-window sizes (input+output). Embedders may
 * override or extend via {@link OpenAIProviderOptions.limits}.
 */
export interface OpenAIModelLimit {
  /** Max total tokens the model accepts (prompt + completion). */
  contextTokens: number;
  /** Max tokens the model may emit in a single completion. */
  maxOutputTokens: number;
}

export const DEFAULT_OPENAI_LIMITS: Readonly<Record<string, OpenAIModelLimit>> =
  Object.freeze({
    'gpt-4o': { contextTokens: 128_000, maxOutputTokens: 16_384 },
    'gpt-4o-mini': { contextTokens: 128_000, maxOutputTokens: 16_384 },
    'gpt-4-turbo': { contextTokens: 128_000, maxOutputTokens: 4_096 },
    'gpt-4': { contextTokens: 8_192, maxOutputTokens: 4_096 },
    'gpt-3.5-turbo': { contextTokens: 16_385, maxOutputTokens: 4_096 },
  });

/**
 * Conservative fallback used when a model id is not in the table. Small enough
 * to avoid silent overflow, large enough to be useful for the merge-summary
 * prompts core issues via {@link LLMProvider.buildContextPacket}.
 */
export const OPENAI_FALLBACK_LIMIT: OpenAIModelLimit = Object.freeze({
  contextTokens: 8_192,
  maxOutputTokens: 4_096,
});

export function resolveLimit(
  model: string,
  overrides?: Readonly<Record<string, OpenAIModelLimit>>,
): OpenAIModelLimit {
  return (
    overrides?.[model] ?? DEFAULT_OPENAI_LIMITS[model] ?? OPENAI_FALLBACK_LIMIT
  );
}
