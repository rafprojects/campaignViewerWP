import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME_ID, getTheme } from './index';
import {
  ADMIN_CHROME_CLASS,
  BRAND_THEME_ID,
  adminChromeAttributes,
  adminChromeClassNames,
  adminChromeStyles,
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

  // P76-H: unlike the class and the attribute, this returns a value in BOTH
  // modes, and the asymmetry is deliberate. The other two return {} in follow
  // mode because the chrome inherits the gallery root — true in a light-DOM
  // mount, false in a shadow one, where the gallery's variables live at :host
  // inside the shadow root and the chrome is portaled out of it. Verified in a
  // browser: follow mode in a shadow mount rendered Cancel and Save Changes
  // with no button surface at all.
  describe('adminChromeStyles', () => {
    // Mantine's semantic variables are indirections — `--mantine-color-body` is
    // literally `var(--mantine-color-dark-7)` in every theme, so comparing it
    // proves nothing. The per-theme literals live in the ramps.
    const ramp = (v: Record<string, string>) =>
      Object.entries(v)
        .filter(([k, val]) => /^--mantine-color-(dark|primary)-\d$/.test(k) && !val.startsWith('var('))
        .map(([, val]) => val);

    it('inlines a resolved palette on both parts, identically', () => {
      const { inner, content } = adminChromeStyles(false, 'tokyo-night');
      expect(inner).toEqual(content);
      expect(ramp(content as Record<string, string>).length).toBeGreaterThan(0);
    });

    it('inlines the gallery palette in follow mode, not the brand palette', () => {
      const locked = adminChromeStyles(false, 'tokyo-night').content as Record<string, string>;
      const following = adminChromeStyles(true, 'tokyo-night').content as Record<string, string>;
      const asBrand = adminChromeStyles(false, BRAND_THEME_ID).content as Record<string, string>;

      // The failure this guards: follow mode silently serving the brand palette.
      expect(ramp(following)).not.toEqual(ramp(locked));
      // Lock mode ignores the gallery id it is handed; follow mode honours it.
      expect(ramp(locked)).toEqual(ramp(asBrand));
      expect(ramp(following)).toEqual(
        ramp(adminChromeStyles(true, 'tokyo-night').content as Record<string, string>),
      );
    });

    it('returns both parts in both modes — deliberately unlike the class and attribute', () => {
      for (const locked of [true, false]) {
        expect(Object.keys(adminChromeStyles(locked, 'tokyo-night')).sort()).toEqual([
          'content',
          'inner',
        ]);
      }
      // The other two intentionally go empty in follow mode.
      expect(adminChromeClassNames(true)).toEqual({});
      expect(adminChromeAttributes(true)).toEqual({});
    });
  });

  it('brand lock is a different palette than a non-default gallery theme', () => {
    const brand = getTheme(BRAND_THEME_ID);
    const tokyo = getTheme('tokyo-night');
    expect(brand.definition.colors.surface).not.toBe(tokyo.definition.colors.surface);
  });
});
