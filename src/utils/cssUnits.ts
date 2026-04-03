/**
 * CSS unit types, constants, and helpers for multi-unit dimension settings.
 *
 * Each unit group defines the allowed CSS units for a category of settings.
 * All settings default to 'px' for backward compatibility.
 */

// ---------------------------------------------------------------------------
// Unit group types
// ---------------------------------------------------------------------------

export type CssWidthUnit = 'px' | '%' | 'vw' | 'em' | 'rem';
export type CssHeightUnit = 'px' | '%' | 'vh' | 'dvh' | 'svh' | 'lvh' | 'em' | 'rem';
export type CssSpacingUnit = 'px' | 'em' | 'rem' | '%';
export type CssOffsetUnit = 'px' | 'em' | 'rem' | '%' | 'vw' | 'vh';
export type CssBorderRadiusUnit = 'px' | '%' | 'em' | 'rem';

/** Union of every CSS unit the system supports. */
export type AnyCssUnit =
  | CssWidthUnit
  | CssHeightUnit
  | CssSpacingUnit
  | CssOffsetUnit
  | CssBorderRadiusUnit;

// ---------------------------------------------------------------------------
// Allowed-unit arrays (for DimensionInput and PHP validation)
// ---------------------------------------------------------------------------

export const CSS_WIDTH_UNITS: readonly CssWidthUnit[] = ['px', '%', 'vw', 'em', 'rem'];
export const CSS_HEIGHT_UNITS: readonly CssHeightUnit[] = ['px', '%', 'vh', 'dvh', 'svh', 'lvh', 'em', 'rem'];
export const CSS_SPACING_UNITS: readonly CssSpacingUnit[] = ['px', 'em', 'rem', '%'];
export const CSS_OFFSET_UNITS: readonly CssOffsetUnit[] = ['px', 'em', 'rem', '%', 'vw', 'vh'];
export const CSS_BORDER_RADIUS_UNITS: readonly CssBorderRadiusUnit[] = ['px', '%', 'em', 'rem'];

// ---------------------------------------------------------------------------
// Per-unit sensible max values (used by DimensionInput for clamping)
// ---------------------------------------------------------------------------

/** Default max value per unit when no explicit max is provided. */
export const UNIT_MAX_DEFAULTS: Record<string, number> = {
  px: 5000,
  '%': 100,
  vw: 100,
  vh: 100,
  dvh: 100,
  svh: 100,
  lvh: 100,
  em: 100,
  rem: 100,
};

// ---------------------------------------------------------------------------
// toCss helpers
// ---------------------------------------------------------------------------

/**
 * Convert a numeric value + unit to a CSS string.
 *
 *   toCss(16, 'px')  → '16px'
 *   toCss(50, '%')   → '50%'
 *   toCss(2, 'em')   → '2em'
 */
export function toCss(value: number, unit: string = 'px'): string {
  return `${value}${unit}`;
}

/**
 * Like `toCss`, but returns `undefined` when the value is zero and
 * `zeroDisabled` is true. Useful for "0 = off" patterns like
 * `minHeight`, `maxWidth`, etc.
 */
export function toCssOrUndefined(
  value: number,
  unit: string = 'px',
  zeroDisabled = false,
): string | undefined {
  if (zeroDisabled && value === 0) return undefined;
  return toCss(value, unit);
}

/**
 * Return a raw number when the unit is 'px' (for Mantine auto-px props like
 * `size`, `h`, `padding`, `radius`), otherwise return a CSS string.
 *
 *   toCssOrNumber(16, 'px')  → 16
 *   toCssOrNumber(50, '%')   → '50%'
 */
export function toCssOrNumber(value: number, unit: string = 'px'): number | string {
  return unit === 'px' ? value : toCss(value, unit);
}
