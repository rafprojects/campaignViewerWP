import { useCallback, useEffect, useState } from 'react';

interface UseCarouselOptions {
  initialIndex?: number;
}

/**
 * Navigation direction: 1 = forward/next, -1 = backward/prev, 0 = initial/direct jump.
 */
export type NavigationDirection = -1 | 0 | 1;

interface UseCarouselResult {
  currentIndex: number;
  direction: NavigationDirection;
  setCurrentIndex: (index: number) => void;
  next: () => void;
  prev: () => void;
}

export function useCarousel(length: number, options: UseCarouselOptions = {}): UseCarouselResult {
  const { initialIndex = 0 } = options;
  const safeLength = Number.isFinite(length) && length > 0 ? length : 0;

  const [currentIndex, setCurrentIndexState] = useState(() =>
    safeLength > 0 ? Math.min(initialIndex, safeLength - 1) : 0,
  );
  const [direction, setDirection] = useState<NavigationDirection>(0);

  const setCurrentIndex = useCallback(
    (index: number) => {
      if (safeLength === 0) return;
      const nextIndex = Math.min(Math.max(index, 0), safeLength - 1);
      setCurrentIndexState((prev) => {
        if (nextIndex === prev) return prev;
        setDirection(nextIndex > prev ? 1 : -1);
        return nextIndex;
      });
    },
    [safeLength],
  );

  const next = useCallback(() => {
    if (safeLength === 0) return;
    setDirection(1);
    setCurrentIndexState((prev) => (prev + 1) % safeLength);
  }, [safeLength]);

  const prev = useCallback(() => {
    if (safeLength === 0) return;
    setDirection(-1);
    setCurrentIndexState((prev) => (prev - 1 + safeLength) % safeLength);
  }, [safeLength]);

  useEffect(() => {
    if (safeLength === 0) {
      setCurrentIndexState(0);
      return;
    }
    setCurrentIndexState((prev) => Math.min(prev, safeLength - 1));
  }, [safeLength]);

  return { currentIndex, direction, setCurrentIndex, next, prev };
}
