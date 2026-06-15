/**
 * Shared clip-path shape presets for layout builder shapes.
 *
 * Framework-agnostic: takes a shape key + optional custom clip-path and returns
 * the CSS `clip-path` value. The app-side `getClipPath(slot)` / `usesClipPath`
 * wrappers (which take the richer `LayoutSlot`) live in `src/utils/clipPath.ts`.
 */
import { sanitizeClipPath } from './sanitizeCss';

/** Shape presets (mirrors the app's `LayoutSlotShape`, kept local). */
export type LayoutSlotShape =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'hexagon'
  | 'diamond'
  | 'parallelogram-left'
  | 'parallelogram-right'
  | 'chevron'
  | 'arrow'
  | 'trapezoid'
  | 'custom';

/**
 * Returns the CSS `clip-path` value for a given shape preset (and optional
 * custom clip-path when `shape === 'custom'`), or `undefined` for `rectangle`
 * / absent shape (no clipping).
 */
export function getClipPathForShape(
  shape: LayoutSlotShape | undefined,
  customClipPath?: string | undefined,
): string | undefined {
  switch (shape) {
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
      return sanitizeClipPath(customClipPath) || undefined;
    case 'rectangle':
    default:
      return undefined;
  }
}
