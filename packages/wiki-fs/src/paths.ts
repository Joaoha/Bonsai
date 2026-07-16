import * as path from 'node:path';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export class WikiFsPathError extends Error {
  override readonly name = 'WikiFsPathError';
}

export function assertAbsoluteRoot(root: string): void {
  if (typeof root !== 'string' || root.length === 0) {
    throw new WikiFsPathError('wiki root must be a non-empty string');
  }
  if (!path.isAbsolute(root)) {
    throw new WikiFsPathError(
      `wiki root must be an absolute path (got: ${JSON.stringify(root)})`,
    );
  }
  if (root.includes('\0')) {
    throw new WikiFsPathError('wiki root must not contain NUL');
  }
}

export function assertSafeSlug(slug: string): void {
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new WikiFsPathError('slug must be a non-empty string');
  }
  if (slug.length > 128) {
    throw new WikiFsPathError('slug exceeds 128 characters');
  }
  if (!SLUG_RE.test(slug)) {
    throw new WikiFsPathError(
      `slug must match ${SLUG_RE.source} (got: ${JSON.stringify(slug)})`,
    );
  }
}

/**
 * Resolve a slug to an absolute file path guaranteed to live inside `root`.
 * Rejects traversal attempts (`..`, absolute slugs, path separators, NUL) so
 * callers can never write outside the configured wiki directory — even if a
 * distiller emits a hostile slug.
 */
export function resolvePageFile(root: string, slug: string): string {
  assertAbsoluteRoot(root);
  assertSafeSlug(slug);
  const normalizedRoot = path.resolve(root);
  const pagesDir = path.join(normalizedRoot, 'pages');
  const target = path.resolve(pagesDir, `${slug}.md`);
  const withSep = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : normalizedRoot + path.sep;
  if (!target.startsWith(withSep)) {
    throw new WikiFsPathError(
      `resolved page path escapes wiki root: ${target}`,
    );
  }
  return target;
}

export function resolveIndexFile(root: string): string {
  assertAbsoluteRoot(root);
  return path.join(path.resolve(root), 'index.md');
}

export function resolveLogFile(root: string): string {
  assertAbsoluteRoot(root);
  return path.join(path.resolve(root), 'log.md');
}

export function resolvePagesDir(root: string): string {
  assertAbsoluteRoot(root);
  return path.join(path.resolve(root), 'pages');
}
