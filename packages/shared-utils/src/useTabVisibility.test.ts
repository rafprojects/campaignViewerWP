import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTabVisibility } from './useTabVisibility';

function setVisibilityState(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
}

describe('useTabVisibility', () => {
  afterEach(() => {
    // Reset to visible so subsequent tests start clean
    setVisibilityState('visible');
    vi.restoreAllMocks();
  });

  it('returns true when the tab is initially visible', () => {
    setVisibilityState('visible');
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current).toBe(true);
  });

  it('returns false when the tab is initially hidden', () => {
    setVisibilityState('hidden');
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current).toBe(false);
  });

  it('flips to false when the tab is hidden via visibilitychange', () => {
    setVisibilityState('visible');
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current).toBe(true);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(false);
  });

  it('flips back to true when the tab becomes visible again', () => {
    setVisibilityState('hidden');
    const { result } = renderHook(() => useTabVisibility());
    expect(result.current).toBe(false);

    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe(true);
  });

  it('cleans up the event listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    setVisibilityState('visible');
    const { unmount } = renderHook(() => useTabVisibility());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
