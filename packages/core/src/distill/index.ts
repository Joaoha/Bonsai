export interface WikiIndexRow {
  slug: string;
  title: string;
}

/**
 * Update the sorted-by-slug wiki index. If the entry's slug already exists,
 * the new title replaces the stored one. Result is sorted alphabetically by slug.
 */
export function updateWikiIndex(
  current: WikiIndexRow[],
  entry: WikiIndexRow,
): WikiIndexRow[] {
  const byslug = new Map<string, WikiIndexRow>();
  for (const row of current) byslug.set(row.slug, row);
  byslug.set(entry.slug, entry);
  const out = Array.from(byslug.values());
  out.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return out;
}
