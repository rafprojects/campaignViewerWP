/**
 * P75-D: nested MantineProvider for Settings Panel + Layout Builder chrome.
 *
 * Must not change ThemedApp's provider — that tree also renders the public
 * gallery. Nested CSS variables are scoped to `.mullion-admin-chrome` so they
 * cannot overwrite `:root` / `:host` gallery tokens.
 *
 * P76-F: the provider is rendered in *both* states, and only its inputs
 * change. It used to return `children` bare when `applyThemeEverywhere` was
 * true, which made the two states structurally different trees. Because
 * SettingsPanel reads the flag off the live draft, flipping the Switch moved
 * `children` between tree depths mid-session, React unmounted the whole
 * Drawer subtree, and keyboard focus was dropped from the Switch the user was
 * operating. Keeping the element tree identical preserves the subtree.
 *
 * Follow mode (`applyThemeEverywhere`) stays pixel-identical to the parent
 * because it is handed the parent's own `mantineTheme` / `colorScheme` from
 * `useTheme()`, run through the same `CloseButton` merge `ThemedApp` applies —
 * same input, same output.
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { MantineProvider, mergeThemeOverrides } from '@mantine/core';
import i18n from '@/i18n';
import { useTheme } from '@/hooks/useTheme';
import { DEFAULT_THEME_ID, getTheme } from '@/themes/index';
import { ADMIN_CHROME_CLASS } from '@/themes/chromeTheme';

export interface AdminChromeProviderProps {
  applyThemeEverywhere: boolean;
  children: ReactNode;
}

export function AdminChromeProvider({
  applyThemeEverywhere,
  children,
}: AdminChromeProviderProps) {
  const brand = getTheme(DEFAULT_THEME_ID);
  // Follow mode reuses the gallery theme the parent MantineProvider is already
  // running on, so the nested provider is a no-op re-application rather than a
  // second, differing theme. `getTheme` reads a module-level Map, so both
  // branches hand `useMemo` a stable object identity.
  const { mantineTheme, colorScheme } = useTheme();
  const sourceTheme = applyThemeEverywhere ? mantineTheme : brand.mantine;
  const sourceScheme = applyThemeEverywhere ? colorScheme : brand.meta.colorScheme;

  // P75 review: Mantine writes `data-mantine-color-scheme` onto whatever
  // getRootElement() returns. A `document.querySelector` cannot see this
  // sentinel when the panel renders inside the plugin's shadow root (the
  // common case — see SettingsPanel's own shadow sentinel), so it used to
  // fall back to `document.body` and stamp the attribute on the host page.
  // A ref resolves the real node in both light and shadow DOM; returning
  // undefined is a no-op inside Mantine (`getRootElement()?.setAttribute`).
  const scopeRef = useRef<HTMLDivElement>(null);
  const themeWithA11y = useMemo(
    () =>
      mergeThemeOverrides(sourceTheme, {
        components: {
          CloseButton: { defaultProps: { 'aria-label': i18n.t('common_close', 'Close') } },
        },
      }),
    [sourceTheme],
  );

  return (
    <>
      <div
        ref={scopeRef}
        className={ADMIN_CHROME_CLASS}
        data-mantine-color-scheme={sourceScheme}
        hidden
        aria-hidden
      />
      <MantineProvider
        theme={themeWithA11y}
        forceColorScheme={sourceScheme}
        cssVariablesSelector={`.${ADMIN_CHROME_CLASS}`}
        getRootElement={() => scopeRef.current ?? undefined}
        deduplicateInlineStyles
      >
        {children}
      </MantineProvider>
    </>
  );
}
