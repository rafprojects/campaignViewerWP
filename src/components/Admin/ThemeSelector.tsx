/**
 * ThemeSelector — Admin theme picker with live preview swatches
 *
 * Reads available themes from useTheme().availableThemes and renders a
 * grouped Select dropdown with color-swatch previews and metadata-backed
 * descriptions. Selecting a theme calls setTheme() for instant switching
 * (no save button needed — theme is persisted to localStorage by ThemeProvider).
 *
 * Groups and descriptions come from the shared theme-catalog.json so the
 * React selector and the WordPress settings field stay in sync.
 *
 * Usage:
 * ```tsx
 * <ThemeSelector />
 * ```
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §12
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  Group,
  Text,
  ColorSwatch,
  Stack,
  type SelectProps,
} from '@mantine/core';
import { useTheme } from '@/hooks/useTheme';
import type { ThemeMeta } from '@wp-super-gallery/theme-engine';
import { getTheme, getAllThemeMetaGrouped } from '@/themes/index';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the base color string from a ColorShorthand value */
function colorStr(c: string | { base: string; shades: number } | undefined): string {
  if (!c) return '#888888';
  if (typeof c === 'string') return c;
  return c.base;
}

/** Build representative display swatches from a theme's definition */
function getSwatches(themeId: string): string[] {
  const entry = getTheme(themeId);
  if (!entry) return [];
  const c = entry.definition.colors;
  return [c.background, colorStr(c.primary), colorStr(c.accent), c.success, c.error];
}

// ---------------------------------------------------------------------------
// Grouped Select data builder
// ---------------------------------------------------------------------------

/**
 * Build Mantine Select data in grouped format:
 * [{ group: 'Default', items: [{ value, label }] }, ...]
 */
function buildSelectData(availableThemes: ThemeMeta[]): SelectProps['data'] {
  const availableIds = new Set(availableThemes.map((m) => m.id));
  const grouped = getAllThemeMetaGrouped();

  return grouped
    .map(({ group, themes }) => ({
      group,
      items: themes
        .filter((t) => availableIds.has(t.id))
        .map((t) => ({ value: t.id, label: t.name })),
    }))
    .filter((g) => g.items.length > 0);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ThemeSelectorProps {
  /** Controlled selected theme ID from settings state */
  value?: string | undefined;
  /** Override Select label (default: "Theme") */
  label?: string | undefined;
  /** Override Select description */
  description?: string | undefined;
  /** Additional Select props pass-through */
  selectProps?: Partial<SelectProps>;
  /** Called when the user selects a theme (for settings staging) */
  onThemeChange?: (themeId: string) => void;
}

export function ThemeSelector({
  value,
  label,
  description,
  selectProps,
  onThemeChange,
}: ThemeSelectorProps) {
  const { t } = useTranslation('wpsg');
  const effectiveLabel = label ?? t('admin_theme_label', 'Theme');
  const effectiveDescription = description ?? t('admin_theme_desc', 'Choose a color theme. Preview applies instantly; saved when you click Save.');
  const { themeId, availableThemes, setPreviewTheme } = useTheme();
  const resolvedValue = value ?? themeId;
  const { comboboxProps, ...restSelectProps } = selectProps ?? {};

  // Local state ensures the dropdown reflects the selection immediately,
  // even if the MantineProvider re-render introduced by setPreviewTheme
  // causes the Select to lose its controlled value momentarily.
  const [localValue, setLocalValue] = useState(resolvedValue);

  // Keep in sync when context themeId changes externally (e.g. on reset)
  useEffect(() => { setLocalValue(resolvedValue); }, [resolvedValue]);

  const data = buildSelectData(availableThemes);

  const renderOption: SelectProps['renderOption'] = ({ option }) => {
    const swatches = getSwatches(option.value);
    const meta = availableThemes.find((m) => m.id === option.value);
    // Use catalog-backed description; fall back to scheme hint
    const desc = meta?.description ?? (meta?.colorScheme === 'dark' ? t('admin_theme_dark', 'Dark theme') : t('admin_theme_light', 'Light theme'));

    return (
      <Group gap="sm" wrap="nowrap">
        <Group gap={4} style={{ flexShrink: 0 }}>
          {swatches.map((color, i) => (
            <ColorSwatch key={i} color={color} size={14} />
          ))}
        </Group>
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="sm" fw={500} truncate>
            {option.label}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {desc}
          </Text>
        </Stack>
      </Group>
    );
  };

  return (
    <Select
      label={effectiveLabel}
      description={effectiveDescription}
      value={localValue}
      onChange={(value) => {
        if (value) {
          setLocalValue(value);
          setPreviewTheme(value);
          onThemeChange?.(value);
        }
      }}
      data={data ?? []}
      renderOption={renderOption}
      allowDeselect={false}
      // Keep the dropdown in the same tree as the shadow-root modal so
      // preview updates and styling stay scoped to the active gallery instance.
      comboboxProps={{ ...comboboxProps, withinPortal: false }}
      {...restSelectProps}
    />
  );
}

setWpsgDebugDisplayName(ThemeSelector, 'AdminPanel:ThemeSelector');
