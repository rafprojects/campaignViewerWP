/**
 * P75-D: admin chrome theme resolution.
 *
 * Settings Panel and Layout Builder chrome lock to the Mullion brand palette
 * (`DEFAULT_THEME_ID` / `default-dark`) unless `applyThemeEverywhere` is on.
 * The public gallery theme is resolved separately via ThemeProvider / useTheme().
 */

import { DEFAULT_THEME_ID, getTheme, type ThemeEntry } from './index';

/** CSS class that scopes nested Mantine CSS variables to admin chrome surfaces. */
export const ADMIN_CHROME_CLASS = 'mullion-admin-chrome';

/** Mullion brand theme used for locked admin chrome. */
export const BRAND_THEME_ID = DEFAULT_THEME_ID;

export function resolveChromeThemeId(
  applyThemeEverywhere: boolean,
  galleryThemeId: string,
): string {
  return applyThemeEverywhere ? galleryThemeId : BRAND_THEME_ID;
}

export function resolveChromeTheme(
  applyThemeEverywhere: boolean,
  galleryThemeId: string,
): ThemeEntry {
  return getTheme(resolveChromeThemeId(applyThemeEverywhere, galleryThemeId));
}

/** Drawer/Modal classNames that receive the nested chrome CSS variables. */
export function adminChromeClassNames(
  applyThemeEverywhere: boolean,
): { inner?: string; content?: string } {
  if (applyThemeEverywhere) {
    return {};
  }
  return { inner: ADMIN_CHROME_CLASS, content: ADMIN_CHROME_CLASS };
}
