/**
 * P12-C: Gallery Adapter Registry
 *
 * Runtime registry for gallery adapters. Adapters register themselves at
 * module init time. The resolver falls back to 'classic' for any unknown id,
 * ensuring existing galleries are never broken by an unrecognised setting value.
 */
import type {
  AdapterRegistration,
  AdapterMediaType,
  ImageAdapterProps,
  VideoAdapterProps,
} from './GalleryAdapter';
import type { ComponentType } from 'react';

// Internal map keyed as "<mediaType>:<id>"
const registry = new Map<string, AdapterRegistration<AdapterMediaType>>();

export function registerAdapter(reg: AdapterRegistration<AdapterMediaType>): void {
  const key = `${reg.mediaType}:${reg.id}`;
  registry.set(key, reg);
}

/** Return all registered adapters for a given media type. */
export function getRegisteredAdapters(
  mediaType: AdapterMediaType,
): AdapterRegistration<AdapterMediaType>[] {
  return Array.from(registry.values()).filter((r) => r.mediaType === mediaType);
}

/**
 * Resolve an adapter by id for a given media type.
 * Falls back to 'classic' if the requested id is not registered.
 * Throws only if 'classic' itself is not registered (should never happen).
 */
export function resolveImageAdapter(id: string): ComponentType<ImageAdapterProps> {
  const key = `image:${id}`;
  const found = registry.get(key);
  if (found) return found.component as ComponentType<ImageAdapterProps>;

  // Hard fallback
  const classic = registry.get('image:classic');
  if (classic) return classic.component as ComponentType<ImageAdapterProps>;

  throw new Error(
    `[WPSG] No image adapter registered for id="${id}" and no "classic" fallback found.`,
  );
}

export function resolveVideoAdapter(id: string): ComponentType<VideoAdapterProps> {
  const key = `video:${id}`;
  const found = registry.get(key);
  if (found) return found.component as ComponentType<VideoAdapterProps>;

  const classic = registry.get('video:classic');
  if (classic) return classic.component as ComponentType<VideoAdapterProps>;

  throw new Error(
    `[WPSG] No video adapter registered for id="${id}" and no "classic" fallback found.`,
  );
}
