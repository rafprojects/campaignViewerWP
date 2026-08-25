/**
 * Color Generation Utilities
 *
 * Uses chroma.js in LAB color space to produce perceptually uniform
 * 10-step shade arrays for Mantine's color tuple system.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §2.4
 */

import chroma from 'chroma-js';
import type { ColorShorthand, ThemeColors, ResolvedColors, PrimaryShade } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of shades Mantine expects per color tuple */
const SHADE_COUNT = 10;

/** Lightness range for the 10-step array (lightest → darkest) */
const LIGHTNESS_RANGE_LIGHT = [95, 15] as const; // shade 0 = very light
const LIGHTNESS_RANGE_DARK = [85, 10] as const;

/** Historical Mantine default when a theme omits primaryShade (P74-N / P75-F). */
export const DEFAULT_PRIMARY_SHADE: PrimaryShade = { light: 6, dark: 5 };

/** WCAG 1.4.11 non-text contrast bar for affordance borders. */
const UI_CONTRAST_MIN = 3;

// ---------------------------------------------------------------------------
// Core generators
// ---------------------------------------------------------------------------

/**
 * Generate a 10-step shade array for a given base color.
 *
 * Uses LAB color space for perceptual uniformity. The `colorScheme`
 * param adjusts the lightness range so that dark themes don't produce
 * washed-out pastels at the low indices.
 *
 * @param base - CSS-compatible color string (hex/rgb/hsl)
 * @param colorScheme - 'light' | 'dark' to adjust lightness mapping
 * @returns Tuple of 10 hex strings
 */
export function generateColorScale(
  base: string,
  colorScheme: 'light' | 'dark' = 'dark',
): string[] {
  const [h, , ] = chroma(base).hsl();
  const hue = Number.isNaN(h) ? 0 : h;
  const baseSat = chroma(base).get('hsl.s');

  const [lightMax, lightMin] =
    colorScheme === 'light' ? LIGHTNESS_RANGE_LIGHT : LIGHTNESS_RANGE_DARK;

  const shades: string[] = [];
  for (let i = 0; i < SHADE_COUNT; i++) {
    const lightness = lightMax - ((lightMax - lightMin) / (SHADE_COUNT - 1)) * i;
    // Slightly desaturate the extreme ends to avoid neon blow-out
    const sat = baseSat * (i < 2 || i > 7 ? 0.7 : 1);
    shades.push(chroma.hsl(hue, sat, lightness / 100).hex());
  }

  return shades;
}

/**
 * Apply alpha transparency to a color.
 *
 * @param color - CSS-compatible color string
 * @param alpha - 0–1 opacity value
 * @returns rgba() string
 */
export function withAlpha(color: string, alpha: number): string {
  return chroma(color).alpha(alpha).css();
}

// ---------------------------------------------------------------------------
// Dark tuple derivation
// ---------------------------------------------------------------------------

/**
 * Derive Mantine's `dark` color tuple from the theme palette so that
 * surface colors stay coherent with the overall palette.
 *
 * Mantine uses dark[0] for the lightest text and dark[7] as the main
 * surface background. We interpolate between the theme's text and
 * background colors in LAB space to create a smooth ramp.
 *
 * @param text      - Primary text color (lightest in dark themes)
 * @param surface   - Primary surface color (used at dark[7])
 * @param background - Body background (used at dark[8-9])
 * @returns 10-element hex array
 */
export function deriveDarkTuple(
  text: string,
  surface: string,
  background: string,
): string[] {
  // Build a scale from text (light) → surface → background (darkest)
  const scale = chroma
    .scale([text, surface, background])
    .mode('lab')
    .colors(SHADE_COUNT);

  return scale.map((c) => chroma(c).hex());
}

/**
 * Derive a 3:1-against-surface border color (P74-N).
 *
 * Holds hue, eases chroma slightly, and steps lightness toward mid-grey
 * until WCAG 1.4.11's 3:1 bar clears. Must not alias to `border` — that
 * token is often a decorative divider below 3:1.
 */
export function deriveBorderStrong(surface: string): string {
  const base = chroma(surface);
  const [l, c, h] = base.lch();
  const towardMid = l < 50 ? 1 : -1;
  let best = surface;
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const L = l + towardMid * t * 50;
    const C = c * (1 - 0.2 * t);
    const hex = chroma.lch(L, Math.max(0, C), h).hex();
    best = hex;
    if (chroma.contrast(hex, surface) >= UI_CONTRAST_MIN) {
      return hex;
    }
  }
  return best;
}

function labStops(from: string, to: string, count: number): string[] {
  return chroma.scale([from, to]).mode('lab').colors(count).map((c) => chroma(c).hex());
}

// ---------------------------------------------------------------------------
// Color resolution pipeline
// ---------------------------------------------------------------------------

/**
 * Expand a ColorShorthand into a 10-step hex array.
 *
 * - If already a plain string, generates the full scale from it.
 * - If an object with base/shades, respects the shades count hint
 *   (currently we always produce 10 for Mantine compatibility).
 */
function expandShorthand(
  value: ColorShorthand,
  colorScheme: 'light' | 'dark',
): string[] {
  if (typeof value === 'string') {
    return generateColorScale(value, colorScheme);
  }
  return generateColorScale(value.base, colorScheme);
}

/**
 * Resolve an entire ThemeColors block into concrete, expanded values.
 *
 * - `primary` is expanded into a 10-step array.
 * - `dark` tuple is derived automatically if not explicitly provided.
 * - Optional accent colors fall back to the primary base color.
 *
 * @param colors - Raw ThemeColors from JSON definition
 * @param colorScheme - Light or dark base scheme
 * @returns Fully resolved color set ready for the adapter
 */
export function resolveColors(
  colors: ThemeColors,
  colorScheme: 'light' | 'dark',
): ResolvedColors {
  const primaryBase = typeof colors.primary === 'string'
    ? colors.primary
    : (colors.primary as { base: string }).base;

  const primaryArray = expandShorthand(colors.primary, colorScheme);

  const dark = colors.dark && colors.dark.length === SHADE_COUNT
    ? colors.dark
    : deriveDarkTuple(colors.text, colors.surface, colors.background);

  // surfaceRaised → surface2 when unset (flatter, safe). surface2/3 fill
  // the 3-tier schema between surface and that raised anchor.
  const surfaceRaised = colors.surfaceRaised ?? colors.surface2 ?? colors.surface;
  const elev = labStops(colors.surface, surfaceRaised, 4);
  const surface2 = colors.surface2 ?? elev[1]!;
  const surface3 = colors.surface3 ?? elev[2]!;

  const textMuted2 = colors.textMuted2
    ?? chroma.mix(colors.text, colors.textMuted, 0.65, 'lab').hex();

  const borderStrong = colors.borderStrong ?? deriveBorderStrong(colors.surface);

  return {
    background: colors.background,
    surface: colors.surface,
    surface2,
    surface3,
    surfaceRaised,

    text: colors.text,
    textMuted: colors.textMuted,
    textMuted2,

    border: colors.border,
    borderStrong,

    primary: primaryArray,
    primaryShade: colors.primaryShade ?? DEFAULT_PRIMARY_SHADE,

    success: colors.success,
    warning: colors.warning ?? '#f59e0b',
    error: colors.error ?? '#ef4444',
    info: colors.info ?? primaryBase,

    accent: colors.accent ?? primaryBase,
    accentGreen: colors.accentGreen ?? colors.success,
    accentPurple: colors.accentPurple ?? '#a855f7',

    dark,
  };
}
