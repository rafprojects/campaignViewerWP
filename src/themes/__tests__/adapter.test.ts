/**
 * Tests for src/themes/adapter.ts
 *
 * Covers: adaptTheme — JSON → MantineThemeOverride conversion
 */

import { describe, it, expect } from 'vitest';
import { adaptTheme, themeStateClasses } from '../adapter';
// [P51-L] Theme types + bundled definitions now live in the theme-engine package.
import { type ThemeDefinition, baseThemeDefaults, bundledThemeDefinitions } from '@mullion/theme-engine';

const baseDefaults = baseThemeDefaults;
const defaultDarkDef = bundledThemeDefinitions.find((t) => t.id === 'default-dark')!;
const defaultLightDef = bundledThemeDefinitions.find((t) => t.id === 'default-light')!;

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

  it('adds stable classNames for Mantine active and selected state styling', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);

    const tabs = result.components?.Tabs as { classNames?: Record<string, string> } | undefined;
    const segmentedControl = result.components?.SegmentedControl as { classNames?: Record<string, string> } | undefined;
    const select = result.components?.Select as { classNames?: Record<string, string> } | undefined;

    expect(tabs?.classNames?.tab).toBe(themeStateClasses.tabsTab);
    expect(segmentedControl?.classNames?.label).toBe(themeStateClasses.segmentedControlLabel);
    expect(select?.classNames?.option).toBe(themeStateClasses.selectOption);
  });

  it('stores semantic colors in theme.other', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    const other = result.other as Record<string, unknown>;
    const colors = other['colors'] as Record<string, string>;
    expect(colors['background']).toBe('#08141b');
    expect(colors['text']).toBe('#eef8fb');
    expect(colors['success']).toBe('#56b93e');
  });

  it('uses borderStrong for input-outline roles including NumberInput, ColorInput, Checkbox, and Switch', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    const other = result.other as Record<string, unknown>;
    const colors = other['colors'] as Record<string, string>;
    const componentBorder = (name: string, part: 'input' | 'track'): string | undefined => {
      const comp = result.components?.[name] as
        | { styles?: () => Record<string, { borderColor?: string }> }
        | undefined;
      return comp?.styles?.()[part]?.borderColor;
    };

    expect(componentBorder('Input', 'input')).toBe(colors['borderStrong']);
    expect(componentBorder('TextInput', 'input')).toBe(colors['borderStrong']);
    expect(componentBorder('PasswordInput', 'input')).toBe(colors['borderStrong']);
    expect(componentBorder('NumberInput', 'input')).toBe(colors['borderStrong']);
    expect(componentBorder('ColorInput', 'input')).toBe(colors['borderStrong']);
    expect(componentBorder('Checkbox', 'input')).toBe(colors['borderStrong']);
    expect(componentBorder('Switch', 'track')).toBe(colors['borderStrong']);
    expect(colors['borderStrong']).not.toBe(colors['border']);

    const checkbox = result.components?.Checkbox as
      | { styles?: () => { input?: { '&:checked'?: { backgroundColor?: string; borderColor?: string } } } }
      | undefined;
    const checked = checkbox?.styles?.().input?.['&:checked'];
    expect(checked?.backgroundColor).toBe(result.colors?.primary?.[5]);
    expect(checked?.borderColor).toBe(result.colors?.primary?.[5]);
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
