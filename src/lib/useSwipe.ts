import { useCallback, useRef } from 'react';

interface UseSwipeOptions {
  /** Minimum horizontal distance (px) to trigger a swipe. Default: 50 */
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

/**
 * Lightweight swipe detection using pointer events.
 * No external dependency required.
 */
export function useSwipe(options: UseSwipeOptions): SwipeHandlers {
  const { threshold = 50, onSwipeLeft, onSwipeRight } = options;
  const startX = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return; // Only handle touch/pen
    startX.current = e.clientX;
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (startX.current === null) return;
      const deltaX = e.clientX - startX.current;
      startX.current = null;

      if (Math.abs(deltaX) < threshold) return;

      if (deltaX < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    },
    [threshold, onSwipeLeft, onSwipeRight],
  );

  return { onPointerDown, onPointerUp };
}
