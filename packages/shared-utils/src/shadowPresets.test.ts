import { describe, expect, it } from 'vitest';

import { resolveBoxShadow } from './shadowPresets';

describe('resolveBoxShadow', () => {
  it('returns the custom string for the "custom" preset', () => {
    expect(resolveBoxShadow('custom', '0 1px 2px red')).toBe('0 1px 2px red');
  });

  it('returns "none" for the "custom" preset when the custom string is empty', () => {
    expect(resolveBoxShadow('custom', '')).toBe('none');
  });

  it('resolves named presets to their CSS box-shadow value', () => {
    expect(resolveBoxShadow('none', '')).toBe('none');
    expect(resolveBoxShadow('subtle', '')).toBe('0 2px 8px rgba(0,0,0,0.15)');
    expect(resolveBoxShadow('medium', '')).toBe('0 4px 16px rgba(0,0,0,0.25)');
    expect(resolveBoxShadow('strong', '')).toBe('0 8px 30px rgba(0,0,0,0.35)');
  });

  it('falls back to "none" for an unknown preset key', () => {
    // Defensive path: an out-of-range key (e.g. from stale persisted settings)
    // resolves to "none" rather than undefined.
    expect(resolveBoxShadow('bogus' as never, '')).toBe('none');
  });
});
