/**
 * P50-J — transform helper for graphic layers (overlays).
 *
 * Kept in a util file (not the component) so the renderer component stays
 * fast-refresh clean (react-refresh/only-export-components).
 */
import type { LayoutGraphicLayer } from '@/types';

/** Builds the CSS `transform` string for rotation + horizontal/vertical flip. */
export function buildGraphicLayerTransform(layer: LayoutGraphicLayer): string | undefined {
  const parts: string[] = [];
  if (layer.rotation) parts.push(`rotate(${layer.rotation}deg)`);
  if (layer.flipH) parts.push('scaleX(-1)');
  if (layer.flipV) parts.push('scaleY(-1)');
  return parts.length > 0 ? parts.join(' ') : undefined;
}
