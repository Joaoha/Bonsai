import { describe, it, expect } from 'vitest';
import { slugifyTitle, disambiguate } from './slug.js';

describe('slugifyTitle', () => {
  it('converts to kebab-case ASCII', () => {
    expect(slugifyTitle('Hello, World!')).toBe('hello-world');
    expect(slugifyTitle('React Context Patterns')).toBe('react-context-patterns');
  });
  it('handles empty / punctuation-only', () => {
    expect(slugifyTitle('   ')).toBe('untitled');
    expect(slugifyTitle('!!!')).toBe('untitled');
  });
  it('caps length', () => {
    const long = 'a'.repeat(200);
    expect(slugifyTitle(long).length).toBeLessThanOrEqual(64);
  });
});

describe('disambiguate', () => {
  it('leaves unique slug alone', () => {
    expect(disambiguate('foo', new Set())).toBe('foo');
  });
  it('appends -2, -3 on collision', () => {
    expect(disambiguate('foo', new Set(['foo']))).toBe('foo-2');
    expect(disambiguate('foo', new Set(['foo', 'foo-2']))).toBe('foo-3');
  });
});
