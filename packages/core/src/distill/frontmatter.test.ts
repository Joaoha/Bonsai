import { describe, it, expect } from 'vitest';
import { renderFrontmatter, parseFrontmatter } from './frontmatter.js';

describe('frontmatter', () => {
  it('renders primitives and arrays with deterministic key ordering', () => {
    const s = renderFrontmatter({ b: 2, a: 'hello world', tags: ['x', 'y'] });
    expect(s).toBe('---\na: "hello world"\nb: 2\ntags:\n  - x\n  - y\n---');
  });
  it('round-trips through parse', () => {
    const doc = renderFrontmatter({ title: 'T', n: 3 }) + '\n\nBody!';
    const { frontmatter, body } = parseFrontmatter(doc);
    expect(frontmatter['title']).toBe('T');
    expect(frontmatter['n']).toBe(3);
    expect(body).toBe('Body!');
  });
});
