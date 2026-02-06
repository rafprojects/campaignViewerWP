import { useCallback, useEffect, useState } from 'react';

interface UseCarouselOptions {
  initialIndex?: number;
}

interface UseCarouselResult {
  currentIndex: number;
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

  const setCurrentIndex = useCallback(
    (index: number) => {
      if (safeLength === 0) return;
      const nextIndex = Math.min(Math.max(index, 0), safeLength - 1);
      setCurrentIndexState(nextIndex);
    },
    [safeLength],
  );

  const next = useCallback(() => {
    if (safeLength === 0) return;
    setCurrentIndexState((prev) => (prev + 1) % safeLength);
  }, [safeLength]);

  const prev = useCallback(() => {
    if (safeLength === 0) return;
    setCurrentIndexState((prev) => (prev - 1 + safeLength) % safeLength);
  }, [safeLength]);

  useEffect(() => {
    if (safeLength === 0) {
      setCurrentIndexState(0);
      return;
    }
    setCurrentIndexState((prev) => Math.min(prev, safeLength - 1));
  }, [safeLength]);

  return { currentIndex, setCurrentIndex, next, prev };
}
