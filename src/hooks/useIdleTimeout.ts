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
  /**
   * Milliseconds before timeout to fire `onWarning`.
   * Set to 0 to disable the warning. Default: 120_000 (2 minutes).
   */
  warningThresholdMs?: number;
  /**
   * Called `warningThresholdMs` before the timeout fires.
   * Receives the number of seconds remaining until logout.
   */
  onWarning?: (secondsRemaining: number) => void;
}

/**
 * Auto-logout hook that fires `onTimeout` after `timeoutMinutes` of user
 * inactivity (no mouse, keyboard, touch, or scroll events).
 *
 * - Disabled when `timeoutMinutes <= 0` or `isAuthenticated` is false.
 * - Resets the timer on any user interaction.
 * - Optionally fires `onWarning` with seconds-remaining before logout.
 * - Cleans up all listeners on unmount.
 * - Returns `{ reset }` so callers can programmatically reset the timer
 *   (e.g. from a "Stay signed in" button).
 */
export function useIdleTimeout({
  timeoutMinutes,
  isAuthenticated,
  onTimeout,
  warningThresholdMs = 120_000,
  onWarning,
}: UseIdleTimeoutOptions): { reset: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    onWarningRef.current = onWarning;
  }, [onWarning]);

  const resetTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    if (warningTimerRef.current !== null) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    const totalMs = timeoutMinutes * 60_000;

    if (warningThresholdMs > 0 && warningThresholdMs < totalMs && onWarningRef.current) {
      warningTimerRef.current = setTimeout(() => {
        onWarningRef.current?.(Math.round(warningThresholdMs / 1000));
      }, totalMs - warningThresholdMs);
    }

    timerRef.current = setTimeout(() => {
      onTimeoutRef.current();
    }, totalMs);
  }, [timeoutMinutes, warningThresholdMs]);

  useEffect(() => {
    if (timeoutMinutes <= 0 || !isAuthenticated) {
      return;
    }

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
      if (warningTimerRef.current !== null) {
        clearTimeout(warningTimerRef.current);
        warningTimerRef.current = null;
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity, { capture: true });
      }
    };
  }, [timeoutMinutes, isAuthenticated, resetTimer]);

  return { reset: resetTimer };
}
