/**
 * Rough token estimator: 4 chars ≈ 1 token, ceiling. Deterministic; used for
 * budget arithmetic in ContextPacket assembly. Adapters that need higher
 * fidelity (e.g. tiktoken) may implement LLMProvider.countTokens.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Given a chronological list of items (oldest first), keep the newest suffix
 * that fits into `budget`. Deterministic: drops entire items from the front.
 */
export function truncateFromOldest<T>(
  items: T[],
  sizeOf: (t: T) => number,
  budget: number,
): { kept: T[]; dropped: T[]; totalSize: number } {
  const kept: T[] = [];
  let total = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it === undefined) continue;
    const size = sizeOf(it);
    if (total + size > budget) {
      break;
    }
    kept.unshift(it);
    total += size;
  }
  const dropped = items.slice(0, items.length - kept.length);
  return { kept, dropped, totalSize: total };
}
