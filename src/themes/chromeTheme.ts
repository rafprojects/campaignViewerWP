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

/**
 * Drawer/Modal attributes that let the nested chrome CSS variables actually
 * resolve on the parts `adminChromeClassNames()` labels.
 *
 * P76-D: Mantine does not emit its colour variables under the bare
 * `cssVariablesSelector`. It emits three rules — `.mullion-admin-chrome` for
 * the static set (z-index, scale, cursor), and
 * `.mullion-admin-chrome[data-mantine-color-scheme="dark"|"light"]` for every
 * colour. P75-D put the class on `inner`/`content` but nothing put the
 * attribute there, so those parts matched only the static rule and each colour
 * variable fell through to the gallery root by inheritance — the chrome was
 * labelled as brand-scoped while resolving gallery values. Confirmed against a
 * rendered browser in both mount modes, then confirmed fixed by adding exactly
 * this attribute; see the P76-D notes in docs/PHASE76_REPORT.md.
 *
 * Follow mode returns `{}` for the same reason `adminChromeClassNames()` does:
 * the chrome is meant to inherit the gallery root, which it already does.
 */
export function adminChromeAttributes(
  applyThemeEverywhere: boolean,
): { inner?: Record<string, string>; content?: Record<string, string> } {
  if (applyThemeEverywhere) {
    return {};
  }
  const attrs = {
    'data-mantine-color-scheme': getTheme(BRAND_THEME_ID).meta.colorScheme,
  };
  return { inner: attrs, content: attrs };
}
