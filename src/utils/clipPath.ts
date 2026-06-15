/**
 * App-side clip-path wrappers that operate on the rich `LayoutSlot` type.
 *
 * The framework-agnostic shape→clip-path logic (`getClipPathForShape`) lives in
 * `@wp-super-gallery/shared-utils`; these wrappers adapt it to `LayoutSlot`.
 * Used by both LayoutSlotComponent (admin builder) and LayoutBuilderGallery
 * (public adapter) to ensure consistent rendering.
 */
import type { LayoutSlot } from '@/types';
import { getClipPathForShape } from '@wp-super-gallery/shared-utils';

/**
 * Returns the CSS `clip-path` value for a given slot shape,
 * or `undefined` for `rectangle` (no clipping).
 */
export function getClipPath(slot: LayoutSlot): string | undefined {
  return getClipPathForShape(slot.shape, slot.clipPath);
}

/**
 * True when clip-path is used — needs `drop-shadow` instead of
 * `box-shadow` for the glow hover effect.
 */
export function usesClipPath(slot: LayoutSlot): boolean {
  return slot.shape !== 'rectangle';
}
