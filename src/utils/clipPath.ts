/**
 * Shared clip-path utilities for layout builder shapes.
 *
 * Used by both LayoutSlotComponent (admin builder) and
 * LayoutBuilderGallery (public adapter) to ensure consistent rendering.
 */
import type { LayoutSlot } from '@/types';

/**
 * Returns the CSS `clip-path` value for a given slot shape,
 * or `undefined` for `rectangle` (no clipping).
 */
export function getClipPath(slot: LayoutSlot): string | undefined {
  switch (slot.shape) {
    case 'circle':
      return 'ellipse(50% 50% at 50% 50%)';
    case 'ellipse':
      return 'ellipse(50% 50% at 50% 50%)';
    case 'hexagon':
      return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    case 'diamond':
      return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    case 'parallelogram-left':
      return 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)';
    case 'parallelogram-right':
      return 'polygon(0% 0%, 85% 0%, 100% 100%, 15% 100%)';
    case 'chevron':
      return 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)';
    case 'arrow':
      return 'polygon(0% 0%, 70% 0%, 100% 50%, 70% 100%, 0% 100%, 30% 50%)';
    case 'trapezoid':
      return 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)';
    case 'custom':
      return slot.clipPath || undefined;
    case 'rectangle':
    default:
      return undefined;
  }
}

/**
 * True when clip-path is used — needs `drop-shadow` instead of
 * `box-shadow` for the glow hover effect.
 */
export function usesClipPath(slot: LayoutSlot): boolean {
  return slot.shape !== 'rectangle';
}
