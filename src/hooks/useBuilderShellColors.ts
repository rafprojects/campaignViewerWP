import { useMemo } from 'react';
import { getTheme } from '@/themes/index';
import { resolveColors, withAlpha } from '@/themes/colorGen';
import { useTheme } from './useTheme';

export interface BuilderShellColors {
  surface: string;
  surface2: string;
  surface3: string;
  background: string;
  border: string;
  borderMuted: string;
  text: string;
  textMuted: string;
  textMuted2: string;
  accent: string;
  accentSoft: string;
  iconHover: string;
  shadow: string;
  scrollbar: string;
}

export function useBuilderShellColors(): BuilderShellColors {
  const { themeId, colorScheme } = useTheme();

  return useMemo(() => {
    const themeEntry = getTheme(themeId);
    const colors = resolveColors(themeEntry.definition.colors, colorScheme);
    const accent = colors.primary[5] ?? colors.accent;

    return {
      surface: colors.surface,
      surface2: colors.surface2,
      surface3: colors.surface3,
      background: colors.background,
      border: colors.border,
      borderMuted: withAlpha(colors.border, 0.65),
      text: colors.text,
      textMuted: colors.textMuted,
      textMuted2: colors.textMuted2,
      accent,
      accentSoft: withAlpha(accent, 0.14),
      iconHover: withAlpha(colors.surface3, 0.78),
      shadow: `8px 8px 8px 0 ${withAlpha(colors.background, 0.32)}`,
      scrollbar: withAlpha(colors.textMuted, colorScheme === 'dark' ? 0.35 : 0.28),
    };
  }, [themeId, colorScheme]);
}