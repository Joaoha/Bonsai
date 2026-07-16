import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  WikiFsPathError,
  assertAbsoluteRoot,
  assertSafeSlug,
  resolvePageFile,
} from './paths.js';

const ROOT = path.resolve('/tmp/bonsai-wiki-test-root');

describe('assertAbsoluteRoot', () => {
  it('accepts an absolute path', () => {
    expect(() => assertAbsoluteRoot(ROOT)).not.toThrow();
  });
  it('rejects an empty string', () => {
    expect(() => assertAbsoluteRoot('')).toThrow(WikiFsPathError);
  });
  it('rejects a relative path', () => {
    expect(() => assertAbsoluteRoot('wiki')).toThrow(WikiFsPathError);
    expect(() => assertAbsoluteRoot('./wiki')).toThrow(WikiFsPathError);
    expect(() => assertAbsoluteRoot('../wiki')).toThrow(WikiFsPathError);
  });
  it('rejects a NUL byte', () => {
    expect(() => assertAbsoluteRoot('/tmp/wiki\0')).toThrow(WikiFsPathError);
  });
});

describe('assertSafeSlug', () => {
  it('accepts kebab-case ASCII slugs', () => {
    expect(() => assertSafeSlug('react')).not.toThrow();
    expect(() => assertSafeSlug('react-hooks')).not.toThrow();
    expect(() => assertSafeSlug('a1-b2')).not.toThrow();
  });
  it.each([
    ['empty', ''],
    ['dot', '.'],
    ['dotdot', '..'],
    ['leading dot', '.hidden'],
    ['slash', 'a/b'],
    ['backslash', 'a\\b'],
    ['uppercase', 'React'],
    ['space', 'react hooks'],
    ['tilde', '~root'],
    ['nul', 'react\0'],
    ['dotdot-embedded', 'a..b'],
    ['url-encoded', '%2e%2e'],
    ['absolute-unix', '/etc/passwd'],
    ['absolute-win', 'C:\\evil'],
    ['leading dash', '-x'],
    ['long', 'a'.repeat(129)],
  ])('rejects %s', (_label, slug) => {
    expect(() => assertSafeSlug(slug as string)).toThrow(WikiFsPathError);
  });
});

describe('resolvePageFile', () => {
  it('resolves a safe slug inside root/pages', () => {
    const p = resolvePageFile(ROOT, 'react');
    expect(p).toBe(path.join(ROOT, 'pages', 'react.md'));
  });
  it('rejects traversal via slug', () => {
    for (const bad of ['..', '../', '../etc', '..\\etc', '/etc/passwd']) {
      expect(() => resolvePageFile(ROOT, bad)).toThrow(WikiFsPathError);
    }
  });
  it('rejects NUL in slug', () => {
    expect(() => resolvePageFile(ROOT, 'react\0.md')).toThrow(WikiFsPathError);
  });
  it('rejects a relative root', () => {
    expect(() => resolvePageFile('wiki', 'react')).toThrow(WikiFsPathError);
  });
});
