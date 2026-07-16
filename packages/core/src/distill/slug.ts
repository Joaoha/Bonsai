const MAX_SLUG_LEN = 64;

/**
 * Convert a title to an ASCII, kebab-case slug. Deterministic and pure;
 * no filesystem checks. Callers doing filesystem writes must additionally
 * apply the wiki-fs safety guards.
 */
export function slugifyTitle(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join('-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const truncated = base.slice(0, MAX_SLUG_LEN).replace(/-+$/g, '');
  return truncated || 'untitled';
}

/**
 * If `slug` is already taken, append `-2`, `-3`, … until unique against
 * the `taken` set. Pure; does not mutate `taken`.
 */
export function disambiguate(slug: string, taken: Set<string>): string {
  if (!taken.has(slug)) return slug;
  let n = 2;
  while (taken.has(`${slug}-${n}`)) n++;
  return `${slug}-${n}`;
}
