/**
 * useTheme Hook — Access the WPSG theme context
 *
 * Separated from ThemeContext.tsx for React Fast Refresh compatibility.
 * Components use this hook to read theme state and trigger switches.
 *
 * @example
 * ```tsx
 * const { themeId, setTheme, colorScheme } = useTheme();
 * ```
 */

import { useContext, useMemo } from 'react';
import { ThemeContext, type ThemeContextValue } from '../contexts/themeContextDef';
import { getTheme, getAllThemeMeta, DEFAULT_THEME_ID } from '../themes/index';

const noop = () => {};

/**
 * Access the theme context.
 *
 * Returns the current theme ID, Mantine override, color scheme,
 * available themes, and a setter for instant switching.
 *
 * If the ThemeProvider is missing (e.g. modal portal edge case),
 * returns safe defaults so the UI remains functional.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);

  const fallback = useMemo<ThemeContextValue>(() => {
    const entry = getTheme(DEFAULT_THEME_ID);
    return {
      themeId: DEFAULT_THEME_ID,
      mantineTheme: entry.mantine,
      colorScheme: entry.meta.colorScheme,
      cssVars: entry.cssVars,
      availableThemes: getAllThemeMeta(),
      setTheme: noop,
      setPreviewTheme: noop,
    };
  }, []);

  if (!ctx) {
    if (import.meta.env.DEV) {
      console.warn(
        'useTheme() called outside <ThemeProvider>. Using fallback defaults. ' +
          'This may indicate a portal rendering issue.',
      );
    }
    return fallback;
  }
  return ctx;
}
