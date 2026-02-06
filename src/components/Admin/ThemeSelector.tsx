/**
 * ThemeSelector — Admin theme picker with live preview swatches
 *
 * Reads available themes from useTheme().availableThemes and renders a
 * Select dropdown with color-swatch previews. Selecting a theme calls
 * setTheme() for instant switching (no save button needed — theme is
 * persisted to localStorage by ThemeProvider).
 *
 * Usage:
 * ```tsx
 * <ThemeSelector />
 * ```
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §12
 */

import { forwardRef } from 'react';
import {
  Select,
  Group,
  Text,
  ColorSwatch,
  Stack,
  type SelectProps,
} from '@mantine/core';
import { useTheme } from '@/hooks/useTheme';
import type { ThemeMeta } from '@/themes/types';
import { getTheme } from '@/themes/index';

// ---------------------------------------------------------------------------
// Swatch-based item renderer
// ---------------------------------------------------------------------------

interface ThemeItemProps extends React.ComponentPropsWithoutRef<'div'> {
  label: string;
  description: string;
  swatches: string[];
}

const ThemeSelectItem = forwardRef<HTMLDivElement, ThemeItemProps>(
  ({ label, description, swatches, ...others }, ref) => (
    <div ref={ref} {...others}>
      <Group gap="sm" wrap="nowrap">
        <Group gap={4}>
          {swatches.map((color, i) => (
            <ColorSwatch key={i} color={color} size={14} />
          ))}
        </Group>
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {label}
          </Text>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Stack>
      </Group>
    </div>
  ),
);

ThemeSelectItem.displayName = 'ThemeSelectItem';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the base color string from a ColorShorthand value */
function colorStr(c: string | { base: string; shades: number } | undefined): string {
  if (!c) return '#888888';
  if (typeof c === 'string') return c;
  return c.base;
}

/** Build display swatches from a theme's definition colors */
function getSwatches(themeId: string): string[] {
  const entry = getTheme(themeId);
  if (!entry) return [];
  const c = entry.definition.colors;
  return [c.background, colorStr(c.primary), colorStr(c.accent), c.success, c.error];
}

/** Produce a description string for a theme */
function getDescription(meta: ThemeMeta): string {
  return meta.colorScheme === 'dark' ? 'Dark theme' : 'Light theme';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface ThemeSelectorProps {
  /** Override Select label (default: "Theme") */
  label?: string;
  /** Override Select description */
  description?: string;
  /** Additional Select props pass-through */
  selectProps?: Partial<SelectProps>;
}

export function ThemeSelector({
  label = 'Theme',
  description = 'Choose a color theme. Changes apply instantly.',
  selectProps,
}: ThemeSelectorProps) {
  const { themeId, availableThemes, setTheme } = useTheme();

  const data = availableThemes.map((meta) => ({
    value: meta.id,
    label: meta.name,
  }));

  const renderOption: SelectProps['renderOption'] = ({ option }) => {
    const swatches = getSwatches(option.value);
    const meta = availableThemes.find((m) => m.id === option.value);
    const desc = meta ? getDescription(meta) : '';

    return (
      <Group gap="sm" wrap="nowrap">
        <Group gap={4}>
          {swatches.map((color, i) => (
            <ColorSwatch key={i} color={color} size={14} />
          ))}
        </Group>
        <Stack gap={0}>
          <Text size="sm" fw={500}>
            {option.label}
          </Text>
          <Text size="xs" c="dimmed">
            {desc}
          </Text>
        </Stack>
      </Group>
    );
  };

  return (
    <Select
      label={label}
      description={description}
      value={themeId}
      onChange={(value) => {
        if (value) setTheme(value);
      }}
      data={data}
      renderOption={renderOption}
      allowDeselect={false}
      {...selectProps}
    />
  );
}
