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
import type { ThemeDefinition, ResolvedColors } from './types';
import { resolveColors, withAlpha } from './colorGen';

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
  return {
    Button: {
      defaultProps: { variant: 'filled' },
      styles: () => ({
        root: {
          fontWeight: 600,
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

    Input: {
      styles: () => ({
        input: {
          backgroundColor: rc.surface,
          borderColor: rc.border,
          color: rc.text,
          '&::placeholder': { color: rc.textMuted2 },
          '&:focus': { borderColor: rc.primary[5] },
        },
      }),
    },

    TextInput: {
      styles: () => ({
        input: {
          backgroundColor: rc.surface,
          borderColor: rc.border,
          color: rc.text,
          '&::placeholder': { color: rc.textMuted2 },
          '&:focus': { borderColor: rc.primary[5] },
        },
        label: { color: rc.textMuted, fontWeight: 500 },
      }),
    },

    PasswordInput: {
      styles: () => ({
        input: {
          backgroundColor: rc.surface,
          borderColor: rc.border,
          color: rc.text,
          '&::placeholder': { color: rc.textMuted2 },
          '&:focus': { borderColor: rc.primary[5] },
        },
        label: { color: rc.textMuted, fontWeight: 500 },
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
        title: { color: rc.text, fontWeight: 600 },
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
          fontWeight: 600,
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
        title: { color: rc.text, fontWeight: 600 },
        message: { color: rc.textMuted },
      }),
    },

    Group: {
      defaultProps: { gap: 'sm' },
    },

    Tabs: {
      styles: () => ({
        root: { borderColor: rc.border },
        tab: {
          color: rc.textMuted,
          fontWeight: 500,
          '&[data-active]': {
            color: rc.text,
            borderColor: rc.primary[5],
          },
          '&:hover': {
            backgroundColor: withAlpha(rc.surface2, 0.5),
          },
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
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          fontSize: '0.75rem',
          letterSpacing: '0.03em',
        },
        tr: {
          borderBottom: `1px solid ${withAlpha(rc.border, 0.5)}`,
          '&:hover': { backgroundColor: withAlpha(rc.surface2, 0.3) },
        },
        td: { color: rc.text },
      }),
    },

    SegmentedControl: {
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
          '&[data-active]': { color: rc.text },
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
          '&::before': { backgroundColor: rc.primary[5] },
        },
        title: { color: rc.text },
        description: { color: rc.textMuted },
        closeButton: { color: rc.textMuted },
      }),
    },

    Tooltip: {
      styles: () => ({
        tooltip: {
          backgroundColor: rc.surface2,
          color: rc.text,
          border: `1px solid ${rc.border}`,
          fontSize: '0.8125rem',
        },
      }),
    },

    Menu: {
      styles: () => ({
        dropdown: {
          backgroundColor: rc.surface,
          border: `1px solid ${rc.border}`,
        },
        item: {
          color: rc.text,
          '&:hover': { backgroundColor: rc.surface2 },
        },
        label: { color: rc.textMuted },
      }),
    },

    Select: {
      styles: () => ({
        input: {
          backgroundColor: rc.surface,
          borderColor: rc.border,
          color: rc.text,
        },
        dropdown: {
          backgroundColor: rc.surface,
          border: `1px solid ${rc.border}`,
        },
        option: {
          color: rc.text,
          '&[data-selected]': {
            backgroundColor: rc.primary[5],
            color: '#ffffff',
          },
          '&:hover': { backgroundColor: rc.surface2 },
        },
      }),
    },

    Checkbox: {
      styles: () => ({
        input: {
          borderColor: rc.border,
          '&:checked': {
            backgroundColor: rc.primary[5],
            borderColor: rc.primary[5],
          },
        },
        label: { color: rc.text },
      }),
    },

    Switch: {
      styles: () => ({
        track: {
          borderColor: rc.border,
          backgroundColor: rc.surface2,
        },
        label: { color: rc.text },
      }),
    },

    Anchor: {
      styles: () => ({
        root: {
          color: rc.primary[5],
          '&:hover': { color: rc.primary[4] },
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
        text: rc.text,
        textMuted: rc.textMuted,
        textMuted2: rc.textMuted2,
        border: rc.border,
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

  theme.components = mergedComponents as MantineThemeOverride['components'];

  return theme;
}
