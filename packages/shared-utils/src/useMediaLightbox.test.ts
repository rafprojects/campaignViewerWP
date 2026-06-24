/**
 * Tests for useMediaLightbox — covers keyboard navigation branches
 * (ArrowLeft, ArrowRight, Escape) and index wrapping.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaLightbox } from './useMediaLightbox';

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `item-${i}` }));
}

function fireKey(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

describe('useMediaLightbox — openLightbox', () => {
  it('opens at the correct index for an item in the list', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-2' }));
    expect(result.current.lightboxOpen).toBe(true);
    expect(result.current.lightboxIndex).toBe(2);
  });

  it('is a no-op when item is not found', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'not-in-list' }));
    expect(result.current.lightboxOpen).toBe(false);
  });
});

describe('useMediaLightbox — navigateLightbox', () => {
  it('navigates backward from index 1 to index 0', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-1' }));
    act(() => result.current.navigateLightbox('prev'));
    expect(result.current.lightboxIndex).toBe(0);
  });

  it('wraps backward from index 0 to last index', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-0' }));
    act(() => result.current.navigateLightbox('prev'));
    expect(result.current.lightboxIndex).toBe(2);
  });

  it('navigates forward from index 1 to index 2', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-1' }));
    act(() => result.current.navigateLightbox('next'));
    expect(result.current.lightboxIndex).toBe(2);
  });

  it('wraps forward from last index to 0', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-2' }));
    act(() => result.current.navigateLightbox('next'));
    expect(result.current.lightboxIndex).toBe(0);
  });
});

describe('useMediaLightbox — keyboard navigation (lines 36-44)', () => {
  it('ArrowLeft key navigates to previous item', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-2' }));
    act(() => fireKey('ArrowLeft'));
    expect(result.current.lightboxIndex).toBe(1);
  });

  it('ArrowRight key navigates to next item', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-0' }));
    act(() => fireKey('ArrowRight'));
    expect(result.current.lightboxIndex).toBe(1);
  });

  it('Escape key closes the lightbox', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-1' }));
    expect(result.current.lightboxOpen).toBe(true);
    act(() => fireKey('Escape'));
    expect(result.current.lightboxOpen).toBe(false);
  });

  it('keyboard events are ignored when lightbox is closed', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    // lightboxOpen = false → keydown listener not added
    act(() => fireKey('ArrowLeft'));
    expect(result.current.lightboxIndex).toBe(0); // unchanged
  });

  it('unrelated keys do not change state', () => {
    const { result } = renderHook(() => useMediaLightbox(items(3)));
    act(() => result.current.openLightbox({ id: 'item-1' }));
    act(() => fireKey('Enter'));
    expect(result.current.lightboxIndex).toBe(1); // unchanged
    expect(result.current.lightboxOpen).toBe(true); // unchanged
  });
});
