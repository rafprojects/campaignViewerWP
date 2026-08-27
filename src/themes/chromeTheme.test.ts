import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_ID, getTheme } from './index';
import {
  ADMIN_CHROME_CLASS,
  BRAND_THEME_ID,
  adminChromeAttributes,
  adminChromeClassNames,
  resolveChromeTheme,
  resolveChromeThemeId,
} from './chromeTheme';

describe('chromeTheme', () => {
  it('locks to the Mullion brand theme when applyThemeEverywhere is false', () => {
    expect(resolveChromeThemeId(false, 'tokyo-night')).toBe(DEFAULT_THEME_ID);
    expect(resolveChromeThemeId(false, 'default-light')).toBe(BRAND_THEME_ID);
    expect(resolveChromeTheme(false, 'tokyo-night').definition.id).toBe(DEFAULT_THEME_ID);
  });

  it('follows the gallery theme when applyThemeEverywhere is true', () => {
    expect(resolveChromeThemeId(true, 'tokyo-night')).toBe('tokyo-night');
    expect(resolveChromeTheme(true, 'nord').definition.id).toBe('nord');
  });

  it('returns Drawer/Modal classNames only when chrome is locked', () => {
    expect(adminChromeClassNames(true)).toEqual({});
    expect(adminChromeClassNames(false)).toEqual({
      inner: ADMIN_CHROME_CLASS,
      content: ADMIN_CHROME_CLASS,
    });
  });

  // P76-D: the class alone was never enough. Mantine emits its colour
  // variables under `.mullion-admin-chrome[data-mantine-color-scheme="…"]`, so
  // a part carrying only the class matched the static rule and inherited every
  // colour from the gallery root instead. Verified in a browser: with the
  // attribute the locked chrome resolves --mantine-color-body to the brand
  // #0d1c24; without it, to the gallery's #1e212f.
  it('returns the color-scheme attribute for the same parts that get the class', () => {
    expect(adminChromeAttributes(true)).toEqual({});

    const attrs = adminChromeAttributes(false);
    const brandScheme = getTheme(BRAND_THEME_ID).meta.colorScheme;
    expect(attrs).toEqual({
      inner: { 'data-mantine-color-scheme': brandScheme },
      content: { 'data-mantine-color-scheme': brandScheme },
    });
  });

  it('attributes and classNames cover exactly the same parts', () => {
    for (const locked of [true, false]) {
      expect(Object.keys(adminChromeAttributes(locked)).sort()).toEqual(
        Object.keys(adminChromeClassNames(locked)).sort(),
      );
    }
  });

  it('brand lock is a different palette than a non-default gallery theme', () => {
    const brand = getTheme(BRAND_THEME_ID);
    const tokyo = getTheme('tokyo-night');
    expect(brand.definition.colors.surface).not.toBe(tokyo.definition.colors.surface);
  });
});
