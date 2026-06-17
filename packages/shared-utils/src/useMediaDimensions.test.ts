import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { buildWithDimensions, useMediaDimensions, type MediaDimensionInput } from './useMediaDimensions';

describe('buildWithDimensions', () => {
  it('returns the item unchanged when it already has width and height', () => {
    const item = { id: '1', width: 10, height: 20 };
    expect(buildWithDimensions(item)).toBe(item);
  });
  it('uses a 4:3 placeholder for images / untyped', () => {
    expect(buildWithDimensions({ id: '1' })).toEqual({ id: '1', width: 533, height: 400 });
    expect(buildWithDimensions({ id: '1', type: 'image' })).toEqual({ id: '1', type: 'image', width: 533, height: 400 });
  });
  it('uses a 16:9 placeholder for video and other', () => {
    expect(buildWithDimensions({ id: '1', type: 'video' })).toMatchObject({ width: 711, height: 400 });
    expect(buildWithDimensions({ id: '1', type: 'other' })).toMatchObject({ width: 711, height: 400 });
  });
});

// Controllable Image stub: each `src` assignment resolves from `imageResults`.
const imageResults: Record<string, { w: number; h: number } | 'error' | 'zero'> = {};
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(value: string) {
    queueMicrotask(() => {
      const r = imageResults[value];
      if (r === 'error') return this.onerror?.();
      if (r && r !== 'zero') {
        this.naturalWidth = r.w;
        this.naturalHeight = r.h;
      }
      this.onload?.();
    });
  }
}

describe('useMediaDimensions', () => {
  beforeEach(() => {
    for (const k of Object.keys(imageResults)) delete imageResults[k];
    vi.stubGlobal('Image', MockImage as unknown as typeof Image);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('returns an empty array for empty input', async () => {
    const { result } = renderHook(() => useMediaDimensions([]));
    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('returns server dimensions as-is without probing', async () => {
    const media: MediaDimensionInput[] = [{ id: '1', width: 100, height: 50, url: 'u1' }];
    const { result } = renderHook(() => useMediaDimensions(media));
    expect(result.current[0]).toMatchObject({ width: 100, height: 50 });
  });

  it('starts with a fallback placeholder then updates from a successful probe', async () => {
    imageResults['pic.jpg'] = { w: 640, h: 480 };
    const media: MediaDimensionInput[] = [{ id: '1', type: 'image', url: 'pic.jpg' }];
    const { result } = renderHook(() => useMediaDimensions(media));
    // initial fallback (4:3 placeholder)
    expect(result.current[0]).toMatchObject({ width: 533, height: 400 });
    // probe resolves to natural dimensions
    await waitFor(() => expect(result.current[0]).toMatchObject({ width: 640, height: 480 }));
  });

  it('keeps the fallback when the probe fails or yields zero dimensions', async () => {
    imageResults['bad.jpg'] = 'error';
    imageResults['zero.jpg'] = 'zero';
    const media: MediaDimensionInput[] = [
      { id: '1', type: 'image', thumbnail: 'bad.jpg' },
      { id: '2', type: 'video', url: 'zero.jpg' },
    ];
    const { result } = renderHook(() => useMediaDimensions(media));
    await waitFor(() => expect(result.current).toHaveLength(2));
    // both remain at their fallback placeholders
    expect(result.current[0]).toMatchObject({ width: 533, height: 400 });
    expect(result.current[1]).toMatchObject({ width: 711, height: 400 });
  });

  it('does not probe an item with neither thumbnail nor url', async () => {
    const media: MediaDimensionInput[] = [{ id: '1', type: 'image' }];
    const { result } = renderHook(() => useMediaDimensions(media));
    await waitFor(() => expect(result.current[0]).toMatchObject({ width: 533, height: 400 }));
  });
});
