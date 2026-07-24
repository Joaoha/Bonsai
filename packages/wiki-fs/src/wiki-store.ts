import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseFrontmatter } from '@bonsai/core';
import type {
  WikiIndexEntry,
  WikiLogEntry,
  WikiPageInput,
  WikiStore,
} from '@bonsai/core';
import {
  assertAbsoluteRoot,
  assertSafeSlug,
  resolveIndexFile,
  resolveLogFile,
  resolvePageFile,
  resolvePagesDir,
} from './paths.js';

export interface FsWikiStoreOptions {
  /**
   * Absolute filesystem path that scopes every read/write. There is NO
   * default — the embedder must pick the directory explicitly.
   */
  root: string;
}

/**
 * Markdown-on-disk WikiStore. All I/O is scoped to `root/`; slugs are
 * validated and re-resolved to guarantee no write ever escapes that directory.
 *
 * Layout:
 *   <root>/pages/<slug>.md   — individual wiki pages (frontmatter + body)
 *   <root>/index.md          — full index of {slug, title}, one bullet per page
 *   <root>/log.md            — append-only chronological log of writes
 *
 * The constructor is I/O-free per the core boundary rule; `pages/` is created
 * lazily on the first write.
 */
export class FsWikiStore implements WikiStore {
  readonly root: string;
  private initialized = false;

  constructor(opts: FsWikiStoreOptions) {
    assertAbsoluteRoot(opts.root);
    this.root = path.resolve(opts.root);
  }

  async write(input: WikiPageInput): Promise<void> {
    assertSafeSlug(input.slug);
    await this.ensureDirs();
    const file = resolvePageFile(this.root, input.slug);
    await fs.writeFile(file, input.body, { encoding: 'utf8' });
  }

  async read(slug: string): Promise<WikiPageInput | null> {
    assertSafeSlug(slug);
    const file = resolvePageFile(this.root, slug);
    let body: string;
    try {
      body = await fs.readFile(file, 'utf8');
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
    const { frontmatter } = parseFrontmatter(body);
    const title =
      typeof frontmatter['title'] === 'string' ? frontmatter['title'] : slug;
    return { slug, title, frontmatter, body };
  }

  async list(): Promise<WikiIndexEntry[]> {
    const dir = resolvePagesDir(this.root);
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch (err) {
      if (isNotFound(err)) return [];
      throw err;
    }
    const out: WikiIndexEntry[] = [];
    for (const name of entries.sort()) {
      if (!name.endsWith('.md')) continue;
      const slug = name.slice(0, -3);
      // Skip anything that isn't a valid slug rather than throwing; a rogue
      // file in the pages dir must not brick list().
      try {
        assertSafeSlug(slug);
      } catch {
        continue;
      }
      const page = await this.read(slug);
      if (page) out.push({ slug: page.slug, title: page.title });
    }
    return out;
  }

  async appendLogEntry(entry: WikiLogEntry): Promise<void> {
    assertSafeSlug(entry.slug);
    await this.ensureDirs();
    const line = formatLogLine(entry) + '\n';
    await fs.appendFile(resolveLogFile(this.root), line, { encoding: 'utf8' });
  }

  async upsertIndex(index: WikiIndexEntry[]): Promise<void> {
    await this.ensureDirs();
    for (const entry of index) assertSafeSlug(entry.slug);
    const sorted = [...index].sort((a, b) => a.slug.localeCompare(b.slug));
    const body =
      '# Wiki index\n\n' +
      sorted
        .map((e) => `- [${escapeMd(e.title)}](pages/${e.slug}.md)`)
        .join('\n') +
      (sorted.length > 0 ? '\n' : '');
    await fs.writeFile(resolveIndexFile(this.root), body, { encoding: 'utf8' });
  }

  private async ensureDirs(): Promise<void> {
    if (this.initialized) return;
    await fs.mkdir(resolvePagesDir(this.root), { recursive: true });
    this.initialized = true;
  }
}

function formatLogLine(entry: WikiLogEntry): string {
  return `- ${entry.timestamp.toISOString()} ${entry.action} ${entry.slug} — ${escapeMd(
    entry.summary,
  )}`;
}

function escapeMd(s: string): string {
  return s.replace(/[\r\n]+/g, ' ').trim();
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  );
}
