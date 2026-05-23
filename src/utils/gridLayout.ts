/**
 * Pure grid-layout math shared between CardGallery and CompactGridGallery.
 * React-free and fully testable without hooks.
 */
import { toCss, type CssWidthUnit } from './cssUnits';
import type { GalleryBehaviorSettings } from '@/types';
import { resolveColumnsFromWidth } from './resolveColumnsFromWidth';

/**
 * Scale a card width and optionally resolve a percent width against a
 * container pixel width.
 *
 * Returns null when the resolved pixel value falls below `minFloorPx` — the
 * caller should fall back to the responsive branch in that case.
 */
export function resolveFixedCardWidth(
  value: number,
  unit: CssWidthUnit,
  scale: number,
  containerWidth: number,
  minFloorPx: number,
): { value: number; unit: CssWidthUnit } | null {
  const scaledValue = scale !== 1 ? Math.round(value * scale) : value;

  if (unit === '%' && containerWidth > 0) {
    const resolved = Math.round((containerWidth * scaledValue) / 100);
    if (resolved < minFloorPx) return null;
    return { value: resolved, unit: 'px' };
  }

  if (unit === 'px' && scaledValue < minFloorPx) return null;

  return { value: scaledValue, unit };
}

/**
 * Generate fixed-row maxWidth CSS from a per-item width, column count, and a
 * pre-formatted gap CSS string.
 *
 * Output: `calc(<cols * itemWidth> + <cols - 1> * <gapCss>)`
 *
 * Returns the bare item-width string when cols ≤ 1 (no gap term needed).
 */
export function gridRowMaxWidthCss(
  itemWidth: number,
  itemWidthUnit: CssWidthUnit,
  cols: number,
  gapCss: string,
): string {
  if (cols <= 0) return '100%';
  if (cols === 1) return toCss(itemWidth, itemWidthUnit);
  return `calc(${toCss(itemWidth * cols, itemWidthUnit)} + ${cols - 1} * ${gapCss})`;
}

/**
 * P35: Resolve the effective column count for listing-mode adapters
 * (CompactGrid, Masonry, Justified) from card settings + container width.
 *
 * Priority chain (highest → lowest):
 *   1. `gridCardMaxColumns` — explicit listing-adapter cap (P35).
 *   2. `cardGridColumns`    — legacy card-gallery column knob (forward-compat).
 *   3. Auto from `resolveColumnsFromWidth` + optional `cardMaxColumns` cap.
 *   4. 1 column when containerWidth is unknown (SSR / test with no dimensions).
 */
export function resolveListingColumns(
  settings: GalleryBehaviorSettings,
  containerWidth: number,
): number {
  const gridMax = settings.gridCardMaxColumns ?? 0;
  const cardCols = settings.cardGridColumns ?? 0;
  const explicitCols = gridMax > 0 ? gridMax : cardCols;

  if (explicitCols > 0) return explicitCols;

  const maxCols = settings.cardMaxColumns ?? 0;
  const auto = containerWidth > 0
    ? resolveColumnsFromWidth(containerWidth, 0, settings.cardAutoColumnsBreakpoints)
    : 1;
  return maxCols > 0 ? Math.min(auto, maxCols) : auto;
}

/**
 * Format a gap value as a CSS string, applying an optional minimum pixel
 * floor for percentage gaps.
 *
 * When `unit` is `'%'`, `containerWidth > 0`, and the resolved pixel value is
 * below `minPx`, returns `"<minPx>px"` instead.
 */
export function formatGapCss(
  value: number,
  unit: CssWidthUnit,
  containerWidth: number,
  minPx: number,
): string {
  if (unit === '%' && containerWidth > 0 && (containerWidth * value) / 100 < minPx) {
    return `${minPx}px`;
  }
  return toCss(value, unit);
}
