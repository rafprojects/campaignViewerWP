/**
 * P18-QA: useMediaDimensions hook tests.
 *
 * Strategy: `buildWithDimensions` is tested as a pure function (no React
 * needed). `useMediaDimensions` is tested only with items that already carry
 * server-supplied dimensions so the async Image-probe branch never starts —
 * avoiding the jsdom limitation where `new Image().onload` never fires and
 * would cause `act()` to hang indefinitely.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { MediaItem } from '@/types';
import { useMediaDimensions, buildWithDimensions } from './useMediaDimensions';

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE = 400; // PROBE_BASE_HEIGHT

function img(id: string, extra?: Partial<MediaItem>): MediaItem {
  return {
    id, type: 'image', source: 'upload',
    url: `https://ex.com/${id}.jpg`,
    thumbnail: `https://ex.com/${id}-t.jpg`,
    title: id, order: 0, ...extra,
  };
}

function vid(id: string, extra?: Partial<MediaItem>): MediaItem {
  return {
    id, type: 'video', source: 'external',
    url: `https://ex.com/${id}`, title: id, order: 1, ...extra,
  };
}

// ─── buildWithDimensions (pure function) ──────────────────────────────────────

describe('buildWithDimensions', () => {
  it('passes through server-supplied dimensions unchanged', () => {
    const result = buildWithDimensions(img('a', { width: 1200, height: 800 }));
    expect(result.width).toBe(1200);
    expect(result.height).toBe(800);
  });

  it('applies 4:3 fallback for image with missing dimensions', () => {
    const result = buildWithDimensions(img('b'));
    expect(result.height).toBe(BASE);
    expect(result.width).toBe(Math.round(BASE * (4 / 3)));
  });

  it('applies 16:9 fallback for video with missing dimensions', () => {
    const result = buildWithDimensions(vid('c'));
    expect(result.height).toBe(BASE);
    expect(result.width).toBe(Math.round(BASE * (16 / 9)));
  });

  it('applies 16:9 fallback for type "other"', () => {
    const item: MediaItem = { ...img('d'), type: 'other' as MediaItem['type'] };
    const result = buildWithDimensions(item);
    expect(result.height).toBe(BASE);
    expect(result.width).toBe(Math.round(BASE * (16 / 9)));
  });

  it('treats width=0/height=0 as missing and applies ratio fallback', () => {
    const result = buildWithDimensions(img('e', { width: 0, height: 0 }));
    expect(result.height).toBe(BASE);
  });
});

// ─── useMediaDimensions hook (no-probe paths only) ────────────────────────────
//
// All items carry server-provided dimensions so needsProbe is always empty.
// IMPORTANT: media array must be defined OUTSIDE the renderHook callback so
// its reference is stable across re-renders; otherwise the hook's useEffect
// dependency array sees a new reference every render and loops infinitely.

// Stable empty array — must not be an inline [] in the callback.
const EMPTY_MEDIA: MediaItem[] = [];

describe('useMediaDimensions — no-probe paths', () => {
  it('returns [] immediately for empty input', () => {
    const { result } = renderHook(
      ({ m }: { m: MediaItem[] }) => useMediaDimensions(m),
      { initialProps: { m: EMPTY_MEDIA } },
    );
    expect(result.current).toEqual([]);
  });

  it('returns a single dimensioned item', () => {
    const media = [img('f', { width: 800, height: 600 })];
    const { result } = renderHook(() => useMediaDimensions(media));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].width).toBe(800);
    expect(result.current[0].height).toBe(600);
  });

  it('handles multiple fully-dimensioned items', () => {
    const media = [
      img('g', { width: 1200, height: 800 }),
      vid('h', { width: 1920, height: 1080 }),
    ];
    const { result } = renderHook(() => useMediaDimensions(media));
    expect(result.current).toHaveLength(2);
    expect(result.current[0].width).toBe(1200);
    expect(result.current[1].width).toBe(1920);
  });

  it('transitions to a different fully-dimensioned set on rerender', async () => {
    const m1 = [img('i', { width: 100, height: 100 })];
    const m2 = [
      img('j', { width: 200, height: 200 }),
      img('k', { width: 300, height: 300 }),
    ];
    const { result, rerender } = renderHook(
      ({ m }: { m: MediaItem[] }) => useMediaDimensions(m),
      { initialProps: { m: m1 } },
    );
    expect(result.current).toHaveLength(1);
    rerender({ m: m2 });
    await act(async () => {});
    expect(result.current).toHaveLength(2);
    expect(result.current[0].width).toBe(200);
  });

  it('transitions from non-empty to empty', async () => {
    const m1 = [img('l', { width: 400, height: 300 })];
    const { result, rerender } = renderHook(
      ({ m }: { m: MediaItem[] }) => useMediaDimensions(m),
      { initialProps: { m: m1 } },
    );
    expect(result.current).toHaveLength(1);
    rerender({ m: EMPTY_MEDIA });
    await act(async () => {});
    expect(result.current).toHaveLength(0);
  });

  it('preserves item id, type, source, url on enriched output', () => {
    const item = img('m', { width: 640, height: 480 });
    const media = [item];
    const { result } = renderHook(() => useMediaDimensions(media));
    const out = result.current[0];
    expect(out.id).toBe('m');
    expect(out.type).toBe('image');
    expect(out.url).toBe(item.url);
  });
});


