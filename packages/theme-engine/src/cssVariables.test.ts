/**
 * Tests for src/themes/cssVariables.ts
 *
 * Covers: generateCssVariables — CSS custom property generation
 */

import { describe, it, expect } from 'vitest';
import { generateCssVariables } from './cssVariables';
import { resolveColors } from './colorGen';
import type { ThemeDefinition, ThemeColors } from './types';
import baseDefaults from './definitions/_base.json';
import defaultDarkDef from './definitions/default-dark.json';

function makeResolvedColors() {
  const colors: ThemeColors = (defaultDarkDef as Record<string, unknown>).colors as ThemeColors;
  return resolveColors(colors, 'dark');
}

function makeThemeDef(): ThemeDefinition {
  const base = JSON.parse(JSON.stringify(baseDefaults));
  const ext = JSON.parse(JSON.stringify(defaultDarkDef));
  // Simple deep merge
  const merged = { ...base, ...ext, colors: ext.colors };
  return merged as unknown as ThemeDefinition;
}

// ---------------------------------------------------------------------------
// generateCssVariables
// ---------------------------------------------------------------------------

describe('generateCssVariables', () => {
  it('returns a string containing a CSS rule', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain(':host {');
    expect(result).toContain('}');
  });

  it('uses custom selector when provided', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def, '.my-root');
    expect(result).toContain('.my-root {');
  });

  it('includes surface-raised and border-strong variables (P74-N)', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-color-surface-raised:');
    expect(result).toContain('#1a3542');
    expect(result).toContain('--mullion-color-border-strong:');
    expect(result).toContain('#648284');
  });

  it('includes --mullion-color-background variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-color-background:');
    expect(result).toContain('#08141b');
  });

  it('includes --mullion-color-text variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-color-text:');
    expect(result).toContain('#eef8fb');
  });

  it('includes --mullion-color-primary variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-color-primary:');
    expect(result).toContain(`--mullion-color-primary: ${rc.primaryFill}`);
    expect(result).toContain(`--mullion-color-primary-stroke: ${rc.primaryStroke}`);
    expect(result).toContain(`--mullion-color-primary-on: ${rc.primaryOnFill}`);
    expect(result).toContain(`--mullion-color-focus-halo: ${rc.focusHalo}`);
  });

  it('includes all 10 primary shade variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    for (let i = 0; i < 10; i++) {
      expect(result).toContain(`--mullion-color-primary-${i}:`);
    }
  });

  it('includes spacing variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-spacing-xs:');
    expect(result).toContain('--mullion-spacing-md:');
    expect(result).toContain('--mullion-spacing-xl:');
  });

  it('includes radius variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-radius-sm:');
    expect(result).toContain('--mullion-radius-md:');
  });

  it('includes shadow variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-shadow-xs:');
    expect(result).toContain('--mullion-shadow-lg:');
  });

  it('includes typography variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-font-family:');
    expect(result).toContain('--mullion-font-family-mono:');
  });

  it('includes color-scheme meta variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-color-scheme: dark');
  });

  it('includes semantic color variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-color-success:');
    expect(result).toContain('--mullion-color-warning:');
    expect(result).toContain('--mullion-color-error:');
    expect(result).toContain('--mullion-color-info:');
    expect(result).toContain('--mullion-color-accent:');
  });

  it('falls back to "none" / "inherit" / "monospace" when shadow/typography values are undefined (lines 89-97)', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    // Clear shadow and typography values to trigger the ?? fallback branches
    const defAny = def as unknown as Record<string, unknown>;
    defAny.shadows = { xs: null, sm: null, md: null, lg: null, xl: null };
    defAny.typography = { fontFamily: null, fontFamilyMono: null };
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--mullion-shadow-xs: none');
    expect(result).toContain('--mullion-font-family: inherit');
    expect(result).toContain('--mullion-font-family-mono: monospace');
  });
});
