import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLightbox } from './useLightbox';

describe('useLightbox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  it('initialises closed by default', () => {
    const { result } = renderHook(() => useLightbox());
    expect(result.current.isOpen).toBe(false);
  });

  it('respects initialOpen=true', () => {
    const { result } = renderHook(() => useLightbox({ initialOpen: true }));
    expect(result.current.isOpen).toBe(true);
  });

  it('open() sets isOpen to true and locks body scroll', () => {
    const { result } = renderHook(() => useLightbox());
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('close() sets isOpen to false and unlocks body scroll', () => {
    const { result } = renderHook(() => useLightbox({ initialOpen: true }));
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('toggle() flips isOpen state', () => {
    const { result } = renderHook(() => useLightbox());
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('setIsOpen() allows direct state override', () => {
    const { result } = renderHook(() => useLightbox());
    act(() => {
      result.current.setIsOpen(true);
    });
    expect(result.current.isOpen).toBe(true);
  });

  it('Escape key closes lightbox when open', () => {
    const { result } = renderHook(() => useLightbox({ initialOpen: true }));
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('arrow keys call onPrev/onNext when enableArrowNavigation=true', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderHook(() =>
      useLightbox({ initialOpen: true, enableArrowNavigation: true, onPrev, onNext }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('arrow keys do NOT fire when enableArrowNavigation=false', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderHook(() =>
      useLightbox({ initialOpen: true, enableArrowNavigation: false, onPrev, onNext }),
    );
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('keyboard listener is removed when closed', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    const { result } = renderHook(() =>
      useLightbox({ initialOpen: true, enableArrowNavigation: true, onPrev, onNext }),
    );
    // Close the lightbox — effect should clean up and not re-register the listener
    act(() => {
      result.current.close();
    });
    // Arrow keys must no longer fire callbacks
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(onPrev).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });
});

// ── Scroll-lock coordination (P31-A) ─────────────────────────────────────────
//
// The shared module-level lock manager must:
//   – Keep body scroll locked while ANY consumer is open.
//   – Restore the previous overflow value (not unconditionally '') on unlock.
//   – Not drive the lock count negative from repeated or out-of-order releases.

describe('useLightbox – scroll-lock coordination', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('keeps body scroll locked while a second concurrent consumer is still open', () => {
    const { result: a } = renderHook(() => useLightbox());
    const { result: b } = renderHook(() => useLightbox());

    act(() => {
      a.current.open();
      b.current.open();
    });
    expect(document.body.style.overflow).toBe('hidden');

    // First consumer closes — second is still open, scroll must stay locked.
    act(() => { a.current.close(); });
    expect(document.body.style.overflow).toBe('hidden');

    // Last consumer closes — scroll must unlock.
    act(() => { b.current.close(); });
    expect(document.body.style.overflow).toBe('');
  });

  it('restores the previous overflow value instead of always writing empty string', () => {
    document.body.style.overflow = 'scroll';

    const { result } = renderHook(() => useLightbox());
    act(() => { result.current.open(); });
    expect(document.body.style.overflow).toBe('hidden');

    act(() => { result.current.close(); });
    expect(document.body.style.overflow).toBe('scroll');

    // Restore for afterEach
    document.body.style.overflow = '';
  });

  it('keeps body scroll locked after one of two concurrent consumers unmounts while open', () => {
    const { result: a } = renderHook(() => useLightbox());
    const { result: b, unmount: unmountB } = renderHook(() => useLightbox());

    act(() => {
      a.current.open();
      b.current.open();
    });
    expect(document.body.style.overflow).toBe('hidden');

    // Unmount B while still open — A is still open so body must stay locked.
    unmountB();
    expect(document.body.style.overflow).toBe('hidden');

    // Close A — now body should unlock.
    act(() => { a.current.close(); });
    expect(document.body.style.overflow).toBe('');
  });

  it('does not drive the lock count negative from repeated close calls', () => {
    const { result } = renderHook(() => useLightbox());

    act(() => { result.current.open(); });
    expect(document.body.style.overflow).toBe('hidden');

    // Call close multiple times — should not error and should only unlock once.
    act(() => { result.current.close(); });
    act(() => { result.current.close(); });
    act(() => { result.current.close(); });

    expect(document.body.style.overflow).toBe('');
  });
});
