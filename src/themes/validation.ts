/**
 * Theme Definition Validation
 *
 * Strict runtime validation for ThemeDefinition objects. Rejects invalid
 * themes with detailed dev-mode error messages and falls back to
 * default-dark. Production builds skip the verbose messages but still
 * enforce structural integrity.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §2.7
 */

import chroma from 'chroma-js';
import type { ThemeDefinition, ThemeColors, SizeScale } from './types';

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

class ThemeValidationError extends Error {
  constructor(themeId: string, issues: string[]) {
    const msg = `Theme "${themeId}" failed validation:\n  - ${issues.join('\n  - ')}`;
    super(msg);
    this.name = 'ThemeValidationError';
  }
}

// ---------------------------------------------------------------------------
// Individual validators
// ---------------------------------------------------------------------------

/** Check that a value is a valid CSS color that chroma.js can parse */
function isValidColor(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  try {
    chroma(value);
    return true;
  } catch {
    return false;
  }
}

/** Validate a SizeScale object has all 5 required keys */
function validateSizeScale(
  obj: unknown,
  path: string,
  issues: string[],
): void {
  const keys: (keyof SizeScale)[] = ['xs', 'sm', 'md', 'lg', 'xl'];
  if (typeof obj !== 'object' || obj === null) {
    issues.push(`${path} must be an object with xs/sm/md/lg/xl`);
    return;
  }
  const record = obj as Record<string, unknown>;
  for (const key of keys) {
    if (typeof record[key] !== 'string' || (record[key] as string).trim() === '') {
      issues.push(`${path}.${key} must be a non-empty string`);
    }
  }
}

/** Validate color palette section */
function validateColors(colors: unknown, issues: string[]): void {
  if (typeof colors !== 'object' || colors === null) {
    issues.push('colors must be an object');
    return;
  }

  const c = colors as Record<string, unknown>;

  // Required simple color fields
  const requiredColorFields: (keyof ThemeColors)[] = [
    'background', 'surface', 'surface2', 'surface3',
    'text', 'textMuted', 'textMuted2',
    'border', 'success',
  ];

  for (const field of requiredColorFields) {
    if (!isValidColor(c[field])) {
      issues.push(`colors.${field} must be a valid CSS color, got: ${JSON.stringify(c[field])}`);
    }
  }

  // Primary can be a string or {base, shades}
  const primary = c['primary'];
  if (typeof primary === 'string') {
    if (!isValidColor(primary)) {
      issues.push(`colors.primary must be a valid CSS color`);
    }
  } else if (typeof primary === 'object' && primary !== null) {
    const p = primary as Record<string, unknown>;
    if (!isValidColor(p['base'])) {
      issues.push(`colors.primary.base must be a valid CSS color`);
    }
    if (typeof p['shades'] !== 'number' || p['shades'] < 1) {
      issues.push(`colors.primary.shades must be a positive number`);
    }
  } else {
    issues.push(`colors.primary must be a color string or {base, shades} object`);
  }

  // PrimaryShade
  const ps = c['primaryShade'];
  if (typeof ps !== 'object' || ps === null) {
    issues.push('colors.primaryShade must be {light: number, dark: number}');
  } else {
    const shade = ps as Record<string, unknown>;
    if (typeof shade['light'] !== 'number' || shade['light'] < 0 || shade['light'] > 9) {
      issues.push('colors.primaryShade.light must be 0-9');
    }
    if (typeof shade['dark'] !== 'number' || shade['dark'] < 0 || shade['dark'] > 9) {
      issues.push('colors.primaryShade.dark must be 0-9');
    }
  }

  // Optional dark tuple — if provided, must be exactly 10 valid colors
  if (c['dark'] !== undefined) {
    if (!Array.isArray(c['dark']) || c['dark'].length !== 10) {
      issues.push('colors.dark must be an array of exactly 10 colors');
    } else {
      for (let i = 0; i < c['dark'].length; i++) {
        if (!isValidColor(c['dark'][i])) {
          issues.push(`colors.dark[${i}] must be a valid CSS color`);
        }
      }
    }
  }

  // Optional color fields — validate only if present
  const optionalColorFields = ['warning', 'error', 'info', 'accent', 'accentGreen', 'accentPurple'] as const;
  for (const field of optionalColorFields) {
    if (c[field] !== undefined && !isValidColor(c[field])) {
      issues.push(`colors.${field} must be a valid CSS color when provided`);
    }
  }
}

/** Validate typography section */
function validateTypography(typography: unknown, issues: string[]): void {
  if (typeof typography !== 'object' || typography === null) {
    issues.push('typography must be an object');
    return;
  }

  const t = typography as Record<string, unknown>;

  if (typeof t['fontFamily'] !== 'string' || t['fontFamily'].trim() === '') {
    issues.push('typography.fontFamily must be a non-empty string');
  }

  if (typeof t['fontFamilyMono'] !== 'string' || t['fontFamilyMono'].trim() === '') {
    issues.push('typography.fontFamilyMono must be a non-empty string');
  }

  validateSizeScale(t['fontSizes'], 'typography.fontSizes', issues);

  // Headings
  if (typeof t['headings'] !== 'object' || t['headings'] === null) {
    issues.push('typography.headings must be an object');
  } else {
    const h = t['headings'] as Record<string, unknown>;
    if (typeof h['fontFamily'] !== 'string') {
      issues.push('typography.headings.fontFamily must be a string');
    }
    const sizes = h['sizes'];
    if (typeof sizes !== 'object' || sizes === null) {
      issues.push('typography.headings.sizes must be an object');
    } else {
      const s = sizes as Record<string, unknown>;
      for (const level of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
        const entry = s[level];
        if (typeof entry !== 'object' || entry === null) {
          issues.push(`typography.headings.sizes.${level} must be {fontSize, lineHeight}`);
        } else {
          const e = entry as Record<string, unknown>;
          if (typeof e['fontSize'] !== 'string') {
            issues.push(`typography.headings.sizes.${level}.fontSize must be a string`);
          }
          if (typeof e['lineHeight'] !== 'string') {
            issues.push(`typography.headings.sizes.${level}.lineHeight must be a string`);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a theme definition. Throws ThemeValidationError with a
 * detailed issue list when validation fails.
 *
 * @param theme - Object to validate
 * @throws ThemeValidationError if the theme is structurally invalid
 */
export function validateTheme(theme: unknown): asserts theme is ThemeDefinition {
  const issues: string[] = [];

  if (typeof theme !== 'object' || theme === null) {
    throw new ThemeValidationError('unknown', ['Theme must be a non-null object']);
  }

  const t = theme as Record<string, unknown>;

  // Top-level required string fields
  if (typeof t['id'] !== 'string' || t['id'].trim() === '') {
    issues.push('id must be a non-empty string');
  }
  if (typeof t['name'] !== 'string' || t['name'].trim() === '') {
    issues.push('name must be a non-empty string');
  }
  if (t['colorScheme'] !== 'light' && t['colorScheme'] !== 'dark') {
    issues.push('colorScheme must be "light" or "dark"');
  }

  const themeId = typeof t['id'] === 'string' ? t['id'] : 'unknown';

  // Sections
  validateColors(t['colors'], issues);
  validateTypography(t['typography'], issues);
  validateSizeScale(t['spacing'], 'spacing', issues);
  validateSizeScale(t['radius'], 'radius', issues);
  validateSizeScale(t['shadows'], 'shadows', issues);
  validateSizeScale(t['breakpoints'], 'breakpoints', issues);

  if (issues.length > 0) {
    throw new ThemeValidationError(themeId, issues);
  }
}

/**
 * Safe validation wrapper that returns a boolean + logs issues in dev.
 * Useful for the registry to skip bad themes without crashing.
 */
export function isValidTheme(theme: unknown): theme is ThemeDefinition {
  try {
    validateTheme(theme);
    return true;
  } catch (err) {
    if (import.meta.env.DEV && err instanceof ThemeValidationError) {
      console.warn('[WPSG Theme]', err.message);
    }
    return false;
  }
}
