/**
 * Color Generation Utilities
 *
 * Shade arrays are generated in OKLCH (P75-F) with chroma-reduction gamut
 * mapping into sRGB. `deriveDarkTuple` still interpolates in LAB.
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

/**
 * OKLCH lightness endpoints for the 10-step array (lightest → darkest).
 *
 * Chosen explicitly in P75-F (the HSL generator used the same numbers as
 * HSL L%, which is a different quantity). Light starts higher so shade 0
 * is a wash; both schemes share a 0.25 floor so the dark end stays a
 * colored shade rather than near-black (HSL 10% on Rig Cyan was OKLCH
 * L≈0.25). Dark shade 0 is 0.85 so dark themes don't open on a pastel.
 */
const LIGHTNESS_RANGE_LIGHT = [0.95, 0.25] as const;
const LIGHTNESS_RANGE_DARK = [0.85, 0.25] as const;

/**
 * Last-resort index pair if no ramp rung clears the ink-safe criterion.
 * Omitted `primaryShade` now derives by criterion (P75-F); this remains
 * the historical Mantine default for callers that want a constant.
 */
export const DEFAULT_PRIMARY_SHADE: PrimaryShade = { light: 6, dark: 5 };

/** WCAG AA normal-text bar — the COLOR-SPEC.md §2 primaryShade criterion. */
export const PRIMARY_SHADE_CONTRAST_MIN = 4.5;

/** WCAG 1.4.11 non-text contrast bar for affordance borders / indicators. */
export const UI_CONTRAST_MIN = 3;

/** Binary-search iterations for chroma reduction (~1e-7 C resolution). */
const GAMUT_SEARCH_ITERS = 24;

/**
 * Surfaces darker than this are not a usable "lightest surface" for the
 * ink-safe half of the primaryShade criterion (a dark fill cannot clear
 * 4.5:1 against a dark panel *and* 4.5:1 under white text).
 */
const LIGHT_GROUND_L_MIN = 0.5;

/** Chromatic `text` is not a surface stand-in (e.g. Halloween orange). */
const NEUTRAL_INK_CHROMA_MAX = 0.08;

// ---------------------------------------------------------------------------
// Core generators
// ---------------------------------------------------------------------------

/**
 * Convert OKLCH to an sRGB hex, reducing chroma (holding L and H) until
 * the color is inside the sRGB gamut. Channel-clipping is not used —
 * it shifts hue (P75-F / COLOR-SPEC.md round 3).
 */
export function mapOklchToSrgbHex(L: number, C: number, H: number): string {
  const hue = Number.isFinite(H) ? H : 0;
  const chromaC = Number.isFinite(C) && C > 0 ? C : 0;
  if (!chroma.oklch(L, chromaC, hue).clipped()) {
    return chroma.oklch(L, chromaC, hue).hex();
  }
  let lo = 0;
  let hi = chromaC;
  for (let i = 0; i < GAMUT_SEARCH_ITERS; i++) {
    const mid = (lo + hi) / 2;
    if (chroma.oklch(L, mid, hue).clipped()) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return chroma.oklch(L, lo, hue).hex();
}

/**
 * Generate a 10-step shade array for a given base color.
 *
 * Steps OKLCH lightness linearly between scheme endpoints, holding the
 * base chroma and hue, then gamut-maps each rung into sRGB by reducing
 * chroma. The `colorScheme` param adjusts the lightness range so that
 * dark themes don't produce washed-out pastels at the low indices.
 *
 * @param base - CSS-compatible color string (hex/rgb/hsl)
 * @param colorScheme - 'light' | 'dark' to adjust lightness mapping
 * @returns Tuple of 10 hex strings
 */
export function generateColorScale(
  base: string,
  colorScheme: 'light' | 'dark' = 'dark',
): string[] {
  const [, baseC, baseH] = chroma(base).oklch();
  const [lightMax, lightMin] =
    colorScheme === 'light' ? LIGHTNESS_RANGE_LIGHT : LIGHTNESS_RANGE_DARK;

  const shades: string[] = [];
  for (let i = 0; i < SHADE_COUNT; i++) {
    const L = lightMax - ((lightMax - lightMin) / (SHADE_COUNT - 1)) * i;
    shades.push(mapOklchToSrgbHex(L, baseC, baseH));
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
 * Derive a 3:1 affordance-border color (P74-N / P75-G).
 *
 * Holds hue, eases chroma slightly, and steps lightness toward mid-grey
 * until WCAG 1.4.11's 3:1 bar clears against `surface` *and* every extra
 * ground (typically surfaceRaised — menus/popovers). Must not alias to
 * `border`, which is often a decorative divider below 3:1.
 */
export function deriveBorderStrong(
  surface: string,
  alsoAgainst: readonly string[] = [],
): string {
  const base = chroma(surface);
  const [l, c, h] = base.lch();
  const towardMid = l < 50 ? 1 : -1;
  const grounds = [surface, ...alsoAgainst];
  let best = surface;
  for (let i = 1; i <= 100; i++) {
    const t = i / 100;
    const L = l + towardMid * t * 50;
    const C = c * (1 - 0.2 * t);
    const hex = chroma.lch(L, Math.max(0, C), h).hex();
    best = hex;
    if (grounds.every((g) => chroma.contrast(hex, g) >= UI_CONTRAST_MIN)) {
      return hex;
    }
  }
  return best;
}

function labStops(from: string, to: string, count: number): string[] {
  return chroma.scale([from, to]).mode('lab').colors(count).map((c) => chroma(c).hex());
}

function oklchL(color: string): number {
  return chroma(color).oklch()[0];
}

function oklchC(color: string): number {
  const c = chroma(color).oklch()[1];
  return Number.isFinite(c) ? c : 0;
}

function primaryBase(colors: ThemeColors): string {
  return typeof colors.primary === 'string'
    ? colors.primary
    : (colors.primary as { base: string }).base;
}

/**
 * Ground used for the ink-safe half of the primaryShade criterion
 * (COLOR-SPEC.md §2): 4.5:1 against the theme's lightest surface.
 *
 * Dark themes have no light surface token. The spec measured Rig Cyan
 * against a light ground (`#e8f7fc` / `text`); using the panel itself
 * makes the dual criterion empty. Fall back to near-neutral light ink,
 * then white.
 */
export function inkContrastGround(colors: ThemeColors): string {
  const candidates = [
    colors.background,
    colors.surface,
    colors.surfaceRaised,
    colors.surface2,
    colors.surface3,
  ].filter((c): c is string => typeof c === 'string');

  let lightest = candidates[0] ?? '#ffffff';
  let lightestL = oklchL(lightest);
  for (const c of candidates) {
    const L = oklchL(c);
    if (L > lightestL) {
      lightest = c;
      lightestL = L;
    }
  }
  if (lightestL >= LIGHT_GROUND_L_MIN) {
    return lightest;
  }
  if (oklchL(colors.text) >= LIGHT_GROUND_L_MIN && oklchC(colors.text) < NEUTRAL_INK_CHROMA_MAX) {
    return colors.text;
  }
  return '#ffffff';
}

/**
 * Lightest ramp index that clears 4.5:1 against `ground` *and* 4.5:1
 * under white text. Equivalent to the last passing rung walking from
 * the dark end — the COLOR-SPEC.md §2 criterion, expressed as an array
 * index (never a Tailwind rung name).
 */
export function selectPrimaryShadeIndex(ramp: readonly string[], ground: string): number {
  for (let i = 0; i < ramp.length; i++) {
    const hex = ramp[i]!;
    if (
      chroma.contrast(hex, ground) >= PRIMARY_SHADE_CONTRAST_MIN
      && chroma.contrast('#ffffff', hex) >= PRIMARY_SHADE_CONTRAST_MIN
    ) {
      return i;
    }
  }
  return ramp.length - 1;
}

/**
 * Derive `{light, dark}` primaryShade indices against the OKLCH ramps
 * for this palette. Used when a theme omits the field, and to re-derive
 * shipped JSON in P75-F.
 */
export function derivePrimaryShade(colors: ThemeColors): PrimaryShade {
  const base = primaryBase(colors);
  const ground = inkContrastGround(colors);
  return {
    light: selectPrimaryShadeIndex(generateColorScale(base, 'light'), ground),
    dark: selectPrimaryShadeIndex(generateColorScale(base, 'dark'), ground),
  };
}

function contrastPasses(fg: string, bg: string, minRatio: number): boolean {
  return chroma.contrast(fg, bg) >= minRatio;
}

/**
 * Nearest ramp index that clears `minRatio` against every `surfaces` colour.
 * Keeps `preferred` when it already passes (P75-E: no regression on themes
 * that were already fine). Tie at the same distance: step toward more
 * contrast (darker on light surfaces, lighter on dark).
 */
export function selectUiContrastIndex(
  ramp: readonly string[],
  surfaces: readonly string[],
  preferred: number,
  minRatio: number = UI_CONTRAST_MIN,
): number {
  const n = ramp.length;
  if (n === 0) return 0;
  const start = Math.min(Math.max(0, preferred), n - 1);
  const grounds = surfaces.length > 0 ? surfaces : ['#ffffff'];
  const passes = (i: number): boolean =>
    grounds.every((s) => contrastPasses(ramp[i]!, s, minRatio));

  if (passes(start)) return start;

  const meanL =
    grounds.reduce((sum, s) => sum + oklchL(s), 0) / grounds.length;
  const surfaceIsLight = meanL >= LIGHT_GROUND_L_MIN;

  for (let d = 1; d < n; d++) {
    const hi = start + d;
    const lo = start - d;
    const ordered = surfaceIsLight ? [hi, lo] : [lo, hi];
    for (const i of ordered) {
      if (i >= 0 && i < n && passes(i)) return i;
    }
  }

  let best = start;
  let bestScore = 0;
  for (let i = 0; i < n; i++) {
    const score = grounds.reduce((sum, s) => sum + chroma.contrast(ramp[i]!, s), 0);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
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
  const primaryHex = primaryBase(colors);

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

  const borderStrong = colors.borderStrong
    ?? deriveBorderStrong(colors.surface, [surfaceRaised]);

  const primaryShade = colors.primaryShade ?? derivePrimaryShade(colors);
  const fillIndex = Math.min(
    Math.max(0, primaryShade[colorScheme]),
    SHADE_COUNT - 1,
  );
  const primaryFill = primaryArray[fillIndex]!;
  const strokeIndex = selectUiContrastIndex(
    primaryArray,
    [colors.surface, surface2, surfaceRaised],
    fillIndex,
  );
  const primaryStroke = primaryArray[strokeIndex]!;
  const primaryOnFill =
    chroma.contrast('#ffffff', primaryFill) >= chroma.contrast('#000000', primaryFill)
      ? '#ffffff'
      : '#000000';

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
    primaryShade,
    primaryFill,
    primaryFillIndex: fillIndex,
    primaryStroke,
    primaryOnFill,

    success: colors.success,
    warning: colors.warning ?? '#f59e0b',
    error: colors.error ?? '#ef4444',
    info: colors.info ?? primaryHex,

    accent: colors.accent ?? primaryHex,
    accentGreen: colors.accentGreen ?? colors.success,
    accentPurple: colors.accentPurple ?? '#a855f7',

    dark,
  };
}
