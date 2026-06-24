import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNonceHeartbeat } from './useNonceHeartbeat';

// Window augmentation for test (matches src/vite-env.d.ts).
const win = window as Window & {
  __WPSG_CONFIG__?: {
    restNonce?: string;
    enableJwt?: boolean;
    apiBase?: string;
  };
  __WPSG_REST_NONCE__?: string;
};

describe('useNonceHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn();
    // Set up the minimal __WPSG_CONFIG__ for nonce-only mode.
    win.__WPSG_CONFIG__ = {
      restNonce: 'initial-nonce',
    };
    delete win.__WPSG_REST_NONCE__;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete win.__WPSG_CONFIG__;
  });

  it('does nothing when JWT is enabled', () => {
    win.__WPSG_CONFIG__ = { restNonce: 'nonce', enableJwt: true };

    renderHook(() => useNonceHeartbeat(5000));

    vi.advanceTimersByTime(10000);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('does nothing when no nonce is available', () => {
    win.__WPSG_CONFIG__ = {};

    renderHook(() => useNonceHeartbeat(5000));

    vi.advanceTimersByTime(10000);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('refreshes nonce after interval', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'refreshed-nonce' }),
    });

    renderHook(() => useNonceHeartbeat(5000));

    // Immediate refresh on mount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/wp-json/wp-super-gallery/v1/nonce'),
      expect.objectContaining({
        credentials: 'same-origin',
        headers: { 'X-WP-Nonce': 'initial-nonce' },
      }),
    );

    // Verify global nonce was updated.
    expect(win.__WPSG_CONFIG__?.restNonce).toBe('refreshed-nonce');

    // Advance past the interval — should fire again.
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not crash on network error', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Network error'),
    );

    renderHook(() => useNonceHeartbeat(5000));

    // Immediate refresh + interval.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // Should not throw — hook handles errors gracefully.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    // Nonce should remain unchanged.
    expect(win.__WPSG_CONFIG__?.restNonce).toBe('initial-nonce');
  });

  it('does not update nonce on non-OK response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
    });

    renderHook(() => useNonceHeartbeat(5000));

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(win.__WPSG_CONFIG__?.restNonce).toBe('initial-nonce');
  });

  it('is a no-op when server returns response without nonce field (line 54 false branch)', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}), // no nonce field in response
    });

    renderHook(() => useNonceHeartbeat(5000));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // Nonce should remain unchanged since server returned no nonce
    expect(win.__WPSG_CONFIG__?.restNonce).toBe('initial-nonce');
  });

  it('updates __WPSG_REST_NONCE__ alongside config restNonce on success', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'fresh-nonce' }),
    });

    renderHook(() => useNonceHeartbeat(5000));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(win.__WPSG_REST_NONCE__).toBe('fresh-nonce');
  });

  it('does not set __WPSG_CONFIG__ when it is absent (line 68 false branch)', async () => {
    delete win.__WPSG_CONFIG__;
    // Use __WPSG_REST_NONCE__ as the startup nonce instead
    win.__WPSG_REST_NONCE__ = 'legacy-nonce';

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'refreshed' }),
    });

    renderHook(() => useNonceHeartbeat(5000));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    // __WPSG_CONFIG__ was absent — should not have been created
    expect(win.__WPSG_CONFIG__).toBeUndefined();
    expect(win.__WPSG_REST_NONCE__).toBe('refreshed');
  });

  it('clears interval on unmount', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ nonce: 'new-nonce' }),
    });

    const { unmount } = renderHook(() => useNonceHeartbeat(5000));

    // Immediate refresh fires on mount.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    // No additional calls after unmount.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
