/**
 * P22-P3: useMediaTransition
 *
 * Encapsulates the shared transition animation pattern used by both
 * ImageCarousel and VideoCarousel. Handles previousItem state,
 * exit timer management, and imperative CSS transition application.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import type { NavigationDirection } from '@/hooks/useCarousel';
import { applyGalleryTransition } from '@/utils/galleryAnimations';

interface UseMediaTransitionResult {
  previousItem: MediaItem | null;
  enterRef: React.RefObject<HTMLDivElement | null>;
  exitRef: React.RefObject<HTMLDivElement | null>;
  /** Wrap a navigation callback to trigger the enter/exit animation. */
  beginTransition: (navigate: () => void) => void;
  /** Directly set + clear previous item (for dot navigator jumps). */
  setPreviousForJump: (item: MediaItem) => void;
  clearPrevious: () => void;
}

export function useMediaTransition(
  settings: GalleryBehaviorSettings,
  currentIndex: number,
  direction: NavigationDirection,
  items: MediaItem[],
): UseMediaTransitionResult {
  const [previousItem, setPreviousItem] = useState<MediaItem | null>(null);
  const exitTimerRef = useRef<number>(0);
  const enterRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(currentIndex);

  const mediaTransitionDuration = useMemo(
    () => (settings.scrollAnimationStyle === 'instant' ? 0 : settings.scrollAnimationDurationMs),
    [settings.scrollAnimationStyle, settings.scrollAnimationDurationMs],
  );

  const transitionType = settings.scrollTransitionType ?? 'slide-fade';

  const beginTransition = useCallback(
    (navigate: () => void) => {
      window.clearTimeout(exitTimerRef.current);
      if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
        setPreviousItem(items[currentIndex]);
        exitTimerRef.current = window.setTimeout(
          () => setPreviousItem(null),
          mediaTransitionDuration + 100,
        );
      }
      navigate();
    },
    [items, currentIndex, mediaTransitionDuration, settings.scrollAnimationStyle],
  );

  const setPreviousForJump = useCallback(
    (item: MediaItem) => {
      window.clearTimeout(exitTimerRef.current);
      if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
        setPreviousItem(item);
        exitTimerRef.current = window.setTimeout(
          () => setPreviousItem(null),
          mediaTransitionDuration + 100,
        );
      }
    },
    [mediaTransitionDuration, settings.scrollAnimationStyle],
  );

  const clearPrevious = useCallback(() => {
    setPreviousItem(null);
    window.clearTimeout(exitTimerRef.current);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => window.clearTimeout(exitTimerRef.current), []);

  // Imperative CSS transition — runs before browser paint
  useLayoutEffect(() => {
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;
    if (mediaTransitionDuration <= 0 || direction === 0 || settings.scrollAnimationStyle === 'instant') return;

    applyGalleryTransition(enterRef.current, exitRef.current, {
      direction: direction as 1 | -1,
      transitionType: transitionType as 'fade' | 'slide' | 'slide-fade',
      durationMs: mediaTransitionDuration,
      easing: settings.scrollAnimationEasing,
      transitionFadeEnabled: settings.transitionFadeEnabled,
    });
  }, [currentIndex, direction, mediaTransitionDuration, transitionType, settings.scrollAnimationEasing, settings.scrollAnimationStyle, settings.transitionFadeEnabled]);

  return {
    previousItem,
    enterRef,
    exitRef,
    beginTransition,
    setPreviousForJump,
    clearPrevious,
  };
}
