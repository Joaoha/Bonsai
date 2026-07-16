import { describe, it, expect } from 'vitest';
import {
  DEFAULT_OPENAI_LIMITS,
  OPENAI_FALLBACK_LIMIT,
  resolveLimit,
} from './limits.js';

describe('resolveLimit', () => {
  it('returns the built-in limit for a known model', () => {
    expect(resolveLimit('gpt-4o').contextTokens).toBe(128_000);
    expect(resolveLimit('gpt-4').contextTokens).toBe(8_192);
  });

  it('falls back for unknown models', () => {
    expect(resolveLimit('some-fine-tune-2099')).toEqual(OPENAI_FALLBACK_LIMIT);
  });

  it('honours overrides ahead of the default table', () => {
    const overrides = {
      'gpt-4o': { contextTokens: 200_000, maxOutputTokens: 4096 },
    };
    expect(resolveLimit('gpt-4o', overrides).contextTokens).toBe(200_000);
    // Non-overridden models still resolve from defaults
    expect(resolveLimit('gpt-4', overrides).contextTokens).toBe(
      DEFAULT_OPENAI_LIMITS['gpt-4']!.contextTokens,
    );
  });

  it('provider limit table is frozen (defensive against accidental mutation)', () => {
    expect(Object.isFrozen(DEFAULT_OPENAI_LIMITS)).toBe(true);
  });
});
