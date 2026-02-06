/**
 * Tests for src/themes/colorGen.ts
 *
 * Covers: generateColorScale, withAlpha, deriveDarkTuple, resolveColors
 */

import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import {
  generateColorScale,
  withAlpha,
  deriveDarkTuple,
  resolveColors,
} from '../colorGen';
import type { ThemeColors } from '../types';

// ---------------------------------------------------------------------------
// generateColorScale
// ---------------------------------------------------------------------------

describe('generateColorScale', () => {
  it('returns exactly 10 shades', () => {
    const shades = generateColorScale('#3b82f6');
    expect(shades).toHaveLength(10);
  });

  it('returns valid hex colors for every shade', () => {
    const shades = generateColorScale('#22c55e', 'light');
    for (const shade of shades) {
      expect(() => chroma(shade)).not.toThrow();
    }
  });

  it('shade 0 is lighter than shade 9', () => {
    const shades = generateColorScale('#3b82f6', 'dark');
    const lightness0 = chroma(shades[0]).get('lab.l');
    const lightness9 = chroma(shades[9]).get('lab.l');
    expect(lightness0).toBeGreaterThan(lightness9);
  });

  it('produces different ranges for light vs dark schemes', () => {
    const darkShades = generateColorScale('#3b82f6', 'dark');
    const lightShades = generateColorScale('#3b82f6', 'light');
    // The first shade in light mode should be lighter than in dark mode
    const darkL0 = chroma(darkShades[0]).get('lab.l');
    const lightL0 = chroma(lightShades[0]).get('lab.l');
    expect(lightL0).toBeGreaterThan(darkL0);
  });

  it('preserves approximate hue across all shades', () => {
    const baseHue = chroma('#3b82f6').get('hsl.h');
    const shades = generateColorScale('#3b82f6');
    for (const shade of shades) {
      const h = chroma(shade).get('hsl.h');
      // Allow some drift from desaturation but should stay in same range
      if (!Number.isNaN(h)) {
        expect(Math.abs(h - baseHue)).toBeLessThan(20);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// withAlpha
// ---------------------------------------------------------------------------

describe('withAlpha', () => {
  it('applies alpha transparency to a color', () => {
    const result = withAlpha('#ff0000', 0.5);
    const parsed = chroma(result);
    expect(parsed.alpha()).toBeCloseTo(0.5, 1);
  });

  it('returns a valid CSS color string', () => {
    const result = withAlpha('#3b82f6', 0.75);
    expect(() => chroma(result)).not.toThrow();
  });

  it('handles alpha=1 (fully opaque)', () => {
    const result = withAlpha('#3b82f6', 1);
    const parsed = chroma(result);
    expect(parsed.alpha()).toBeCloseTo(1, 1);
  });

  it('handles alpha=0 (fully transparent)', () => {
    const result = withAlpha('#3b82f6', 0);
    const parsed = chroma(result);
    expect(parsed.alpha()).toBeCloseTo(0, 1);
  });
});

// ---------------------------------------------------------------------------
// deriveDarkTuple
// ---------------------------------------------------------------------------

describe('deriveDarkTuple', () => {
  it('returns exactly 10 colors', () => {
    const tuple = deriveDarkTuple('#ffffff', '#1e293b', '#0f172a');
    expect(tuple).toHaveLength(10);
  });

  it('returns valid hex colors', () => {
    const tuple = deriveDarkTuple('#ffffff', '#1e293b', '#0f172a');
    for (const c of tuple) {
      expect(() => chroma(c)).not.toThrow();
    }
  });

  it('first element is lighter than last element', () => {
    const tuple = deriveDarkTuple('#ffffff', '#1e293b', '#0f172a');
    const firstL = chroma(tuple[0]).get('lab.l');
    const lastL = chroma(tuple[9]).get('lab.l');
    expect(firstL).toBeGreaterThan(lastL);
  });
});

// ---------------------------------------------------------------------------
// resolveColors
// ---------------------------------------------------------------------------

describe('resolveColors', () => {
  const baseColors: ThemeColors = {
    background: '#0f172a',
    surface: '#1e293b',
    surface2: '#334155',
    surface3: '#475569',
    text: '#ffffff',
    textMuted: '#94a3b8',
    textMuted2: '#64748b',
    border: '#334155',
    primary: '#3b82f6',
    primaryShade: { light: 6, dark: 5 },
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    accent: '#3b82f6',
    accentGreen: '#22c55e',
    accentPurple: '#a855f7',
  };

  it('expands primary to a 10-step array', () => {
    const resolved = resolveColors(baseColors, 'dark');
    expect(resolved.primary).toHaveLength(10);
  });

  it('derives dark tuple when not explicitly provided', () => {
    const resolved = resolveColors(baseColors, 'dark');
    expect(resolved.dark).toHaveLength(10);
  });

  it('uses explicit dark tuple when provided', () => {
    const customDark = Array.from({ length: 10 }, (_, i) =>
      chroma('#ffffff').darken(i * 0.3).hex(),
    );
    const colorsWithDark = { ...baseColors, dark: customDark };
    const resolved = resolveColors(colorsWithDark, 'dark');
    expect(resolved.dark).toEqual(customDark);
  });

  it('passes through simple color fields unchanged', () => {
    const resolved = resolveColors(baseColors, 'dark');
    expect(resolved.background).toBe('#0f172a');
    expect(resolved.surface).toBe('#1e293b');
    expect(resolved.text).toBe('#ffffff');
    expect(resolved.border).toBe('#334155');
    expect(resolved.success).toBe('#22c55e');
  });

  it('falls back to defaults for optional missing fields', () => {
    const minimal: ThemeColors = {
      background: '#000000',
      surface: '#111111',
      surface2: '#222222',
      surface3: '#333333',
      text: '#ffffff',
      textMuted: '#aaaaaa',
      textMuted2: '#888888',
      border: '#444444',
      primary: '#0077ff',
      primaryShade: { light: 6, dark: 5 },
      success: '#00ff00',
      // warning, error, info, accent, accentGreen, accentPurple missing
    } as ThemeColors;
    const resolved = resolveColors(minimal, 'dark');
    // Should not throw and should have fallback values
    expect(resolved.warning).toBeTruthy();
    expect(resolved.error).toBeTruthy();
    expect(resolved.info).toBeTruthy();
    expect(resolved.accent).toBeTruthy();
  });

  it('handles primary as an object with base+shades', () => {
    const colorsWithObj = {
      ...baseColors,
      primary: { base: '#3b82f6', shades: 10 },
    };
    const resolved = resolveColors(colorsWithObj, 'dark');
    expect(resolved.primary).toHaveLength(10);
  });
});
