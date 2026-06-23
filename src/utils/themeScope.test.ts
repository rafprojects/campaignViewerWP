import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildThemeScopeSelector,
  buildThemeStyleElementId,
  createThemeScopeToken,
  ensureHostThemeScopeToken,
  escapeThemeScopeSelectorValue,
  normalizeThemeScopeToken,
} from './themeScope';

const TOKEN_PATTERN = /^wpsg-theme-[a-z0-9]+$/;

describe('themeScope utilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes scope tokens to a safe attribute/style-id charset', () => {
    expect(normalizeThemeScopeToken('theme"scope[] test')).toBe('theme_scope___test');
  });

  it('generates a fresh token when normalizing nullish or empty input', () => {
    // Covers the `|| createThemeScopeToken()` fallback in normalizeThemeScopeToken.
    expect(normalizeThemeScopeToken(null)).toMatch(TOKEN_PATTERN);
    expect(normalizeThemeScopeToken(undefined)).toMatch(TOKEN_PATTERN);
    expect(normalizeThemeScopeToken('   ')).toMatch(TOKEN_PATTERN);
  });

  it('createThemeScopeToken returns a uniquely-suffixed token', () => {
    const a = createThemeScopeToken();
    const b = createThemeScopeToken();
    expect(a).toMatch(TOKEN_PATTERN);
    expect(b).toMatch(TOKEN_PATTERN);
    expect(a).not.toBe(b);
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

  it('falls back to host.dataset.wpsgKey, then a generated token, for the scope source', () => {
    const withKey = document.createElement('div');
    withKey.dataset.wpsgKey = 'fromKey';
    expect(ensureHostThemeScopeToken(withKey)).toBe('fromKey');

    const bare = document.createElement('div');
    expect(ensureHostThemeScopeToken(bare)).toMatch(TOKEN_PATTERN);
    expect(bare.dataset.wpsgThemeScope).toMatch(TOKEN_PATTERN);
  });

  it('escapes selector values via the manual fallback when CSS.escape is unavailable', () => {
    // Force the non-CSS.escape branch (line 16) by removing the global CSS API.
    vi.stubGlobal('CSS', undefined);
    expect(escapeThemeScopeSelectorValue('a"b')).toBe('a\\"b');
    expect(escapeThemeScopeSelectorValue('a\\b')).toBe('a\\\\b');
  });

  it('uses CSS.escape when available', () => {
    expect(escapeThemeScopeSelectorValue('plain')).toBe('plain');
  });
});
