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

  // P76-I: this assertion set used to read `Input.styles().input.borderColor`
  // and `...['&:focus'].borderColor`, and it passed while the product had NO
  // focus indicator on any text input or select. Mantine's `styles` prop is
  // inline styles: the flat colour outranked Mantine's own
  // `border: 1px solid var(--input-bd)`, and the nested `'&:focus'` key was
  // dropped on the floor. The test was green because it inspected the config
  // object, never the mechanism that paints.
  //
  // The colours now travel as CSS custom properties on the Input *wrapper*,
  // which is what Mantine's own rules read — including
  // `:focus { --input-bd: var(--input-bd-focus) }`. Asserting on `vars` is
  // therefore asserting on something that reaches a pixel; verified in a
  // browser with transitions disabled (border moves #648284 -> #008e85).
  it('routes input-family border and focus colours through CSS variables, not inline styles', () => {
    const def = makeThemeDef();
    const result = adaptTheme(def);
    const other = result.other as Record<string, unknown>;
    const colors = other['colors'] as Record<string, string>;

    const inputVars = (
      result.components?.Input as
        | { vars?: () => { wrapper?: Record<string, string> } }
        | undefined
    )?.vars?.().wrapper;

    expect(inputVars?.['--input-bd']).toBe(colors['borderStrong']);
    expect(inputVars?.['--input-bd-focus']).toBe(colors['primaryStroke']);
    expect(colors['borderStrong']).not.toBe(colors['border']);

    // A single `Input` entry is what reaches TextInput / PasswordInput /
    // Select / NumberInput / ColorInput, because Mantine calls
    // useStyles({ name: ['Input', __staticSelector] }) for all of them. Those
    // components must therefore NOT re-declare the input part themselves —
    // an inline colour there would pin the border again and re-break focus.
    for (const name of ['TextInput', 'PasswordInput', 'Select', 'NumberInput', 'ColorInput']) {
      const comp = result.components?.[name] as
        | { styles?: () => Record<string, Record<string, unknown>> }
        | undefined;
      expect(comp?.styles?.()['input']).toBeUndefined();
    }

    // P76-I-2: Checkbox is not an Input-family control, but it had the same
    // defect — an inline `borderColor` outranking Mantine's checked rule,
    // which sets background AND border from `--checkbox-color`. The colour now
    // travels as a variable consumed by a class rule, so the checked state can
    // paint its own border.
    const checkbox = result.components?.Checkbox as
      | {
          vars?: () => { root?: Record<string, string> };
          classNames?: Record<string, string>;
          styles?: () => Record<string, Record<string, unknown>>;
        }
      | undefined;
    expect(checkbox?.vars?.().root?.['--mullion-checkbox-bd']).toBe(colors['borderStrong']);
    expect(checkbox?.classNames?.['input']).toBe(themeStateClasses.checkboxInput);
    // The inline border-color is what broke it; it must not come back.
    expect(checkbox?.styles?.()['input']?.['borderColor']).toBeUndefined();
  });

  // P76-I-2: rows had no hover state at all, because Mantine only highlights
  // when `highlightOnHover` is set. Restoring the deleted rule verbatim would
  // have been imperceptible — it used `surface2`, three points from `surface`
  // on default-dark — so the hover colour is `surfaceRaised`.
  it('gives table rows a hover state that is actually distinguishable', () => {
    const result = adaptTheme(makeThemeDef());
    const colors = (result.other as Record<string, unknown>)['colors'] as Record<string, string>;
    const table = result.components?.Table as
      | {
          defaultProps?: { highlightOnHover?: boolean };
          vars?: () => { table?: Record<string, string> };
        }
      | undefined;

    expect(table?.defaultProps?.highlightOnHover).toBe(true);
    expect(table?.vars?.().table?.['--table-hover-color']).toBe(colors['surfaceRaised']);
    // The token it must NOT be: surface2 is within a few points of surface.
    expect(table?.vars?.().table?.['--table-hover-color']).not.toBe(colors['surface2']);
  });

  // P76-I / Finding D: the Switch declares `borderColor: borderStrong` on its
  // track, but the track computes to `border-width: 0px` — the Switch does not
  // use Mantine's input-variant block, so `--input-bd` is never defined for it
  // and the colour paints nothing. Measured in a browser in both chrome modes.
  // This test pins the CURRENT, INERT state deliberately so that whichever way
  // P76-I-2 decides it (give the track a real border, or drop the declaration)
  // is a conscious edit rather than a silent drift.
  it('declares a Switch track border colour that is currently not painted', () => {
    const result = adaptTheme(makeThemeDef());
    const colors = (result.other as Record<string, unknown>)['colors'] as Record<string, string>;
    const track = (
      result.components?.Switch as
        | { styles?: () => Record<string, { borderColor?: string }> }
        | undefined
    )?.styles?.()['track']?.borderColor;
    expect(track).toBe(colors['borderStrong']);
  });

  it('uses the authored primaryFill, not hardcoded primary[5], on a theme whose shade is not 5', () => {
    const tokyo = bundledThemeDefinitions.find((t) => t.id === 'tokyo-night')!;
    const def = deepMerge(
      JSON.parse(JSON.stringify(baseDefaults)),
      JSON.parse(JSON.stringify(tokyo)),
    ) as unknown as ThemeDefinition;
    const result = adaptTheme(def);
    const colors = (result.other as Record<string, unknown>)['colors'] as Record<string, string>;
    const fill = colors['primaryFill'];
    const fillIndex = result.colors?.primary?.indexOf(fill);
    expect(fillIndex).not.toBe(5);
    expect(fillIndex).toBeGreaterThanOrEqual(0);

    // P76-I: this used to assert on `Checkbox.styles().input['&:checked']`,
    // a nested key that Mantine silently dropped — the assertion could not
    // have failed for the reason it claimed to test. Slider's bar is a flat,
    // painted consumer of the same token.
    const sliderBar = (
      result.components?.Slider as
        | { styles?: () => Record<string, { backgroundColor?: string }> }
        | undefined
    )?.styles?.()['bar']?.backgroundColor;
    expect(sliderBar).toBe(colors['primaryFill']);
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

/**
 * P76-I: Mantine's `styles` prop becomes React's inline `style` object.
 * `getStyle()` in @mantine/core spreads the resolved object straight into
 * `style`, and no `stylesTransform` (the @mantine/emotion escape hatch) is
 * registered in this app — so a nested key like `'&:focus'` is handed to the
 * DOM as a CSS property name, silently dropped, and paints nothing.
 *
 * This was not a theoretical concern: `Input.styles` carried
 * `'&:focus': { borderColor: stroke }` alongside a flat
 * `borderColor: rc.borderStrong`. The flat colour became an inline style,
 * which outranks Mantine's own `border: 1px solid var(--input-bd)` — the rule
 * that `.m_8fb7ebe7:focus { --input-bd: var(--input-bd-focus) }` drives. So
 * the adapter both destroyed the working focus indicator AND its replacement
 * never shipped. Text inputs and selects had no focus indicator at all
 * (WCAG 2.4.7). Verified in a real browser, transitions disabled.
 *
 * State-dependent styling must therefore go through `vars` (CSS custom
 * properties, which cascade into Mantine's own pseudo-class rules) or through
 * `classNames` + a stylesheet — never through `styles`.
 */
describe('adapter styles contain no nested selectors', () => {
  const NESTED = /^\s*[&:@]|::?[a-z-]+\s*$|\[data-/i;

  // bundledThemeDefinitions are partials; adaptTheme needs them merged onto
  // baseThemeDefaults, the same way the registry does at runtime.
  const fullDefs = bundledThemeDefinitions.map(
    (d) =>
      [
        d.id,
        deepMerge(
          JSON.parse(JSON.stringify(baseDefaults)),
          JSON.parse(JSON.stringify(d)),
        ) as unknown as ThemeDefinition,
      ] as const,
  );

  it.each(fullDefs)(
    'theme %s emits only flat CSS properties from every styles() block',
    (_id, def) => {
      const components = adaptTheme(def).components ?? {};
      const offenders: string[] = [];

      for (const [componentName, config] of Object.entries(components)) {
        const styles = (config as { styles?: unknown }).styles;
        if (typeof styles !== 'function') continue;
        // Every styles() in the adapter ignores its arguments.
        const resolved = (styles as () => Record<string, Record<string, unknown>>)();
        for (const [selector, decls] of Object.entries(resolved ?? {})) {
          if (!decls || typeof decls !== 'object') continue;
          for (const prop of Object.keys(decls)) {
            if (NESTED.test(prop)) {
              offenders.push(`${componentName}.${selector} → ${prop}`);
            }
          }
        }
      }

      expect(offenders).toEqual([]);
    },
  );
});
