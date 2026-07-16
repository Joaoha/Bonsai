import { describe, it, expect } from 'vitest';
import { buildWikiPage } from './page.js';

describe('buildWikiPage', () => {
  it('emits frontmatter with title, sources, createdAt and body with summary + wikilinks', () => {
    const page = buildWikiPage({
      title: 'React Context Patterns',
      branchId: 'b1',
      sources: [{ messageId: 'm1', role: 'user', content: 'hi' }],
      distilled: { summary: 'Use context for state.', wikilinks: ['react', 'state'] },
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    expect(page.slug).toBe('react-context-patterns');
    expect(page.title).toBe('React Context Patterns');
    expect(page.body).toContain('title: "React Context Patterns"');
    expect(page.body).toContain('Use context for state.');
    expect(page.body).toContain('[[react]]');
    expect(page.body).toContain('[[state]]');
  });
});
