import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMullionLicense } from './useMullionLicense';

describe('useMullionLicense', () => {
  afterEach(() => {
    delete (window as { __MULLION_CONFIG__?: unknown }).__MULLION_CONFIG__;
  });

  it('defaults to the free tier when no config is present', () => {
    delete (window as { __MULLION_CONFIG__?: unknown }).__MULLION_CONFIG__;
    const { result } = renderHook(() => useMullionLicense());
    expect(result.current.isPro).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.upgradeUrl).toBeTruthy(); // placeholder fallback
  });

  it('defaults to the free tier when config has no license key', () => {
    window.__MULLION_CONFIG__ = { restNonce: 'abc' };
    const { result } = renderHook(() => useMullionLicense());
    expect(result.current.isPro).toBe(false);
  });

  it('reflects a pro license from config', () => {
    window.__MULLION_CONFIG__ = {
      license: { isPro: true, tier: 'agency', upgradeUrl: 'https://example.test/buy' },
    };
    const { result } = renderHook(() => useMullionLicense());
    expect(result.current.isPro).toBe(true);
    expect(result.current.tier).toBe('agency');
    expect(result.current.upgradeUrl).toBe('https://example.test/buy');
  });

  it('falls back to the placeholder upgrade URL when the config value is empty', () => {
    window.__MULLION_CONFIG__ = {
      license: { isPro: false, tier: null, upgradeUrl: '' },
    };
    const { result } = renderHook(() => useMullionLicense());
    expect(result.current.upgradeUrl).toBeTruthy();
  });
});
