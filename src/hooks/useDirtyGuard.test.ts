import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useDirtyGuard } from './useDirtyGuard';

describe('useDirtyGuard', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any beforeunload listeners
    window.onbeforeunload = null;
  });

  it('allows close when form is not dirty', () => {
    const { result } = renderHook(() =>
      useDirtyGuard({
        current: { title: 'Hello' },
        isOpen: true,
        onClose,
      }),
    );

    expect(result.current.isDirty).toBe(false);
    act(() => result.current.guardedClose());
    expect(onClose).toHaveBeenCalledOnce();
    expect(result.current.confirmOpen).toBe(false);
  });

  it('shows confirm modal when form is dirty', () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: { title: string } }) =>
        useDirtyGuard({ current, isOpen: true, onClose }),
      { initialProps: { current: { title: 'Hello' } } },
    );

    // Mutate the form value
    rerender({ current: { title: 'Changed' } });

    expect(result.current.isDirty).toBe(true);

    act(() => result.current.guardedClose());
    expect(onClose).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(true);
  });

  it('closes on confirmDiscard', () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: { title: string } }) =>
        useDirtyGuard({ current, isOpen: true, onClose }),
      { initialProps: { current: { title: 'Hello' } } },
    );

    rerender({ current: { title: 'Changed' } });
    act(() => result.current.guardedClose());
    expect(result.current.confirmOpen).toBe(true);

    act(() => result.current.confirmDiscard());
    expect(onClose).toHaveBeenCalledOnce();
    expect(result.current.confirmOpen).toBe(false);
  });

  it('dismisses confirm on cancelDiscard', () => {
    const { result, rerender } = renderHook(
      ({ current }: { current: { title: string } }) =>
        useDirtyGuard({ current, isOpen: true, onClose }),
      { initialProps: { current: { title: 'Hello' } } },
    );

    rerender({ current: { title: 'Changed' } });
    act(() => result.current.guardedClose());
    act(() => result.current.cancelDiscard());
    expect(result.current.confirmOpen).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is not dirty when modal is closed', () => {
    const { result } = renderHook(() =>
      useDirtyGuard({
        current: { title: 'Changed' },
        isOpen: false,
        onClose,
      }),
    );

    expect(result.current.isDirty).toBe(false);
  });

  it('adds beforeunload listener when dirty', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { rerender, unmount } = renderHook(
      ({ current }: { current: { title: string } }) =>
        useDirtyGuard({ current, isOpen: true, onClose }),
      { initialProps: { current: { title: 'Hello' } } },
    );

    rerender({ current: { title: 'Changed' } });

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
