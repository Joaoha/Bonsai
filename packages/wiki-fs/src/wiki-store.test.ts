import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { renderFrontmatter } from '@bonsai/core';
import { FsWikiStore } from './wiki-store.js';
import { WikiFsPathError } from './paths.js';

async function mkTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bonsai-wiki-'));
}

function pageBody(title: string, extra: Record<string, unknown> = {}) {
  const fm = renderFrontmatter({ title, ...extra });
  return `${fm}\n\nHello ${title}.`;
}

describe('FsWikiStore', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkTmp();
  });
  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('rejects a relative root at construction (no filesystem default)', () => {
    expect(() => new FsWikiStore({ root: 'wiki' })).toThrow(WikiFsPathError);
    expect(() => new FsWikiStore({ root: '' })).toThrow(WikiFsPathError);
  });

  it('writes and reads a page round-trip', async () => {
    const store = new FsWikiStore({ root });
    const body = pageBody('React');
    await store.write({
      slug: 'react',
      title: 'React',
      frontmatter: { title: 'React' },
      body,
    });
    const file = path.join(root, 'pages', 'react.md');
    await expect(fs.stat(file)).resolves.toBeDefined();

    const read = await store.read('react');
    expect(read).not.toBeNull();
    expect(read?.slug).toBe('react');
    expect(read?.title).toBe('React');
    expect(read?.body).toBe(body);
    expect(read?.frontmatter['title']).toBe('React');
  });

  it('read returns null for a missing slug', async () => {
    const store = new FsWikiStore({ root });
    expect(await store.read('nope')).toBeNull();
  });

  it('list returns pages sorted by slug', async () => {
    const store = new FsWikiStore({ root });
    await store.write({
      slug: 'zeta',
      title: 'Zeta',
      frontmatter: { title: 'Zeta' },
      body: pageBody('Zeta'),
    });
    await store.write({
      slug: 'alpha',
      title: 'Alpha',
      frontmatter: { title: 'Alpha' },
      body: pageBody('Alpha'),
    });
    const list = await store.list();
    expect(list.map((e) => e.slug)).toEqual(['alpha', 'zeta']);
    expect(list.map((e) => e.title)).toEqual(['Alpha', 'Zeta']);
  });

  it('list returns [] when pages dir does not yet exist', async () => {
    const store = new FsWikiStore({ root });
    expect(await store.list()).toEqual([]);
  });

  it('list skips non-.md and invalid-slug files without throwing', async () => {
    const store = new FsWikiStore({ root });
    await store.write({
      slug: 'react',
      title: 'React',
      frontmatter: { title: 'React' },
      body: pageBody('React'),
    });
    // Drop a rogue non-page file and one with an invalid slug alongside.
    await fs.writeFile(path.join(root, 'pages', 'README.txt'), 'ignore me');
    await fs.writeFile(path.join(root, 'pages', 'NotASlug.md'), 'ignore me');
    const list = await store.list();
    expect(list.map((e) => e.slug)).toEqual(['react']);
  });

  it('appendLogEntry writes newline-terminated lines to log.md', async () => {
    const store = new FsWikiStore({ root });
    const t1 = new Date('2026-01-02T03:04:05.000Z');
    const t2 = new Date('2026-01-02T03:04:06.000Z');
    await store.appendLogEntry({
      timestamp: t1,
      slug: 'react',
      action: 'created',
      summary: 'first',
    });
    await store.appendLogEntry({
      timestamp: t2,
      slug: 'react',
      action: 'updated',
      summary: 'second\nwith newline',
    });
    const log = await fs.readFile(path.join(root, 'log.md'), 'utf8');
    expect(log.split('\n')).toEqual([
      `- ${t1.toISOString()} created react — first`,
      `- ${t2.toISOString()} updated react — second with newline`,
      '',
    ]);
  });

  it('upsertIndex writes a sorted markdown index', async () => {
    const store = new FsWikiStore({ root });
    await store.upsertIndex([
      { slug: 'zeta', title: 'Zeta' },
      { slug: 'alpha', title: 'Alpha' },
    ]);
    const idx = await fs.readFile(path.join(root, 'index.md'), 'utf8');
    expect(idx).toBe(
      '# Wiki index\n\n- [Alpha](pages/alpha.md)\n- [Zeta](pages/zeta.md)\n',
    );
  });

  it('upsertIndex on an empty list writes just the header', async () => {
    const store = new FsWikiStore({ root });
    await store.upsertIndex([]);
    const idx = await fs.readFile(path.join(root, 'index.md'), 'utf8');
    expect(idx).toBe('# Wiki index\n\n');
  });

  it('write rejects a traversal slug and does not create anything outside root', async () => {
    const store = new FsWikiStore({ root });
    const outside = path.join(path.dirname(root), 'evil.md');
    await expect(
      store.write({
        slug: '../evil',
        title: 'Evil',
        frontmatter: {},
        body: 'oops',
      }),
    ).rejects.toThrow(WikiFsPathError);
    await expect(fs.stat(outside)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('write rejects an absolute-path-like slug', async () => {
    const store = new FsWikiStore({ root });
    await expect(
      store.write({
        slug: '/etc/passwd',
        title: 'x',
        frontmatter: {},
        body: 'x',
      }),
    ).rejects.toThrow(WikiFsPathError);
  });

  it('read rejects a hostile slug even for lookup', async () => {
    const store = new FsWikiStore({ root });
    await expect(store.read('../etc')).rejects.toThrow(WikiFsPathError);
    await expect(store.read('\0')).rejects.toThrow(WikiFsPathError);
  });

  it('appendLogEntry rejects a hostile slug', async () => {
    const store = new FsWikiStore({ root });
    await expect(
      store.appendLogEntry({
        timestamp: new Date('2026-01-01T00:00:00.000Z'),
        slug: '../evil',
        action: 'created',
        summary: 'x',
      }),
    ).rejects.toThrow(WikiFsPathError);
  });

  it('upsertIndex rejects a hostile slug in the payload', async () => {
    const store = new FsWikiStore({ root });
    await expect(
      store.upsertIndex([{ slug: '../evil', title: 'x' }]),
    ).rejects.toThrow(WikiFsPathError);
  });

  it('constructor performs no filesystem I/O', async () => {
    const nonexistent = path.join(root, 'never-created');
    // Should not throw and should not create the directory.
    const store = new FsWikiStore({ root: nonexistent });
    expect(store.root).toBe(nonexistent);
    await expect(fs.stat(nonexistent)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});
