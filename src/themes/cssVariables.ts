/**
 * CSS Variable Generator
 *
 * Produces --wpsg-* CSS custom property declarations from a resolved
 * color palette. These variables serve as a secondary output for:
 *  - Shadow DOM injection (so host-page CSS can't leak in)
 *  - Any residual SCSS that hasn't been migrated to Mantine overrides
 *  - Third-party integrations needing access to theme tokens
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §2.6
 */

import type { ResolvedColors } from './types';
import type { ThemeDefinition } from './types';

// ---------------------------------------------------------------------------
// CSS variable namespace prefix
// ---------------------------------------------------------------------------

const PREFIX = '--wpsg';

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a CSS string containing all --wpsg-* custom property
 * declarations for a given theme. The string is scoped to a selector
 * (default `:host` for Shadow DOM, or `.wp-super-gallery` for normal DOM).
 *
 * @param rc - Resolved colors from colorGen
 * @param def - Full theme definition (for non-color tokens)
 * @param selector - CSS selector to scope the variables
 * @returns A complete CSS rule string
 */
export function generateCssVariables(
  rc: ResolvedColors,
  def: ThemeDefinition,
  selector: string = ':host',
): string {
  const vars: string[] = [];

  // --- Colors ---
  vars.push(`${PREFIX}-color-background: ${rc.background};`);
  vars.push(`${PREFIX}-color-surface: ${rc.surface};`);
  vars.push(`${PREFIX}-color-surface2: ${rc.surface2};`);
  vars.push(`${PREFIX}-color-surface3: ${rc.surface3};`);
  vars.push(`${PREFIX}-color-text: ${rc.text};`);
  vars.push(`${PREFIX}-color-text-muted: ${rc.textMuted};`);
  vars.push(`${PREFIX}-color-text-muted2: ${rc.textMuted2};`);
  vars.push(`${PREFIX}-color-border: ${rc.border};`);
  vars.push(`${PREFIX}-color-primary: ${rc.primary[5]};`);
  vars.push(`${PREFIX}-color-success: ${rc.success};`);
  vars.push(`${PREFIX}-color-warning: ${rc.warning};`);
  vars.push(`${PREFIX}-color-error: ${rc.error};`);
  vars.push(`${PREFIX}-color-info: ${rc.info};`);
  vars.push(`${PREFIX}-color-accent: ${rc.accent};`);

  // Primary shade array (for advanced usage)
  for (let i = 0; i < rc.primary.length; i++) {
    vars.push(`${PREFIX}-color-primary-${i}: ${rc.primary[i]};`);
  }

  // --- Spacing ---
  vars.push(`${PREFIX}-spacing-xs: ${def.spacing.xs};`);
  vars.push(`${PREFIX}-spacing-sm: ${def.spacing.sm};`);
  vars.push(`${PREFIX}-spacing-md: ${def.spacing.md};`);
  vars.push(`${PREFIX}-spacing-lg: ${def.spacing.lg};`);
  vars.push(`${PREFIX}-spacing-xl: ${def.spacing.xl};`);

  // --- Radius ---
  vars.push(`${PREFIX}-radius-xs: ${def.radius.xs};`);
  vars.push(`${PREFIX}-radius-sm: ${def.radius.sm};`);
  vars.push(`${PREFIX}-radius-md: ${def.radius.md};`);
  vars.push(`${PREFIX}-radius-lg: ${def.radius.lg};`);
  vars.push(`${PREFIX}-radius-xl: ${def.radius.xl};`);

  // --- Shadows ---
  vars.push(`${PREFIX}-shadow-xs: ${def.shadows.xs};`);
  vars.push(`${PREFIX}-shadow-sm: ${def.shadows.sm};`);
  vars.push(`${PREFIX}-shadow-md: ${def.shadows.md};`);
  vars.push(`${PREFIX}-shadow-lg: ${def.shadows.lg};`);
  vars.push(`${PREFIX}-shadow-xl: ${def.shadows.xl};`);

  // --- Typography ---
  vars.push(`${PREFIX}-font-family: ${def.typography.fontFamily};`);
  vars.push(`${PREFIX}-font-family-mono: ${def.typography.fontFamilyMono};`);

  // --- Meta ---
  vars.push(`${PREFIX}-color-scheme: ${def.colorScheme};`);

  const indent = '  ';
  const body = vars.map((v) => `${indent}${v}`).join('\n');

  return `${selector} {\n${body}\n}`;
}
