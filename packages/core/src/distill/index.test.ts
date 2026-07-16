import { describe, it, expect } from 'vitest';
import { updateWikiIndex } from './index.js';

describe('updateWikiIndex', () => {
  it('dedupes by slug and sorts alphabetically', () => {
    const out = updateWikiIndex(
      [
        { slug: 'zulu', title: 'Zulu' },
        { slug: 'alpha', title: 'Alpha' },
      ],
      { slug: 'alpha', title: 'Alpha Renamed' },
    );
    expect(out).toEqual([
      { slug: 'alpha', title: 'Alpha Renamed' },
      { slug: 'zulu', title: 'Zulu' },
    ]);
  });
});
