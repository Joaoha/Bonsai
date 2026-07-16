import { describe, it, expect } from 'vitest';
import { scoreHit, snippetAround } from './ranking.js';

describe('scoreHit', () => {
  it('scores title matches higher than content matches', () => {
    const inTitle = scoreHit('react', { title: 'React Context', content: 'x'.repeat(50) });
    const inContent = scoreHit('react', { title: 'Other', content: 'we used react here' });
    expect(inTitle).toBeGreaterThan(inContent);
  });
  it('returns 0 for empty query', () => {
    expect(scoreHit('', { title: 't', content: 'c' })).toBe(0);
  });
});

describe('snippetAround', () => {
  it('centers snippet on first match', () => {
    const s = snippetAround(
      'aaaaaaaaaa the important word bbbbbbbbbb',
      'important',
      10,
    );
    expect(s).toContain('important');
    expect(s.startsWith('…')).toBe(true);
  });
  it('returns leading window when no match', () => {
    const s = snippetAround('zzzz'.repeat(200), 'nomatch', 20);
    expect(s.endsWith('…')).toBe(true);
  });
});
