/**
 * Theme Provider — React component for runtime theme switching
 *
 * Provides:
 *  - Current theme ID and MantineThemeOverride
 *  - setTheme() for instant O(1) switching (Map lookup)
 *  - Available theme list for UI pickers
 *  - LocalStorage persistence (respects admin disable flag)
 *  - WP config injection reading
 *  - Shadow DOM CSS variable injection
 *
 * Context definition lives in themeContextDef.ts for Fast Refresh
 * compatibility. The useTheme() hook lives in hooks/useTheme.ts.
 *
 * Gold source: docs/THEME_SYSTEM_ASSESSMENT.md §3 & §4
 */

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { ThemeContext, type ThemeContextValue } from './themeContextDef';
import {
  getTheme,
  getAllThemeMeta,
  hasTheme,
  DEFAULT_THEME_ID,
  type ThemeEntry,
} from '../themes/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'wpsg-theme-id';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Determine the initial theme ID from (in priority order):
 *  1. WP config injection (global variable or data attribute)
 *  2. WP __WPSG_CONFIG__.theme (embed shortcode injection)
 *  3. User's localStorage preference (if persistence allowed)
 *  4. DEFAULT_THEME_ID fallback
 */
function resolveInitialThemeId(allowPersistence: boolean): string {
  // 1. WP injected config (set by PHP on the embed container)
  const wpConfigId: string | null | undefined =
    (typeof window !== 'undefined'
      ? window.__wpsgThemeId
      : undefined) ??
    document.querySelector('[data-wpsg-theme]')?.getAttribute('data-wpsg-theme');

  if (wpConfigId && hasTheme(wpConfigId)) {
    return wpConfigId;
  }

  // 2. __WPSG_CONFIG__.theme (set by WP embed shortcode)
  if (typeof window !== 'undefined') {
    const configTheme = window.__WPSG_CONFIG__?.theme;
    if (configTheme && hasTheme(configTheme)) {
      return configTheme;
    }
  }

  // 3. LocalStorage persistence
  if (allowPersistence && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && hasTheme(stored)) {
        return stored;
      }
    } catch {
      // Storage blocked — silently fall through
    }
  }

  // 3. Default fallback
  return DEFAULT_THEME_ID;
}

/**
 * Persist theme ID to localStorage (best-effort, never throws).
 */
function persistThemeId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage full or blocked — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ThemeProviderProps {
  children: ReactNode;

  /**
   * Allow localStorage persistence of the user's theme choice.
   * Defaults to true. Set to false when WP admin has disabled
   * user theme overrides.
   */
  allowPersistence?: boolean;

  /**
   * Force a specific theme ID (overrides localStorage and WP config).
   * Used for preview mode or admin-controlled embedding.
   */
  forcedThemeId?: string;

  /**
   * Shadow DOM root reference. When provided, the CSS variables will
   * be injected into this element via a <style> tag for Shadow DOM
   * isolation.
   */
  shadowRoot?: ShadowRoot | null;
}

export function ThemeProvider({
  children,
  allowPersistence = true,
  forcedThemeId,
  shadowRoot,
}: ThemeProviderProps) {
  // Resolve initial theme
  const initialId = forcedThemeId ?? resolveInitialThemeId(allowPersistence);

  const [themeId, setThemeIdState] = useState<string>(initialId);

  // Lookup from the pre-computed registry — O(1), no re-computation
  const entry: ThemeEntry = useMemo(() => getTheme(themeId), [themeId]);

  // Available themes (static after startup, memoize once)
  const availableThemes = useMemo(() => getAllThemeMeta(), []);

  // setTheme handler
  const setTheme = useCallback(
    (id: string) => {
      const resolvedId = hasTheme(id) ? id : DEFAULT_THEME_ID;

      setThemeIdState(resolvedId);

      if (allowPersistence && !forcedThemeId) {
        persistThemeId(resolvedId);
      }
    },
    [allowPersistence, forcedThemeId],
  );

  // Sync forced theme changes (e.g., admin changes during session)
  useEffect(() => {
    if (forcedThemeId && hasTheme(forcedThemeId)) {
      setThemeIdState(forcedThemeId);
    }
  }, [forcedThemeId]);

  // Shadow DOM CSS variable injection
  useEffect(() => {
    if (!shadowRoot) return;

    const styleId = 'wpsg-theme-vars';
    let styleEl = shadowRoot.querySelector(`#${styleId}`) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      shadowRoot.prepend(styleEl);
    }

    styleEl.textContent = entry.cssVars;
  }, [shadowRoot, entry.cssVars]);

  // Context value — memoized to prevent unnecessary re-renders
  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      mantineTheme: entry.mantine,
      colorScheme: entry.meta.colorScheme,
      cssVars: entry.cssVars,
      availableThemes,
      setTheme,
    }),
    [themeId, entry, availableThemes, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

