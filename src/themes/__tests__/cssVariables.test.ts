/**
 * Tests for src/themes/cssVariables.ts
 *
 * Covers: generateCssVariables — CSS custom property generation
 */

import { describe, it, expect } from 'vitest';
import { generateCssVariables } from '../cssVariables';
import { resolveColors } from '../colorGen';
import type { ThemeDefinition, ThemeColors } from '../types';
import baseDefaults from '../definitions/_base.json';
import defaultDarkDef from '../definitions/default-dark.json';

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

  it('includes --wpsg-color-background variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-color-background:');
    expect(result).toContain('#0f172a');
  });

  it('includes --wpsg-color-text variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-color-text:');
    expect(result).toContain('#ffffff');
  });

  it('includes --wpsg-color-primary variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    // primary is rc.primary[5], which is a generated shade
    expect(result).toContain('--wpsg-color-primary:');
  });

  it('includes all 10 primary shade variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    for (let i = 0; i < 10; i++) {
      expect(result).toContain(`--wpsg-color-primary-${i}:`);
    }
  });

  it('includes spacing variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-spacing-xs:');
    expect(result).toContain('--wpsg-spacing-md:');
    expect(result).toContain('--wpsg-spacing-xl:');
  });

  it('includes radius variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-radius-sm:');
    expect(result).toContain('--wpsg-radius-md:');
  });

  it('includes shadow variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-shadow-xs:');
    expect(result).toContain('--wpsg-shadow-lg:');
  });

  it('includes typography variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-font-family:');
    expect(result).toContain('--wpsg-font-family-mono:');
  });

  it('includes color-scheme meta variable', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-color-scheme: dark');
  });

  it('includes semantic color variables', () => {
    const rc = makeResolvedColors();
    const def = makeThemeDef();
    const result = generateCssVariables(rc, def);
    expect(result).toContain('--wpsg-color-success:');
    expect(result).toContain('--wpsg-color-warning:');
    expect(result).toContain('--wpsg-color-error:');
    expect(result).toContain('--wpsg-color-info:');
    expect(result).toContain('--wpsg-color-accent:');
  });
});
