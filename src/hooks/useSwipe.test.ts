import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSwipe } from './useSwipe';

function createPointerEvent(_type: string, clientX: number, pointerType = 'touch') {
  return { clientX, pointerType } as React.PointerEvent;
}

describe('useSwipe', () => {
  it('calls onSwipeLeft when swiping left beyond threshold', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, threshold: 50 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent('pointerdown', 200));
      result.current.onPointerUp(createPointerEvent('pointerup', 100));
    });

    expect(onSwipeLeft).toHaveBeenCalledOnce();
  });

  it('calls onSwipeRight when swiping right beyond threshold', () => {
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeRight, threshold: 50 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent('pointerdown', 100));
      result.current.onPointerUp(createPointerEvent('pointerup', 200));
    });

    expect(onSwipeRight).toHaveBeenCalledOnce();
  });

  it('does not trigger swipe when distance is below threshold', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, onSwipeRight, threshold: 50 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent('pointerdown', 100));
      result.current.onPointerUp(createPointerEvent('pointerup', 130));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('ignores mouse pointer events', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft, threshold: 50 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent('pointerdown', 200, 'mouse'));
      result.current.onPointerUp(createPointerEvent('pointerup', 100, 'mouse'));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('handles pointerUp without prior pointerDown gracefully', () => {
    const onSwipeLeft = vi.fn();
    const { result } = renderHook(() => useSwipe({ onSwipeLeft }));

    act(() => {
      result.current.onPointerUp(createPointerEvent('pointerup', 50));
    });

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
