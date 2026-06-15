/**
 * Gallery Transition Utility
 *
 * Imperatively applies CSS transitions to enter/exit media elements.
 * Called from useLayoutEffect to guarantee transitions run before the
 * browser's first paint of the new content.
 *
 * This replaces the previous CSS @keyframes approach which was unreliable
 * across shadow DOM boundaries and browsers.  The technique:
 *   1. Set the element's initial position (no transition)
 *   2. Force a synchronous reflow (getBoundingClientRect)
 *   3. Set the final position with a CSS transition
 * The browser MUST animate because it already computed the initial state.
 */

export interface TransitionOpts {
  direction: 1 | -1;
  transitionType: 'fade' | 'slide' | 'slide-fade';
  durationMs: number;
  easing: string;
  /** When true, opacity fade is always applied regardless of transitionType. */
  transitionFadeEnabled?: boolean;
}

/**
 * Apply enter/exit CSS transitions to gallery media layers.
 * MUST be called from useLayoutEffect (before browser paint).
 */
export function applyGalleryTransition(
  enterEl: HTMLElement | null,
  exitEl: HTMLElement | null,
  opts: TransitionOpts,
): void {
  const { direction, transitionType, durationMs, easing, transitionFadeEnabled = false } = opts;
  const useSlide = transitionType === 'slide' || transitionType === 'slide-fade';
  const useFade = transitionType === 'fade' || transitionType === 'slide-fade' || transitionFadeEnabled;
  const dur = `${durationMs}ms`;
  const txEnter = direction === 1 ? '60%' : '-60%';
  const txExit = direction === 1 ? '-60%' : '60%';

  const parts: string[] = [];
  if (useSlide) parts.push(`transform ${dur} ${easing}`);
  if (useFade) parts.push(`opacity ${dur} ${easing}`);
  const transition = parts.join(', ');

  // --- Enter (new content) ---
  if (enterEl) {
    enterEl.style.transition = 'none';
    enterEl.style.transform = useSlide ? `translateX(${txEnter})` : '';
    enterEl.style.opacity = useFade ? '0' : '';
    // Force reflow so the browser registers the initial state
    void enterEl.getBoundingClientRect();
    enterEl.style.transition = transition;
    enterEl.style.transform = 'translateX(0)';
    enterEl.style.opacity = '1';
  }

  // --- Exit (old content) ---
  if (exitEl) {
    exitEl.style.transition = 'none';
    exitEl.style.transform = 'translateX(0)';
    exitEl.style.opacity = '1';
    void exitEl.getBoundingClientRect();
    exitEl.style.transition = transition;
    exitEl.style.transform = useSlide ? `translateX(${txExit})` : '';
    exitEl.style.opacity = useFade ? '0' : '';
  }
}
