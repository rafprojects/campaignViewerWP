/**
 * Color Generation Utilities
 *
 * Uses chroma.js in LAB color space to produce perceptually uniform
 * 10-step shade arrays for Mantine's color tuple system.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §2.4
 */

import chroma from 'chroma-js';
import type { ColorShorthand, ThemeColors, ResolvedColors } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of shades Mantine expects per color tuple */
const SHADE_COUNT = 10;

/** Lightness range for the 10-step array (lightest → darkest) */
const LIGHTNESS_RANGE_LIGHT = [95, 15] as const; // shade 0 = very light
const LIGHTNESS_RANGE_DARK = [85, 10] as const;

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

  return {
    background: colors.background,
    surface: colors.surface,
    surface2: colors.surface2,
    surface3: colors.surface3,

    text: colors.text,
    textMuted: colors.textMuted,
    textMuted2: colors.textMuted2,

    border: colors.border,

    primary: primaryArray,
    primaryShade: colors.primaryShade,

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
