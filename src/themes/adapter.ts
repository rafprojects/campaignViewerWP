/**
 * Theme Adapter — JSON → MantineThemeOverride
 *
 * Converts a validated ThemeDefinition into a MantineThemeOverride
 * object with fully auto-generated component overrides. This is the
 * heart of the theme system: it reads the palette and programmatically
 * builds every component's style rules so individual theme JSONs only
 * need to specify colors, not 20+ component blocks.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §2.5
 */

import type { MantineThemeOverride, MantineColorShade } from '@mantine/core';
import { colorsTuple } from '@mantine/core';
import type { ThemeDefinition, ResolvedColors } from '@mullion/theme-engine';
import { resolveColors, withAlpha } from '@mullion/theme-engine';

const TABS_TAB_CLASS = 'mullion-mantine-tabs-tab';
const SEGMENTED_CONTROL_LABEL_CLASS = 'mullion-mantine-segmented-control-label';
const SELECT_OPTION_CLASS = 'mullion-mantine-select-option';
// 'md' is intentionally larger than Mantine 9's default 'sm' to match the
// PHASE26 design decision (see docs/PHASE26_REVIEW.md Track P26-B).
const DEFAULT_RADIUS = 'md';
const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
const FONT_WEIGHT_MEDIUM = FONT_WEIGHTS.medium;
const FONT_WEIGHT_SEMIBOLD = FONT_WEIGHTS.semibold;

// ---------------------------------------------------------------------------
// Component override generator
// ---------------------------------------------------------------------------

/**
 * Auto-generate all Mantine component overrides from the resolved
 * color palette. Each component's styles are derived from the palette
 * so that theme authors only need to define colors — the component
 * visuals follow automatically.
 *
 * Any explicit `components` in the ThemeDefinition take precedence
 * over these auto-generated ones (merged on top).
 */
function generateComponentOverrides(
  rc: ResolvedColors,
): NonNullable<MantineThemeOverride['components']> {
  const fill = rc.primaryFill;
  const stroke = rc.primaryStroke;
  const onFill = rc.primaryOnFill;

  return {
    Button: {
      defaultProps: { variant: 'filled', autoContrast: true },
      styles: () => ({
        root: {
          fontWeight: FONT_WEIGHT_SEMIBOLD,
          transition: 'background 150ms ease, border 150ms ease, opacity 150ms ease',
        },
      }),
    },

    Card: {
      styles: () => ({
        root: {
          backgroundColor: rc.surface,
          borderColor: rc.border,
          color: rc.text,
        },
      }),
    },

    Paper: {
      styles: () => ({
        root: {
          backgroundColor: rc.surface,
          color: rc.text,
        },
      }),
    },

    // Mantine renders every input-family control through `Input`, calling
    // useStyles({ name: ['Input', __staticSelector] }) — so this single entry
    // reaches Input / TextInput / PasswordInput / Select / NumberInput /
    // ColorInput at once.
    //
    // These MUST be `vars` (CSS custom properties on the wrapper), never
    // `styles`. Mantine's `styles` prop becomes React's inline `style` object,
    // and an inline `border-color` outranks the stylesheet rule
    // `border: 1px solid var(--input-bd)` — which is precisely how Mantine
    // signals focus:
    //
    //   .m_8fb7ebe7:focus { outline: none; --input-bd: var(--input-bd-focus); }
    //
    // Writing the colour flat pinned the border and silently destroyed the
    // focus indicator: measured in a browser, `--input-bd` flipped correctly
    // on focus while the painted border never moved. Writing it as a variable
    // lets the focus rule win. See P76-I.
    Input: {
      vars: () => ({
        wrapper: {
          '--input-bd': rc.borderStrong,
          '--input-bd-focus': stroke,
          '--input-bg': rc.surface2,
          '--input-color': rc.text,
          '--input-placeholder-color': rc.textMuted2,
        },
      }),
    },

    TextInput: {
      styles: () => ({
        label: { color: rc.textMuted, fontWeight: FONT_WEIGHT_MEDIUM },
      }),
    },

    PasswordInput: {
      styles: () => ({
        label: { color: rc.textMuted, fontWeight: FONT_WEIGHT_MEDIUM },
        innerInput: { color: rc.text },
        visibilityToggle: { color: rc.textMuted },
      }),
    },

    Modal: {
      styles: () => ({
        content: {
          backgroundColor: rc.surface,
          border: `1px solid ${rc.border}`,
        },
        header: {
          backgroundColor: rc.surface,
          borderBottom: `1px solid ${rc.border}`,
        },
        title: { color: rc.text, fontWeight: FONT_WEIGHT_SEMIBOLD },
        close: { color: rc.textMuted },
        overlay: { backgroundColor: withAlpha(rc.background, 0.75) },
      }),
    },

    ActionIcon: {
      styles: () => ({
        root: {
          transition: 'background 150ms ease, color 150ms ease',
        },
      }),
    },

    Badge: {
      styles: () => ({
        root: {
          fontWeight: FONT_WEIGHT_SEMIBOLD,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.02em',
        },
      }),
    },

    Alert: {
      styles: () => ({
        root: {
          backgroundColor: rc.surface,
          border: `1px solid ${rc.border}`,
        },
        title: { color: rc.text, fontWeight: FONT_WEIGHT_SEMIBOLD },
        message: { color: rc.textMuted },
      }),
    },

    Group: {
      defaultProps: { gap: 'sm' },
    },

    Tabs: {
      classNames: {
        tab: TABS_TAB_CLASS,
      },
      styles: () => ({
        root: { borderColor: rc.border },
        tab: {
          color: rc.textMuted,
          fontWeight: FONT_WEIGHT_MEDIUM,
        },
        panel: { color: rc.text },
      }),
    },

    Table: {
      styles: () => ({
        table: { color: rc.text },
        thead: { borderBottom: `2px solid ${rc.border}` },
        th: {
          color: rc.textMuted,
          fontWeight: FONT_WEIGHT_SEMIBOLD,
          textTransform: 'uppercase' as const,
          fontSize: '0.75rem',
          letterSpacing: '0.03em',
        },
        tr: {
          borderBottom: `1px solid ${withAlpha(rc.border, 0.5)}`,
        },
        td: { color: rc.text },
      }),
    },

    SegmentedControl: {
      classNames: {
        label: SEGMENTED_CONTROL_LABEL_CLASS,
      },
      styles: () => ({
        root: {
          backgroundColor: rc.surface,
          borderColor: rc.border,
        },
        indicator: {
          backgroundColor: rc.surface2,
        },
        label: {
          color: rc.textMuted,
        },
      }),
    },

    Container: {
      defaultProps: { size: 'lg' },
    },

    Loader: {
      defaultProps: { type: 'dots', size: 'md' },
    },

    Notification: {
      styles: () => ({
        root: {
          backgroundColor: rc.surface,
          border: `1px solid ${rc.border}`,
        },
        title: { color: rc.text },
        description: { color: rc.textMuted },
        closeButton: { color: rc.textMuted },
      }),
    },

    Tooltip: {
      styles: () => ({
        tooltip: {
          backgroundColor: rc.surfaceRaised,
          color: rc.text,
          border: `1px solid ${rc.border}`,
          fontSize: '0.8125rem',
        },
      }),
    },

    Menu: {
      styles: () => ({
        dropdown: {
          backgroundColor: rc.surfaceRaised,
          border: `1px solid ${rc.border}`,
        },
        item: {
          color: rc.text,
        },
        label: { color: rc.textMuted },
      }),
    },

    Select: {
      classNames: {
        option: SELECT_OPTION_CLASS,
      },
      styles: () => ({
        dropdown: {
          backgroundColor: rc.surfaceRaised,
          border: `1px solid ${rc.border}`,
        },
        option: {
          color: rc.text,
        },
      }),
    },

    Checkbox: {
      styles: () => ({
        input: {
          borderColor: rc.borderStrong,
        },
        label: { color: rc.text },
      }),
    },

    Switch: {
      styles: () => ({
        track: {
          borderColor: rc.borderStrong,
          backgroundColor: rc.surface2,
        },
        label: { color: rc.text },
      }),
    },

    Anchor: {
      styles: () => ({
        root: {
          color: fill,
        },
      }),
    },

    Accordion: {
      styles: () => ({
        item: {
          borderColor: rc.border,
          backgroundColor: rc.surface,
        },
        control: {
          color: rc.text,
        },
        label: { color: rc.text },
        panel: { color: rc.text },
        chevron: { color: rc.textMuted },
      }),
    },

    Popover: {
      styles: () => ({
        dropdown: {
          backgroundColor: rc.surfaceRaised,
          border: `1px solid ${rc.border}`,
          color: rc.text,
        },
      }),
    },

    Divider: {
      styles: () => ({
        root: { borderColor: rc.border },
      }),
    },

    Slider: {
      styles: () => ({
        track: { backgroundColor: rc.surface3 },
        bar: { backgroundColor: fill },
        thumb: { borderColor: stroke, backgroundColor: rc.surface },
        label: { backgroundColor: fill, color: onFill },
      }),
    },

    NumberInput: {
      styles: () => ({
        label: { color: rc.textMuted, fontWeight: FONT_WEIGHT_MEDIUM },
        control: { borderColor: rc.borderStrong, color: rc.text },
      }),
    },

    ColorInput: {
      styles: () => ({
        label: { color: rc.textMuted, fontWeight: FONT_WEIGHT_MEDIUM },
        dropdown: {
          backgroundColor: rc.surfaceRaised,
          border: `1px solid ${rc.border}`,
        },
      }),
    },

    Progress: {
      styles: () => ({
        root: { backgroundColor: rc.surface3 },
      }),
    },

    Chip: {
      styles: () => ({
        label: {
          color: rc.text,
          borderColor: rc.border,
        },
      }),
    },
  };
}

// ---------------------------------------------------------------------------
// Main adapter
// ---------------------------------------------------------------------------

/**
 * Convert a fully validated ThemeDefinition into a MantineThemeOverride.
 *
 * Pipeline:
 *  1. Resolve colors (expand shorthand, derive dark tuple)
 *  2. Build base Mantine config (colors, typography, spacing, etc.)
 *  3. Auto-generate component overrides from resolved palette
 *  4. Merge any explicit component overrides from the definition on top
 *
 * This function is called once per theme at startup. Results are
 * cached in the theme registry Map for O(1) runtime switching.
 *
 * @param def - Validated ThemeDefinition
 * @returns MantineThemeOverride ready to pass to MantineProvider
 */
export function adaptTheme(def: ThemeDefinition): MantineThemeOverride {
  const rc = resolveColors(def.colors, def.colorScheme);

  // 1. Base Mantine configuration
  const theme: MantineThemeOverride = {
    primaryColor: 'primary',
    primaryShade: {
      light: rc.primaryShade.light as MantineColorShade,
      dark: rc.primaryShade.dark as MantineColorShade,
    },
    defaultRadius: DEFAULT_RADIUS,
    fontWeights: FONT_WEIGHTS,

    colors: {
      primary: colorsTuple(rc.primary),
      dark: colorsTuple(rc.dark),
    },

    fontFamily: def.typography.fontFamily,
    fontFamilyMonospace: def.typography.fontFamilyMono,

    fontSizes: {
      xs: def.typography.fontSizes.xs,
      sm: def.typography.fontSizes.sm,
      md: def.typography.fontSizes.md,
      lg: def.typography.fontSizes.lg,
      xl: def.typography.fontSizes.xl,
    },

    headings: {
      fontFamily: def.typography.headings.fontFamily,
      sizes: {
        h1: {
          fontSize: def.typography.headings.sizes.h1.fontSize,
          lineHeight: def.typography.headings.sizes.h1.lineHeight,
        },
        h2: {
          fontSize: def.typography.headings.sizes.h2.fontSize,
          lineHeight: def.typography.headings.sizes.h2.lineHeight,
        },
        h3: {
          fontSize: def.typography.headings.sizes.h3.fontSize,
          lineHeight: def.typography.headings.sizes.h3.lineHeight,
        },
        h4: {
          fontSize: def.typography.headings.sizes.h4.fontSize,
          lineHeight: def.typography.headings.sizes.h4.lineHeight,
        },
        h5: {
          fontSize: def.typography.headings.sizes.h5.fontSize,
          lineHeight: def.typography.headings.sizes.h5.lineHeight,
        },
        h6: {
          fontSize: def.typography.headings.sizes.h6.fontSize,
          lineHeight: def.typography.headings.sizes.h6.lineHeight,
        },
      },
    },

    spacing: {
      xs: def.spacing.xs,
      sm: def.spacing.sm,
      md: def.spacing.md,
      lg: def.spacing.lg,
      xl: def.spacing.xl,
    },

    radius: {
      xs: def.radius.xs,
      sm: def.radius.sm,
      md: def.radius.md,
      lg: def.radius.lg,
      xl: def.radius.xl,
    },

    shadows: {
      xs: def.shadows.xs,
      sm: def.shadows.sm,
      md: def.shadows.md,
      lg: def.shadows.lg,
      xl: def.shadows.xl,
    },

    breakpoints: {
      xs: def.breakpoints.xs,
      sm: def.breakpoints.sm,
      md: def.breakpoints.md,
      lg: def.breakpoints.lg,
      xl: def.breakpoints.xl,
    },

    other: {
      // Semantic tokens accessible via theme.other in Mantine components
      colors: {
        background: rc.background,
        surface: rc.surface,
        surface2: rc.surface2,
        surface3: rc.surface3,
        surfaceRaised: rc.surfaceRaised,
        text: rc.text,
        textMuted: rc.textMuted,
        textMuted2: rc.textMuted2,
        border: rc.border,
        borderStrong: rc.borderStrong,
        primaryFill: rc.primaryFill,
        primaryStroke: rc.primaryStroke,
        success: rc.success,
        warning: rc.warning,
        error: rc.error,
        info: rc.info,
        accent: rc.accent,
        accentGreen: rc.accentGreen,
        accentPurple: rc.accentPurple,
      },
      bodyBackground: rc.background,
    },
  };

  // 2. Auto-generate component overrides from palette
  const autoOverrides = generateComponentOverrides(rc);

  // 3. Merge: auto-generated ← explicit theme overrides (explicit wins)
  const explicitOverrides = def.components ?? {};
  const mergedComponents: Record<string, unknown> = { ...autoOverrides };

  for (const [name, override] of Object.entries(explicitOverrides)) {
    const existing = (mergedComponents[name] ?? {}) as Record<string, unknown>;
    mergedComponents[name] = {
      ...existing,
      ...override,
      // Deep-merge defaultProps if both exist
      ...(existing['defaultProps'] && override.defaultProps
        ? {
            defaultProps: {
              ...(existing['defaultProps'] as Record<string, unknown>),
              ...override.defaultProps,
            },
          }
        : {}),
    };
  }

  const components = mergedComponents as MantineThemeOverride['components'];
  if (components !== undefined) {
    theme.components = components;
  }

  return theme;
}

export const themeStateClasses = {
  tabsTab: TABS_TAB_CLASS,
  segmentedControlLabel: SEGMENTED_CONTROL_LABEL_CLASS,
  selectOption: SELECT_OPTION_CLASS,
} as const;
