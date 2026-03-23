/**
 * P12-C: Gallery Adapter Registry
 *
 * Runtime registry for gallery adapters. Adapters register themselves at
 * module init time. The resolver falls back to 'classic' for any unknown id,
 * ensuring existing galleries are never broken by an unrecognised setting value.
 *
 * All adapters are now type-agnostic: they receive the full media array
 * (images + videos) and decide how to display it.
 */
import type { AdapterRegistration, GalleryAdapterProps } from './GalleryAdapter';
import type { ComponentType } from 'react';

// Internal map keyed by adapter id
const registry = new Map<string, AdapterRegistration>();

export function registerAdapter(reg: AdapterRegistration): void {
  registry.set(reg.id, reg);
}

/** Return all registered adapters. */
export function getRegisteredAdapters(): AdapterRegistration[] {
  return Array.from(registry.values());
}

/**
 * Resolve an adapter component by id.
 * Falls back to 'classic' if the requested id is not registered.
 * Throws only if 'classic' itself is not registered (should never happen).
 */
export function resolveAdapter(id: string): ComponentType<GalleryAdapterProps> {
  const found = registry.get(id);
  if (found) return found.component;

  // Hard fallback
  const classic = registry.get('classic');
  if (classic) return classic.component;

  throw new Error(
    `[WPSG] No adapter registered for id="${id}" and no "classic" fallback found.`,
  );
}
