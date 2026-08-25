import { useMemo } from 'react';
import { getTheme } from '@/themes/index';
import { resolveChromeThemeId } from '@/themes/chromeTheme';
import { resolveColors, withAlpha } from '@mullion/theme-engine';
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

export function useBuilderShellColors(applyThemeEverywhere = false): BuilderShellColors {
  const { themeId, colorScheme } = useTheme();
  const chromeThemeId = resolveChromeThemeId(applyThemeEverywhere, themeId);
  const chromeEntry = getTheme(chromeThemeId);
  const chromeScheme = applyThemeEverywhere ? colorScheme : chromeEntry.meta.colorScheme;

  return useMemo(() => {
    const colors = resolveColors(chromeEntry.definition.colors, chromeScheme);
    const accent = colors.primaryStroke;

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
      scrollbar: withAlpha(colors.textMuted, chromeScheme === 'dark' ? 0.35 : 0.28),
    };
  }, [chromeEntry, chromeScheme]);
}