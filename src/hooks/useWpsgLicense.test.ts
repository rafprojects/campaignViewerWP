import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWpsgLicense } from './useWpsgLicense';

describe('useWpsgLicense', () => {
  afterEach(() => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
  });

  it('defaults to the free tier when no config is present', () => {
    delete (window as { __WPSG_CONFIG__?: unknown }).__WPSG_CONFIG__;
    const { result } = renderHook(() => useWpsgLicense());
    expect(result.current.isPro).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.upgradeUrl).toBeTruthy(); // placeholder fallback
  });

  it('defaults to the free tier when config has no license key', () => {
    window.__WPSG_CONFIG__ = { restNonce: 'abc' };
    const { result } = renderHook(() => useWpsgLicense());
    expect(result.current.isPro).toBe(false);
  });

  it('reflects a pro license from config', () => {
    window.__WPSG_CONFIG__ = {
      license: { isPro: true, tier: 'agency', upgradeUrl: 'https://example.test/buy' },
    };
    const { result } = renderHook(() => useWpsgLicense());
    expect(result.current.isPro).toBe(true);
    expect(result.current.tier).toBe('agency');
    expect(result.current.upgradeUrl).toBe('https://example.test/buy');
  });

  it('falls back to the placeholder upgrade URL when the config value is empty', () => {
    window.__WPSG_CONFIG__ = {
      license: { isPro: false, tier: null, upgradeUrl: '' },
    };
    const { result } = renderHook(() => useWpsgLicense());
    expect(result.current.upgradeUrl).toBeTruthy();
  });
});
