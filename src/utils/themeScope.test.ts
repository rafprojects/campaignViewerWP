import { describe, expect, it } from 'vitest';

import {
  buildThemeScopeSelector,
  buildThemeStyleElementId,
  ensureHostThemeScopeToken,
  normalizeThemeScopeToken,
} from './themeScope';

describe('themeScope utilities', () => {
  it('normalizes scope tokens to a safe attribute/style-id charset', () => {
    expect(normalizeThemeScopeToken('theme"scope[] test')).toBe('theme_scope___test');
  });

  it('ensures the host stores a sanitized scope token', () => {
    const host = document.createElement('div');
    host.id = 'gallery"scope[]';

    const scopeToken = ensureHostThemeScopeToken(host);

    expect(scopeToken).toBe('gallery_scope__');
    expect(host.dataset.wpsgThemeScope).toBe('gallery_scope__');
    expect(buildThemeScopeSelector(scopeToken)).toBe('[data-wpsg-theme-scope="gallery_scope__"]');
    expect(buildThemeStyleElementId(scopeToken)).toBe('wpsg-theme-vars-gallery_scope__');
  });
});
