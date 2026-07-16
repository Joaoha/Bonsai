// Pure ranking helpers. Adapters may layer BM25 / vector scores on top; core
// only ships the deterministic bag-of-terms baseline.

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length > 1);
}

/**
 * Score a doc against a query. Title matches are weighted 3x. Deterministic.
 */
export function scoreHit(
  query: string,
  doc: { title: string; content: string },
): number {
  const terms = tokenize(query);
  if (terms.length === 0) return 0;
  const titleTokens = tokenize(doc.title);
  const contentTokens = tokenize(doc.content);
  const titleCount = new Map<string, number>();
  for (const t of titleTokens) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
  const contentCount = new Map<string, number>();
  for (const t of contentTokens) contentCount.set(t, (contentCount.get(t) ?? 0) + 1);
  let score = 0;
  for (const term of terms) {
    score += 3 * (titleCount.get(term) ?? 0);
    score += contentCount.get(term) ?? 0;
  }
  return score;
}

/**
 * Return a substring centered on the first case-insensitive match of any
 * query term. When no match, returns the leading window. Ellipses bracket
 * partial excerpts.
 */
export function snippetAround(
  content: string,
  query: string,
  radius = 80,
): string {
  const terms = tokenize(query);
  const lower = content.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) {
    return content.length <= radius * 2
      ? content
      : content.slice(0, radius * 2) + '…';
  }
  const start = Math.max(0, idx - radius);
  const end = Math.min(content.length, idx + radius);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return prefix + content.slice(start, end) + suffix;
}
