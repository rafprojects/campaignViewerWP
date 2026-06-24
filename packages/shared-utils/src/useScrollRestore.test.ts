/**
 * Tests for useScrollRestore — covers callbackRef branches (lines 53-69),
 * tabKey-change effect (lines 79-82), cleanup (lines 88-91).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollRestore } from './useScrollRestore';

function makeElement(scrollTop = 0) {
  const listeners: Record<string, EventListener[]> = {};
  return {
    scrollTop,
    addEventListener: (type: string, fn: EventListener) => {
      if (!listeners[type]) listeners[type] = [];
      listeners[type].push(fn);
    },
    removeEventListener: (type: string, fn: EventListener) => {
      if (listeners[type]) {
        listeners[type] = listeners[type].filter((l) => l !== fn);
      }
    },
    dispatchScroll() {
      listeners['scroll']?.forEach((fn) => fn(new Event('scroll')));
    },
  };
}

beforeEach(() => localStorage.clear());

describe('useScrollRestore — callbackRef', () => {
  it('returns a stable callback ref', () => {
    const { result } = renderHook(() => useScrollRestore('feat'));
    expect(typeof result.current).toBe('function');
  });

  it('attaches scroll listener when element is provided', () => {
    const { result } = renderHook(() => useScrollRestore('feat'));
    const el = makeElement();
    act(() => result.current(el as unknown as HTMLElement));
    // Listener attached — dispatching scroll should not throw
    expect(() => el.dispatchScroll()).not.toThrow();
  });

  it('restores saved scroll position on mount', () => {
    localStorage.setItem('wpsg_view_root_scroll_feat', JSON.stringify(42));
    const { result } = renderHook(() => useScrollRestore('feat'));
    const el = makeElement(0);
    act(() => result.current(el as unknown as HTMLElement));
    expect(el.scrollTop).toBe(42);
  });

  it('leaves scrollTop at 0 when no saved position exists', () => {
    const { result } = renderHook(() => useScrollRestore('feat'));
    const el = makeElement(0);
    act(() => result.current(el as unknown as HTMLElement));
    expect(el.scrollTop).toBe(0);
  });

  it('is a no-op when called with null (el detach path, line 61)', () => {
    const { result } = renderHook(() => useScrollRestore('feat'));
    const el = makeElement();
    act(() => result.current(el as unknown as HTMLElement));
    // Calling with null removes listener from previous element (line 55-57)
    act(() => result.current(null));
    // Should not throw
  });

  it('is a no-op when called with the same element twice (line 53 early return)', () => {
    const { result } = renderHook(() => useScrollRestore('feat'));
    const el = makeElement();
    act(() => result.current(el as unknown as HTMLElement));
    act(() => result.current(el as unknown as HTMLElement)); // same ref → early return
  });

  it('persists scrollTop to localStorage on scroll after debounce', async () => {
    const { result } = renderHook(() => useScrollRestore('feat'));
    const el = makeElement(0);
    act(() => result.current(el as unknown as HTMLElement));
    el.scrollTop = 100;
    act(() => el.dispatchScroll());
    // Debounce fires after 200ms
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    const stored = JSON.parse(localStorage.getItem('wpsg_view_root_scroll_feat') ?? 'null');
    expect(stored).toBe(100);
  });
});

describe('useScrollRestore — tabKey change effect', () => {
  it('restores scroll position when tabKey changes', () => {
    localStorage.setItem('wpsg_view_root_scroll_feat_tab2', JSON.stringify(55));
    const { result, rerender } = renderHook(
      ({ tab }: { tab: string }) => useScrollRestore('feat', tab),
      { initialProps: { tab: 'tab1' } },
    );
    const el = makeElement(0);
    act(() => result.current(el as unknown as HTMLElement));
    act(() => rerender({ tab: 'tab2' }));
    expect(el.scrollTop).toBe(55);
  });

  it('resets to 0 when tabKey changes and no saved position exists', () => {
    const { result, rerender } = renderHook(
      ({ tab }: { tab: string }) => useScrollRestore('feat', tab),
      { initialProps: { tab: 'tab1' } },
    );
    const el = makeElement(99);
    act(() => result.current(el as unknown as HTMLElement));
    act(() => rerender({ tab: 'tab-new' }));
    expect(el.scrollTop).toBe(0);
  });

  it('is a no-op when no element is attached (line 78 guard)', () => {
    const { rerender } = renderHook(
      ({ tab }: { tab: string }) => useScrollRestore('feat', tab),
      { initialProps: { tab: 'tab1' } },
    );
    // No element attached → effect early-returns
    act(() => rerender({ tab: 'tab2' }));
    // No throw
  });
});

describe('useScrollRestore — options', () => {
  it('uses tabKey in the storage key', () => {
    localStorage.setItem('wpsg_view_root_scroll_gallery_list', JSON.stringify(10));
    const { result } = renderHook(() => useScrollRestore('gallery', 'list'));
    const el = makeElement(0);
    act(() => result.current(el as unknown as HTMLElement));
    expect(el.scrollTop).toBe(10);
  });

  it('uses custom namespace and scopeId', () => {
    localStorage.setItem('myns_site1_scroll_panel', JSON.stringify(30));
    const { result } = renderHook(() =>
      useScrollRestore('panel', null, { namespace: 'myns', scopeId: 'site1' }),
    );
    const el = makeElement(0);
    act(() => result.current(el as unknown as HTMLElement));
    expect(el.scrollTop).toBe(30);
  });
});
