import { useEffect, useRef, useCallback } from 'react';

/**
 * Events that reset the idle timer.
 * We listen on the capture phase so nested shadow-DOM or portal content
 * still counts as user activity.
 */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'pointerdown',
];

interface UseIdleTimeoutOptions {
  /** Timeout in minutes. 0 or negative = disabled. */
  timeoutMinutes: number;
  /** Whether the user is currently authenticated. */
  isAuthenticated: boolean;
  /** Callback fired when the idle timer expires. Typically calls logout(). */
  onTimeout: () => void;
}

/**
 * Auto-logout hook that fires `onTimeout` after `timeoutMinutes` of user
 * inactivity (no mouse, keyboard, touch, or scroll events).
 *
 * - Disabled when `timeoutMinutes <= 0` or `isAuthenticated` is false.
 * - Resets the timer on any user interaction.
 * - Cleans up all listeners on unmount.
 *
 * @example
 * useIdleTimeout({
 *   timeoutMinutes: settings.sessionIdleTimeoutMinutes,
 *   isAuthenticated,
 *   onTimeout: () => void logout(),
 * });
 */
export function useIdleTimeout({ timeoutMinutes, isAuthenticated, onTimeout }: UseIdleTimeoutOptions): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Keep callback ref fresh without re-running the effect.
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const resetTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, timeoutMinutes * 60_000);
  }, [timeoutMinutes]);

  useEffect(() => {
    // Disabled when timeout is 0 / negative or user is not logged in.
    if (timeoutMinutes <= 0 || !isAuthenticated) {
      return;
    }

    // Start the initial timer.
    resetTimer();

    const handleActivity = () => {
      resetTimer();
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { capture: true, passive: true });
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity, { capture: true });
      }
    };
  }, [timeoutMinutes, isAuthenticated, resetTimer]);
}
