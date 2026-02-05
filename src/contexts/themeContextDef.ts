/**
 * Theme Context Definition
 *
 * Separated from the provider component for React Fast Refresh
 * compatibility. The context and its value type live here; the
 * ThemeProvider component lives in ThemeContext.tsx.
 */

import { createContext } from 'react';
import type { MantineThemeOverride } from '@mantine/core';
import type { ThemeMeta } from '../themes/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  /** Current theme ID */
  themeId: string;

  /** Current MantineThemeOverride (pre-computed, O(1) lookup) */
  mantineTheme: MantineThemeOverride;

  /** Current theme's color scheme ('light' | 'dark') */
  colorScheme: 'light' | 'dark';

  /** Pre-generated CSS variable string for Shadow DOM injection */
  cssVars: string;

  /** All available theme metadata for picker UI */
  availableThemes: ThemeMeta[];

  /**
   * Switch to a different theme. If the ID is invalid, falls back to
   * default-dark silently (with dev warning).
   */
  setTheme: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const ThemeContext = createContext<ThemeContextValue | null>(null);
ThemeContext.displayName = 'WPSGThemeContext';
