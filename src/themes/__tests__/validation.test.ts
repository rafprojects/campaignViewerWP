/**
 * Tests for src/themes/validation.ts
 *
 * Covers: validateTheme, isValidTheme — schema checks, edge cases
 */

import { describe, it, expect } from 'vitest';
import { validateTheme, isValidTheme } from '../validation';
import baseDefaults from '../definitions/_base.json';
import defaultDarkDef from '../definitions/default-dark.json';

// Helper: build a valid theme by deep-merging default-dark onto base
function makeValidTheme(overrides?: Record<string, unknown>): unknown {
  const base = JSON.parse(JSON.stringify(baseDefaults));
  const ext = JSON.parse(JSON.stringify(defaultDarkDef));
  const merged = deepMerge(base, ext);
  if (overrides) {
    return deepMerge(merged, overrides);
  }
  return merged;
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    const bVal = b[key];
    const aVal = result[key];
    if (
      bVal !== null && typeof bVal === 'object' && !Array.isArray(bVal) &&
      aVal !== null && typeof aVal === 'object' && !Array.isArray(aVal)
    ) {
      result[key] = deepMerge(aVal as Record<string, unknown>, bVal as Record<string, unknown>);
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// validateTheme — valid inputs
// ---------------------------------------------------------------------------

describe('validateTheme', () => {
  it('accepts a valid default-dark theme', () => {
    const theme = makeValidTheme();
    expect(() => validateTheme(theme)).not.toThrow();
  });

  it('accepts colorScheme "light"', () => {
    const theme = makeValidTheme({ colorScheme: 'light' });
    expect(() => validateTheme(theme)).not.toThrow();
  });

  it('accepts colorScheme "dark"', () => {
    const theme = makeValidTheme({ colorScheme: 'dark' });
    expect(() => validateTheme(theme)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateTheme — invalid inputs
// ---------------------------------------------------------------------------

describe('validateTheme (invalid)', () => {
  it('rejects null', () => {
    expect(() => validateTheme(null)).toThrow();
  });

  it('rejects non-object', () => {
    expect(() => validateTheme('string')).toThrow();
  });

  it('rejects missing id', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['id'];
    expect(() => validateTheme(theme)).toThrow(/id/);
  });

  it('rejects empty id', () => {
    const theme = makeValidTheme({ id: '' });
    expect(() => validateTheme(theme)).toThrow(/id/);
  });

  it('rejects invalid colorScheme', () => {
    const theme = makeValidTheme({ colorScheme: 'midnight' });
    expect(() => validateTheme(theme)).toThrow(/colorScheme/);
  });

  it('rejects missing colors section', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['colors'];
    expect(() => validateTheme(theme)).toThrow(/colors/);
  });

  it('rejects invalid color in colors.background', () => {
    const theme = makeValidTheme({ colors: { background: 'not-a-color' } }) as Record<string, unknown>;
    expect(() => validateTheme(theme)).toThrow(/background/);
  });

  it('rejects missing typography', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['typography'];
    expect(() => validateTheme(theme)).toThrow(/typography/);
  });

  it('rejects missing spacing', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['spacing'];
    expect(() => validateTheme(theme)).toThrow(/spacing/);
  });

  it('rejects primaryShade.light out of range', () => {
    const theme = makeValidTheme({
      colors: { primaryShade: { light: 15, dark: 5 } },
    });
    expect(() => validateTheme(theme)).toThrow(/primaryShade/);
  });
});

// ---------------------------------------------------------------------------
// isValidTheme
// ---------------------------------------------------------------------------

describe('isValidTheme', () => {
  it('returns true for a valid theme', () => {
    const theme = makeValidTheme();
    expect(isValidTheme(theme)).toBe(true);
  });

  it('returns false for null', () => {
    expect(isValidTheme(null)).toBe(false);
  });

  it('returns false for a theme with missing id', () => {
    const theme = makeValidTheme();
    delete (theme as Record<string, unknown>)['id'];
    expect(isValidTheme(theme)).toBe(false);
  });

  it('returns false for a theme with invalid color', () => {
    const theme = makeValidTheme({ colors: { background: 'xyz' } });
    expect(isValidTheme(theme)).toBe(false);
  });
});
