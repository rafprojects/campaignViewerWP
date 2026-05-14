/**
 * useMediaDimensions
 *
 * Enriches a MediaItem array with pixel width/height values required by
 * react-photo-album's row-packing algorithm.
 *
 * Priority:
 *  1. Server-supplied dimensions (from WP attachment metadata via REST API).
 *  2. Natural image dimensions probed via a hidden <img> element.
 *  3. Fallback ratio placeholders (4:3 images, 16:9 videos / other).
 *
 * The hook returns a stable array immediately (using fallback dimensions)
 * and updates it asynchronously once probing completes.
 */
import { useState, useEffect, useRef } from 'react';
import type { MediaItem } from '@/types';

export interface MediaItemWithDimensions extends MediaItem {
  width: number;
  height: number;
}

// Aspect-ratio fallbacks used before probing resolves.
const DEFAULT_IMAGE_RATIO = 4 / 3;
const DEFAULT_VIDEO_RATIO = 16 / 9;
/** Nominal target height used when computing placeholder width from ratio. */
const PROBE_BASE_HEIGHT = 400;

export function buildWithDimensions(item: MediaItem): MediaItemWithDimensions {
  if (item.width && item.height) {
    return item as MediaItemWithDimensions;
  }
  const ratio =
    item.type === 'video' || item.type === 'other' ? DEFAULT_VIDEO_RATIO : DEFAULT_IMAGE_RATIO;
  return {
    ...item,
    width: Math.round(PROBE_BASE_HEIGHT * ratio),
    height: PROBE_BASE_HEIGHT,
  };
}

type ProbeResult = { id: string; width: number; height: number } | null;

function probeImageDimensions(item: MediaItem): Promise<ProbeResult> {
  const src = item.thumbnail || item.url;
  if (!src) return Promise.resolve(null);

  return new Promise<ProbeResult>((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        resolve({ id: item.id, width: img.naturalWidth, height: img.naturalHeight });
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function useMediaDimensions(media: MediaItem[]): MediaItemWithDimensions[] {
  // Cache: item ID → { url that was probed, resolved width, resolved height }
  // Persists across re-renders so probing only runs when the source URL changes.
  const probeCache = useRef<Map<string, { url: string; width: number; height: number }>>(new Map());

  // Stable key derived from each item's ID and its probe source URL.
  // Effect only re-runs when actual content changes, not on every array reference change.
  const mediaKey = media.map((item) => `${item.id}:${item.thumbnail ?? item.url ?? ''}`).join('\x00');

  const [items, setItems] = useState<MediaItemWithDimensions[]>(() =>
    media.map(buildWithDimensions),
  );

  useEffect(() => {
    if (media.length === 0) {
      setItems([]);
      return;
    }

    // Build initial state: server dims > cached probe result > fallback placeholder.
    setItems(
      media.map((item) => {
        if (item.width && item.height) return item as MediaItemWithDimensions;
        const src = item.thumbnail ?? item.url ?? '';
        const cached = probeCache.current.get(item.id);
        if (cached && cached.url === src) return { ...item, width: cached.width, height: cached.height };
        return buildWithDimensions(item);
      }),
    );

    // Only probe items that are missing server dims AND have no valid cache entry.
    const needsProbe = media.filter((item) => {
      if (item.width && item.height) return false;
      const src = item.thumbnail ?? item.url ?? '';
      const cached = probeCache.current.get(item.id);
      return !(cached && cached.url === src);
    });

    if (needsProbe.length === 0) return;

    let cancelled = false;

    Promise.all(needsProbe.map(probeImageDimensions)).then((results) => {
      if (cancelled) return;

      const dimMap = new Map<string, { width: number; height: number }>();
      for (const result of results) {
        if (result) {
          const orig = media.find((m) => m.id === result.id);
          const src = orig ? (orig.thumbnail ?? orig.url ?? '') : '';
          probeCache.current.set(result.id, { url: src, width: result.width, height: result.height });
          dimMap.set(result.id, { width: result.width, height: result.height });
        }
      }

      if (dimMap.size === 0) return;

      setItems((prev) =>
        prev.map((item) => {
          const d = dimMap.get(item.id);
          return d ? { ...item, ...d } : item;
        }),
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaKey]);

  return items;
}
