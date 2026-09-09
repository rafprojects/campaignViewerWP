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

  // The three helpers deliberately have three different shapes, because they do
  // three different jobs. Asserted here so nobody "harmonises" them:
  //   classNames  — lock only. Scopes the provider's own variable block.
  //   attributes  — both modes. Mantine keys its per-variant input rules on
  //                 [data-mantine-color-scheme]; without it --input-bd is
  //                 undefined and `border: 1px solid var(--input-bd)`
  //                 collapses, so inputs render with no border at all.
  //   styles      — both modes. Portal-proof delivery of the variables.
  it('applies the color-scheme attribute to both parts, in both modes', () => {
    const brandScheme = getTheme(BRAND_THEME_ID).meta.colorScheme;
    expect(adminChromeAttributes(false, 'tokyo-night')).toEqual({
      inner: { 'data-mantine-color-scheme': brandScheme },
      content: { 'data-mantine-color-scheme': brandScheme },
    });

    // Follow mode carries the *gallery's* scheme, not the brand's.
    const lightGallery = adminChromeAttributes(true, 'github-light');
    expect(lightGallery.content['data-mantine-color-scheme']).toBe('light');
    expect(brandScheme).not.toBe('light');
  });

  it('scopes the class to lock mode only, while the attribute covers both', () => {
    expect(adminChromeClassNames(true)).toEqual({});
    expect(Object.keys(adminChromeAttributes(true, 'tokyo-night')).sort()).toEqual([
      'content',
      'inner',
    ]);
    // In lock mode the two do line up, part for part.
    expect(Object.keys(adminChromeAttributes(false, 'tokyo-night')).sort()).toEqual(
      Object.keys(adminChromeClassNames(false)).sort(),
    );
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

    it('returns both parts in both modes', () => {
      for (const locked of [true, false]) {
        expect(Object.keys(adminChromeStyles(locked, 'tokyo-night')).sort()).toEqual([
          'content',
          'inner',
        ]);
      }
      // Only the class stays lock-only; see the shape note above.
      expect(adminChromeClassNames(true)).toEqual({});
    });
  });

  it('brand lock is a different palette than a non-default gallery theme', () => {
    const brand = getTheme(BRAND_THEME_ID);
    const tokyo = getTheme('tokyo-night');
    expect(brand.definition.colors.surface).not.toBe(tokyo.definition.colors.surface);
  });
});
