import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIdleTimeout } from './useIdleTimeout';

describe('useIdleTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does nothing when timeoutMinutes is 0 (disabled)', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useIdleTimeout({ timeoutMinutes: 0, isAuthenticated: true, onTimeout }),
    );

    vi.advanceTimersByTime(10 * 60_000); // 10 minutes
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('does nothing when user is not authenticated', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useIdleTimeout({ timeoutMinutes: 5, isAuthenticated: false, onTimeout }),
    );

    vi.advanceTimersByTime(10 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('fires onTimeout after the configured idle period', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useIdleTimeout({ timeoutMinutes: 5, isAuthenticated: true, onTimeout }),
    );

    // Should not fire before the timeout
    vi.advanceTimersByTime(4 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();

    // Should fire once the timeout elapses
    vi.advanceTimersByTime(60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on user activity (mousemove)', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useIdleTimeout({ timeoutMinutes: 5, isAuthenticated: true, onTimeout }),
    );

    // Wait 4 minutes, then simulate activity.
    vi.advanceTimersByTime(4 * 60_000);
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
    });

    // Another 4 minutes — would have been 8 total without reset.
    vi.advanceTimersByTime(4 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();

    // 1 more minute → exactly 5 since last activity.
    vi.advanceTimersByTime(60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('resets the timer on keydown events', () => {
    const onTimeout = vi.fn();
    renderHook(() =>
      useIdleTimeout({ timeoutMinutes: 2, isAuthenticated: true, onTimeout }),
    );

    vi.advanceTimersByTime(1.5 * 60_000);
    act(() => {
      window.dispatchEvent(new Event('keydown'));
    });

    // 1.5 min since keydown — should not fire yet.
    vi.advanceTimersByTime(1.5 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();

    // 0.5 min more → exactly 2 min since keydown.
    vi.advanceTimersByTime(0.5 * 60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() =>
      useIdleTimeout({ timeoutMinutes: 5, isAuthenticated: true, onTimeout }),
    );

    unmount();

    // Expect all ACTIVITY_EVENTS listeners were removed.
    const removedEvents = spy.mock.calls.map((call) => call[0]);
    expect(removedEvents).toContain('mousemove');
    expect(removedEvents).toContain('keydown');
    expect(removedEvents).toContain('scroll');
    expect(removedEvents).toContain('touchstart');
    expect(removedEvents).toContain('pointerdown');
    expect(removedEvents).toContain('mousedown');

    // Timer should not fire after unmount.
    vi.advanceTimersByTime(10 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('disables properly when timeoutMinutes changes to 0', () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ timeoutMinutes }) =>
        useIdleTimeout({ timeoutMinutes, isAuthenticated: true, onTimeout }),
      { initialProps: { timeoutMinutes: 5 } },
    );

    // Active for 2 minutes.
    vi.advanceTimersByTime(2 * 60_000);

    // Now disable.
    rerender({ timeoutMinutes: 0 });

    // Wait well past old timeout — should NOT fire.
    vi.advanceTimersByTime(10 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('adjusts when timeoutMinutes changes to a new positive value', () => {
    const onTimeout = vi.fn();
    const { rerender } = renderHook(
      ({ timeoutMinutes }) =>
        useIdleTimeout({ timeoutMinutes, isAuthenticated: true, onTimeout }),
      { initialProps: { timeoutMinutes: 10 } },
    );

    vi.advanceTimersByTime(5 * 60_000);

    // Change to 3 minutes — timer restarts.
    rerender({ timeoutMinutes: 3 });

    // 2.5 minutes into new timeout.
    vi.advanceTimersByTime(2.5 * 60_000);
    expect(onTimeout).not.toHaveBeenCalled();

    // 0.5 more → 3 min since change.
    vi.advanceTimersByTime(0.5 * 60_000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  describe('onWarning', () => {
    it('fires onWarning with secondsRemaining before onTimeout', () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();
      renderHook(() =>
        useIdleTimeout({
          timeoutMinutes: 5,
          isAuthenticated: true,
          onTimeout,
          warningThresholdMs: 60_000, // 1 minute warning
          onWarning,
        }),
      );

      // 4 minutes elapsed — warning threshold reached (1 min remaining)
      vi.advanceTimersByTime(4 * 60_000);
      expect(onWarning).toHaveBeenCalledTimes(1);
      expect(onWarning).toHaveBeenCalledWith(60);
      expect(onTimeout).not.toHaveBeenCalled();

      // 1 more minute → timeout fires
      vi.advanceTimersByTime(60_000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('reset() cancels both warning and timeout timers', () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();
      const { result } = renderHook(() =>
        useIdleTimeout({
          timeoutMinutes: 5,
          isAuthenticated: true,
          onTimeout,
          warningThresholdMs: 60_000,
          onWarning,
        }),
      );

      // Advance to just before warning
      vi.advanceTimersByTime(3 * 60_000);

      // Programmatic reset — restarts both timers from now
      act(() => {
        result.current.reset();
      });

      // Full 5 minutes past the reset — warning fires again and then timeout
      vi.advanceTimersByTime(4 * 60_000);
      expect(onWarning).toHaveBeenCalledTimes(1); // once after reset, not twice

      vi.advanceTimersByTime(60_000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('activity after warning resets both timers preventing original timeout', () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();
      renderHook(() =>
        useIdleTimeout({
          timeoutMinutes: 5,
          isAuthenticated: true,
          onTimeout,
          warningThresholdMs: 60_000,
          onWarning,
        }),
      );

      // Advance to warning point
      vi.advanceTimersByTime(4 * 60_000);
      expect(onWarning).toHaveBeenCalledTimes(1);

      // User becomes active — resets both timers
      act(() => {
        window.dispatchEvent(new Event('mousemove'));
      });

      // Original timeout would have fired 1 min after warning, but timer reset
      vi.advanceTimersByTime(60_000);
      expect(onTimeout).not.toHaveBeenCalled();

      // Full new cycle: warning fires again at 4 min, timeout at 5 min
      vi.advanceTimersByTime(3 * 60_000);
      expect(onWarning).toHaveBeenCalledTimes(2);
      vi.advanceTimersByTime(60_000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('no warning when warningThresholdMs is 0', () => {
      const onTimeout = vi.fn();
      const onWarning = vi.fn();
      renderHook(() =>
        useIdleTimeout({
          timeoutMinutes: 5,
          isAuthenticated: true,
          onTimeout,
          warningThresholdMs: 0,
          onWarning,
        }),
      );

      vi.advanceTimersByTime(5 * 60_000);
      expect(onWarning).not.toHaveBeenCalled();
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });

    it('no warning when onWarning is not provided (backward-compatible)', () => {
      const onTimeout = vi.fn();
      renderHook(() =>
        useIdleTimeout({ timeoutMinutes: 5, isAuthenticated: true, onTimeout }),
      );

      // Should not throw, warning path is simply skipped
      vi.advanceTimersByTime(5 * 60_000);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    });
  });
});
