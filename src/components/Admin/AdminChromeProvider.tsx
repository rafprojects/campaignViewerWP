/**
 * P75-D: nested MantineProvider for Settings Panel + Layout Builder chrome.
 *
 * Must not change ThemedApp's provider — that tree also renders the public
 * gallery. Nested CSS variables are scoped to `.mullion-admin-chrome` so they
 * cannot overwrite `:root` / `:host` gallery tokens.
 *
 * When `applyThemeEverywhere` is true, this is a passthrough so chrome is
 * pixel-identical to the parent (gallery) MantineProvider.
 */

import { useMemo, type ReactNode } from 'react';
import { MantineProvider, mergeThemeOverrides } from '@mantine/core';
import i18n from '@/i18n';
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
  const themeWithA11y = useMemo(
    () =>
      mergeThemeOverrides(brand.mantine, {
        components: {
          CloseButton: { defaultProps: { 'aria-label': i18n.t('common_close', 'Close') } },
        },
      }),
    [brand.mantine],
  );

  if (applyThemeEverywhere) {
    return children;
  }

  return (
    <>
      <div
        className={ADMIN_CHROME_CLASS}
        data-mantine-color-scheme={brand.meta.colorScheme}
        hidden
        aria-hidden
      />
      <MantineProvider
        theme={themeWithA11y}
        forceColorScheme={brand.meta.colorScheme}
        cssVariablesSelector={`.${ADMIN_CHROME_CLASS}`}
        getRootElement={() =>
          (typeof document !== 'undefined'
            ? (document.querySelector(`.${ADMIN_CHROME_CLASS}`) as HTMLElement | null)
            : null) ?? (typeof document !== 'undefined' ? document.body : undefined as never)
        }
        deduplicateInlineStyles
      >
        {children}
      </MantineProvider>
    </>
  );
}
