import type { Id } from '../domain/ids.js';
import type { WikiPageInput } from '../interfaces/wiki-store.js';
import { renderFrontmatter } from './frontmatter.js';
import { slugifyTitle } from './slug.js';

export interface BuildWikiPageInput {
  title: string;
  branchId?: Id | null;
  mergeId?: Id | null;
  sources: Array<{ messageId: Id; role: string; content: string }>;
  distilled: { summary: string; wikilinks: string[] };
  createdAt: Date;
}

/**
 * Build a WikiPageInput (frontmatter + body) from a distilled summary.
 * Pure; the caller writes it via WikiStore.
 */
export function buildWikiPage(input: BuildWikiPageInput): WikiPageInput {
  const slug = slugifyTitle(input.title);
  const frontmatter: Record<string, unknown> = {
    title: input.title,
    createdAt: input.createdAt,
    sources: input.sources.map((s) => s.messageId),
  };
  if (input.branchId != null) frontmatter['branchId'] = input.branchId;
  if (input.mergeId != null) frontmatter['mergeId'] = input.mergeId;

  const bodyParts: string[] = [];
  bodyParts.push(`# ${input.title}`);
  bodyParts.push('');
  bodyParts.push(input.distilled.summary.trim());
  if (input.distilled.wikilinks.length > 0) {
    bodyParts.push('');
    bodyParts.push('## Sources');
    bodyParts.push('');
    for (const link of input.distilled.wikilinks) {
      bodyParts.push(`- [[${link}]]`);
    }
  }
  const body = bodyParts.join('\n') + '\n';

  return {
    slug,
    title: input.title,
    frontmatter,
    body: renderFrontmatter(frontmatter) + '\n\n' + body,
  };
}
