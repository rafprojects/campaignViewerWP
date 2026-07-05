/**
 * P49-C: i18n bootstrap unit test.
 * Verifies i18next initialises and resolves keys correctly both with and without
 * the window.__WPSG_I18N__ injection present.
 *
 * Keys are resolved bare (via defaultNS: 'wpsg'), exactly as production does with
 * useTranslation('wpsg') — the 'wpsg:' namespace-prefix form is intentionally not
 * used because P60 review disabled nsSeparator/keySeparator so that catalogue keys
 * containing ':' (aspect-ratio options like '..._opt_16:9') resolve verbatim.
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
    expect(i18n.t('close')).toBe('Close');
    expect(i18n.t('loading')).toBe('Loading…');
  });

  it('resolves catalogue keys that contain a colon (nsSeparator disabled)', async () => {
    // Regression guard for the P60 review fix: i18next's default nsSeparator (':')
    // would parse this key as namespace 'set_sg…_opt_16' + key '9' and never match.
    const aspectKey = 'set_sg_compact-grid_gridCardAspectRatio_opt_16:9';
    (window as Window & { __WPSG_I18N__?: unknown }).__WPSG_I18N__ = {
      locale: 'de',
      strings: { [aspectKey]: '16:9 (Breitbild)' },
    };

    const { default: i18n } = await import('./i18n');
    expect(i18n.t(aspectKey)).toBe('16:9 (Breitbild)');
  });

  it('falls back to key when string is not injected', async () => {
    const { default: i18n } = await import('./i18n');
    // Key not in injected strings → key itself is returned (graceful degradation)
    expect(i18n.t('unknownKey')).toBe('unknownKey');
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
    expect(i18n.t('auth_sign_in')).toBe('Se connecter');
    // A key absent from fr falls back to the bundled English default.
    expect(i18n.t('auth_settings')).toBe('Settings');
  });

  it('falls back to en defaults when a non-en locale injects no strings', async () => {
    (window as Window & { __WPSG_I18N__?: unknown }).__WPSG_I18N__ = {
      locale: 'de',
      // strings intentionally omitted → resources[locale].wpsg === {}
    };

    const { default: i18n } = await import('./i18n');
    expect(i18n.language).toBe('de');
    // Every key resolves via the en fallback resource.
    expect(i18n.t('auth_settings')).toBe('Settings');
  });
});
