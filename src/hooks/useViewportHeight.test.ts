import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useViewportHeight } from './useViewportHeight';

describe('useViewportHeight', () => {
  it('returns window.innerHeight as initial value', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1024, writable: true });
    const { result } = renderHook(() => useViewportHeight());
    expect(result.current).toBe(1024);
  });

  it('updates on window resize', () => {
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
    const { result } = renderHook(() => useViewportHeight());
    expect(result.current).toBe(768);

    act(() => {
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(600);
  });

  it('removes listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useViewportHeight());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeSpy.mockRestore();
  });
});
