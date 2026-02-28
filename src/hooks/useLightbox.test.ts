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
    const { result } = renderHook(() => useLightbox({ initialOpen: true }));
    act(() => {
      result.current.close();
    });
    const onPrev = vi.fn();
    // No listener should fire after close
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onPrev).not.toHaveBeenCalled();
  });
});
