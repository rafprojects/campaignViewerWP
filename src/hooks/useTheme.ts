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

import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from '../contexts/themeContextDef';

/**
 * Access the theme context. Must be used within a <ThemeProvider>.
 *
 * Returns the current theme ID, Mantine override, color scheme,
 * available themes, and a setter for instant switching.
 *
 * @throws Error if used outside ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error(
      'useTheme() must be used within a <ThemeProvider>. ' +
        'Wrap your app in <ThemeProvider> from src/contexts/ThemeContext.tsx.',
    );
  }
  return ctx;
}
