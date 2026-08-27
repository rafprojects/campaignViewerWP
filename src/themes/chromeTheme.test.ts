import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_ID, getTheme } from './index';
import {
  ADMIN_CHROME_CLASS,
  BRAND_THEME_ID,
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

  it('brand lock is a different palette than a non-default gallery theme', () => {
    const brand = getTheme(BRAND_THEME_ID);
    const tokyo = getTheme('tokyo-night');
    expect(brand.definition.colors.surface).not.toBe(tokyo.definition.colors.surface);
  });
});
