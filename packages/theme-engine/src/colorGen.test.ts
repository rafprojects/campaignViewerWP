/**
 * Tests for src/themes/colorGen.ts
 *
 * Covers: generateColorScale, withAlpha, deriveDarkTuple, resolveColors
 */

import { describe, it, expect } from 'vitest';
import chroma from 'chroma-js';
import {
  generateColorScale,
  mapOklchToSrgbHex,
  withAlpha,
  deriveDarkTuple,
  deriveBorderStrong,
  resolveColors,
  derivePrimaryShade,
  inkContrastGround,
  selectPrimaryShadeIndex,
  PRIMARY_SHADE_CONTRAST_MIN,
} from './colorGen';
import { bundledThemeDefinitions } from './bundledThemes';
import type { ThemeColors } from './types';

function hueDelta(h1: number, h2: number): number {
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) return 0;
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
}

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
    const lightness0 = chroma(shades[0]!).get('lab.l');
    const lightness9 = chroma(shades[9]!).get('lab.l');
    expect(lightness0).toBeGreaterThan(lightness9);
  });

  it('produces different ranges for light vs dark schemes', () => {
    const darkShades = generateColorScale('#3b82f6', 'dark');
    const lightShades = generateColorScale('#3b82f6', 'light');
    // The first shade in light mode should be lighter than in dark mode
    const darkL0 = chroma(darkShades[0]!).get('lab.l');
    const lightL0 = chroma(lightShades[0]!).get('lab.l');
    expect(lightL0).toBeGreaterThan(darkL0);
  });

  it('preserves approximate hue across all shades', () => {
    const baseHue = chroma('#3b82f6').oklch()[2];
    const shades = generateColorScale('#3b82f6');
    for (const shade of shades) {
      const h = chroma(shade).oklch()[2];
      if (Number.isFinite(h) && Number.isFinite(baseHue)) {
        expect(hueDelta(baseHue, h)).toBeLessThan(5);
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
    const firstL = chroma(tuple[0]!).get('lab.l');
    const lastL = chroma(tuple[9]!).get('lab.l');
    expect(firstL).toBeGreaterThan(lastL);
  });
});

describe('deriveBorderStrong', () => {
  it.each([
    ['#102530', 'rig-cyan surface'],
    ['#1a1b26', 'tokyo-night surface'],
    ['#fffbeb', 'sunset-boulevard surface'],
    ['#f3f5f4', 'forest-whisper surface'],
  ])('clears 3:1 against %s (%s)', (surface) => {
    const derived = deriveBorderStrong(surface);
    expect(chroma.contrast(derived, surface)).toBeGreaterThanOrEqual(3);
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

  it('derives surface2/3, textMuted2, and primaryShade when omitted (P74-N / P75-F)', () => {
    const rig: ThemeColors = {
      background: '#08141b',
      surface: '#102530',
      surfaceRaised: '#1a3542',
      text: '#eef8fb',
      textMuted: '#9db4bf',
      border: '#22414f',
      borderStrong: '#577577',
      primary: '#1ad1c4',
      success: '#56b93e',
      warning: '#f5b12b',
      error: '#ff6b5e',
      info: '#1ad1c4',
    };
    const resolved = resolveColors(rig, 'dark');
    expect(resolved.surfaceRaised).toBe('#1a3542');
    expect(resolved.borderStrong).toBe('#577577');
    expect(resolved.surface2).toMatch(/^#/);
    expect(resolved.surface3).toMatch(/^#/);
    expect(resolved.textMuted2).toMatch(/^#/);
    expect(resolved.primaryShade).toEqual(derivePrimaryShade(rig));
  });

  it('falls surfaceRaised back to surface2 when unset', () => {
    const resolved = resolveColors(baseColors, 'dark');
    expect(resolved.surfaceRaised).toBe(baseColors.surface2);
  });

  it('derives borderStrong instead of aliasing to border when unset', () => {
    const resolved = resolveColors(baseColors, 'dark');
    expect(resolved.borderStrong).not.toBe(resolved.border);
    expect(chroma.contrast(resolved.borderStrong, resolved.surface)).toBeGreaterThanOrEqual(3);
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

// ---------------------------------------------------------------------------
// P75-F — OKLCH ramp + primaryShade criterion
// ---------------------------------------------------------------------------

describe('mapOklchToSrgbHex (P75-F gamut mapping)', () => {
  // COLOR-SPEC.md round-3 Cyberpunk table — naive clip vs chroma reduction.
  const cp = chroma('#ff2d95').oklch();
  const C = cp[1]!;
  const H = cp[2]!;

  it.each([
    [0.95, '#ffe7ee', 1],
    [0.88, '#ffc5d8', 1],
    [0.78, '#ff8eb8', 1],
    [0.68, '#ff4199', 1],
  ] as const)('Cyberpunk L=%s maps to %s (hue drift < %s°)', (L, hex, maxDrift) => {
    const mapped = mapOklchToSrgbHex(L, C, H);
    expect(mapped).toBe(hex);
    expect(hueDelta(H, chroma(mapped).oklch()[2]!)).toBeLessThan(maxDrift);
    expect(chroma.oklch(L, C, H).clipped()).toBe(true);
    expect(chroma(mapped).clipped()).toBe(false);
  });

  it('does not channel-clip: naive L=0.95 is #ff9af0 with ~25° hue shift', () => {
    const naive = chroma.oklch(0.95, C, H);
    expect(naive.clipped()).toBe(true);
    expect(naive.hex()).toBe('#ff9af0');
    expect(hueDelta(H, chroma(naive.hex()).oklch()[2]!)).toBeGreaterThan(20);
  });
});

describe('generateColorScale OKLCH properties (P75-F)', () => {
  const sampleAccents: string[] = [];
  for (let deg = 0; deg < 360; deg += 15) {
    for (const c of [0.08, 0.16, 0.24]) {
      const col = chroma.oklch(0.65, c, deg);
      if (!col.clipped()) sampleAccents.push(col.hex());
    }
  }
  sampleAccents.push('#1ad1c4', '#ff2d95', '#fe8019', '#6200ee', '#7aa2f7', '#3b82f6');

  it('keeps every rung inside sRGB for a broad accent sample', () => {
    for (const accent of sampleAccents) {
      for (const scheme of ['light', 'dark'] as const) {
        for (const hex of generateColorScale(accent, scheme)) {
          expect(chroma(hex).clipped(), `${accent} ${scheme} ${hex}`).toBe(false);
        }
      }
    }
  });

  it('post-hex hue drift stays well below channel-clipping on chromatic rungs (C≥0.03)', () => {
    for (const accent of sampleAccents) {
      const srcH = chroma(accent).oklch()[2]!;
      if (!Number.isFinite(srcH)) continue;
      for (const scheme of ['light', 'dark'] as const) {
        for (const hex of generateColorScale(accent, scheme)) {
          // Colorimetric mapping holds H exactly. 8-bit hex quantization
          // at the pale/dark gamut cusp can exceed 1° (measured up to ~2–4°
          // depending on L). Channel clipping is 8–25°. Bound is 5°.
          const outH = chroma(hex).oklch()[2]!;
          const outC = chroma(hex).oklch()[1] ?? 0;
          if (outC < 0.03 || !Number.isFinite(outH)) continue;
          expect(
            hueDelta(srcH, outH),
            `${accent} ${scheme} ${hex} dH`,
          ).toBeLessThan(5);
        }
      }
    }
  });

  it('post-hex hue drift stays under 1° on well-chromatic rungs (C≥0.08)', () => {
    for (const accent of sampleAccents) {
      const srcH = chroma(accent).oklch()[2]!;
      if (!Number.isFinite(srcH)) continue;
      for (const scheme of ['light', 'dark'] as const) {
        for (const hex of generateColorScale(accent, scheme)) {
          const outC = chroma(hex).oklch()[1] ?? 0;
          const outH = chroma(hex).oklch()[2]!;
          if (outC < 0.08 || !Number.isFinite(outH)) continue;
          expect(
            hueDelta(srcH, outH),
            `${accent} ${scheme} ${hex} dH`,
          ).toBeLessThan(1);
        }
      }
    }
  });
});

describe('primaryShade criterion (P75-F)', () => {
  it('Rig Cyan / default-dark lands on an ink-safe dark-scheme index', () => {
    const def = bundledThemeDefinitions.find((t) => t.id === 'default-dark')!;
    const colors = def.colors as ThemeColors;
    const derived = derivePrimaryShade(colors);
    const ramp = generateColorScale(
      typeof colors.primary === 'string' ? colors.primary : colors.primary.base,
      'dark',
    );
    const ground = inkContrastGround(colors);
    const hex = ramp[derived.dark]!;
    expect(chroma.contrast(hex, ground)).toBeGreaterThanOrEqual(PRIMARY_SHADE_CONTRAST_MIN);
    expect(chroma.contrast('#ffffff', hex)).toBeGreaterThanOrEqual(PRIMARY_SHADE_CONTRAST_MIN);
    // Brand "accent on light" #007a70 is the same lightness band (ΔE ~1).
    expect(chroma.deltaE(hex, '#007a70')).toBeLessThan(3);
    expect(derived.dark).toBe(selectPrimaryShadeIndex(ramp, ground));
  });

  it('every bundled theme\'s resolved primaryShade clears the intended contrast bar', () => {
    for (const def of bundledThemeDefinitions) {
      const colors = def.colors as ThemeColors;
      const rc = resolveColors(colors, def.colorScheme);
      const shade = rc.primaryShade[def.colorScheme];
      const hex = rc.primary[shade]!;
      const ground = inkContrastGround(colors);
      const vsGround = chroma.contrast(hex, ground);
      const vsWhite = chroma.contrast('#ffffff', hex);
      expect(
        vsGround,
        `${def.id} primary[${shade}]=${hex} vs ${ground}`,
      ).toBeGreaterThanOrEqual(PRIMARY_SHADE_CONTRAST_MIN);
      expect(
        vsWhite,
        `${def.id} primary[${shade}]=${hex} under white`,
      ).toBeGreaterThanOrEqual(PRIMARY_SHADE_CONTRAST_MIN);
    }
  });

  it('authored primaryShade matches live derivation for every bundled theme', () => {
    for (const def of bundledThemeDefinitions) {
      const colors = def.colors as ThemeColors;
      expect(colors.primaryShade, `${def.id} must author primaryShade after P75-F`).toBeDefined();
      expect(colors.primaryShade).toEqual(derivePrimaryShade(colors));
    }
  });
});
