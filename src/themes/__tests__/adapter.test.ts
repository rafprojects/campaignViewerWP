/**
 * Tests for src/themes/adapter.ts
 *
 * Covers: adaptTheme — JSON → MantineThemeOverride conversion
 */

import { describe, it, expect } from 'vitest';
import { adaptTheme } from '../adapter';
import type { ThemeDefinition } from '../types';
import baseDefaults from '../definitions/_base.json';
import defaultDarkDef from '../definitions/default-dark.json';
import defaultLightDef from '../definitions/default-light.json';

// Helper: build a valid ThemeDefinition
function makeThemeDef(ext: Record<string, unknown> = {}): ThemeDefinition {
  const base = JSON.parse(JSON.stringify(baseDefaults));
  const theme = JSON.parse(JSON.stringify(defaultDarkDef));
  return deepMerge(deepMerge(base, theme), ext) as unknown as ThemeDefinition;
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const key of Object.keys(b)) {
    const bVal = b[key];
    const aVal = result[key];
    if (
      bVal !== null && typeof bVal === 'object' && !Array.isArray(bVal) &&
      aVal !== null && typeof aVal === 'object' && !Array.isArray(aVal)
    ) {
      result[key] = deepMerge(aVal as Record<string, unknown>, bVal as Record<string, unknown>);
    } else {
      result[key] = bVal;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// adaptTheme
// ---------------------------------------------------------------------------

describe('adaptTheme', () => {
  it('returns an object with primaryColor set to "primary"', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.primaryColor).toBe('primary');
  });

  it('creates a primary color tuple with 10 entries', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.colors?.primary).toHaveLength(10);
  });

  it('creates a dark color tuple with 10 entries', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.colors?.dark).toHaveLength(10);
  });

  it('sets fontFamily from theme typography', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.fontFamily).toContain('Inter');
  });

  it('sets all heading sizes', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.headings?.sizes?.h1?.fontSize).toBe('2rem');
    expect(result.headings?.sizes?.h6?.fontSize).toBe('0.875rem');
  });

  it('sets spacing scale from definition', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.spacing?.xs).toBe('0.625rem');
    expect(result.spacing?.xl).toBe('2rem');
  });

  it('sets radius scale from definition', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.radius?.md).toBe('0.5rem');
  });

  it('generates component overrides', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    expect(result.components).toBeDefined();
    // Check some expected auto-generated components exist
    const components = result.components as Record<string, unknown>;
    expect(components['Card']).toBeDefined();
    expect(components['Button']).toBeDefined();
    expect(components['Input']).toBeDefined();
    expect(components['Modal']).toBeDefined();
    expect(components['Select']).toBeDefined();
    expect(components['Tabs']).toBeDefined();
  });

  it('stores semantic colors in theme.other', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    const other = result.other as Record<string, unknown>;
    const colors = other['colors'] as Record<string, string>;
    expect(colors['background']).toBe('#0f172a');
    expect(colors['text']).toBe('#ffffff');
    expect(colors['success']).toBe('#22c55e');
  });

  it('works with a light theme definition', () => {
    const lightDef = deepMerge(
      JSON.parse(JSON.stringify(baseDefaults)),
      JSON.parse(JSON.stringify(defaultLightDef)),
    ) as unknown as ThemeDefinition;
    const result = adaptTheme(lightDef);
    expect(result.primaryColor).toBe('primary');
    expect(result.colors?.primary).toHaveLength(10);
  });

  it('merges explicit component overrides on top of auto-generated', () => {
    const def = makeThemeDef({
      components: {
        Button: {
          defaultProps: { variant: 'outline' },
        },
      },
    });
    const result = adaptTheme(def);
    const button = result.components?.Button as Record<string, unknown> | undefined;
    expect(button).toBeDefined();
    // The explicit override should take precedence
    const props = button?.defaultProps as Record<string, unknown>;
    expect(props?.variant).toBe('outline');
  });
});
