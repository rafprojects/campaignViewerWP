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
 * Priority chain:
 *   1. `cardGridColumns > 0` — explicit fixed count, returned as-is.
 *   2. Auto from `resolveColumnsFromWidth` (falls back to 1 when containerWidth is unknown).
 *   3. Capped by `gridCardMaxColumns` (P35 listing-adapter cap, "Max Columns").
 *   4. Capped by `cardMaxColumns` (legacy cap).
 */
export function resolveListingColumns(
  settings: GalleryBehaviorSettings,
  containerWidth: number,
): number {
  const cardCols = settings.cardGridColumns ?? 0;
  if (cardCols > 0) return cardCols;

  const auto = containerWidth > 0
    ? resolveColumnsFromWidth(containerWidth, 0, settings.cardAutoColumnsBreakpoints)
    : 1;

  const gridMax = settings.gridCardMaxColumns ?? 0;
  const legacyMax = settings.cardMaxColumns ?? 0;

  let cols = auto;
  if (gridMax > 0) cols = Math.min(cols, gridMax);
  if (legacyMax > 0) cols = Math.min(cols, legacyMax);
  return cols;
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
