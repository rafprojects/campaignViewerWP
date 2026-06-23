/**
 * P49-C: i18n bootstrap unit test.
 * Verifies i18next initialises and resolves keys correctly both with and without
 * the window.__WPSG_I18N__ injection present.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('i18n bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    delete (window as Window & { __WPSG_I18N__?: unknown }).__WPSG_I18N__;
  });

  it('resolves injected strings from window.__WPSG_I18N__', async () => {
    (window as Window & { __WPSG_I18N__?: unknown }).__WPSG_I18N__ = {
      locale: 'en',
      strings: { close: 'Close', loading: 'Loading…' },
    };

    const { default: i18n } = await import('./i18n');
    expect(i18n.t('wpsg:close')).toBe('Close');
    expect(i18n.t('wpsg:loading')).toBe('Loading…');
  });

  it('falls back to key when string is not injected', async () => {
    const { default: i18n } = await import('./i18n');
    // Key not in injected strings → key itself is returned (graceful degradation)
    expect(i18n.t('wpsg:unknownKey')).toBe('unknownKey');
  });

  it('initialises without error when window.__WPSG_I18N__ is absent', async () => {
    const { default: i18n } = await import('./i18n');
    expect(i18n.isInitialized).toBe(true);
  });

  it('loads injected strings under a non-en locale, keeping en defaults as fallback', async () => {
    (window as Window & { __WPSG_I18N__?: unknown }).__WPSG_I18N__ = {
      locale: 'fr',
      strings: { auth_sign_in: 'Se connecter' },
    };

    const { default: i18n } = await import('./i18n');
    expect(i18n.language).toBe('fr');
    // Injected locale string resolves under the active (fr) resource.
    expect(i18n.t('wpsg:auth_sign_in')).toBe('Se connecter');
    // A key absent from fr falls back to the bundled English default.
    expect(i18n.t('wpsg:auth_settings')).toBe('Settings');
  });

  it('falls back to en defaults when a non-en locale injects no strings', async () => {
    (window as Window & { __WPSG_I18N__?: unknown }).__WPSG_I18N__ = {
      locale: 'de',
      // strings intentionally omitted → resources[locale].wpsg === {}
    };

    const { default: i18n } = await import('./i18n');
    expect(i18n.language).toBe('de');
    // Every key resolves via the en fallback resource.
    expect(i18n.t('wpsg:auth_settings')).toBe('Settings');
  });
});
