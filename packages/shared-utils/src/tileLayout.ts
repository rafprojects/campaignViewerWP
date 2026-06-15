/**
 * P51-E: Shared tile-grid layout geometry for reflowing tile adapters
 * (Hexagonal, Diamond — any "fixed-size tiles, offset rows" honeycomb/lattice).
 *
 * Why this exists: the hexagonal and diamond adapters previously computed their
 * tiles-per-row by comparing a pixel container width against the raw numeric
 * tile-size value, ignoring its unit. For any non-`px` unit (`%`, `vw`, `em`,
 * `rem`) the comparison was meaningless, so tiles never wrapped into rows and
 * overflowed off-screen, and the same raw value applied to `height` collapsed
 * the tiles (percentage heights resolve against an unset parent height).
 *
 * The fix is to resolve the tile size (and gap) to actual pixels *once* against
 * the measured container width, then drive width/height/row-splitting from that
 * single pixel value. Tiles stay square (correct aspect for the clip-path) and
 * reflow works for every supported width unit.
 *
 * These are pure functions with no React/WordPress coupling — a P51-A
 * abstraction-spike candidate for `shared-utils`.
 */
import type { CssWidthUnit } from './cssUnits';

/**
 * Resolve a `value + CSS width unit` pair to a concrete pixel length, measured
 * against the container width (for `%`) and the document for viewport/font
 * units.
 *
 * `em` is approximated with the root font size (same as `rem`); tile adapters
 * size against the container, not a local font context, so this is a safe
 * approximation and avoids reading per-element computed styles during layout.
 */
export function resolveLengthToPx(
  value: number,
  unit: CssWidthUnit | string,
  containerWidth: number,
): number {
  switch (unit) {
    case '%':
      return (value / 100) * containerWidth;
    case 'vw':
      return (value / 100) * (typeof window !== 'undefined' ? window.innerWidth : containerWidth);
    case 'em':
    case 'rem': {
      const base =
        typeof document !== 'undefined'
          ? parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
          : 16;
      return value * base;
    }
    case 'px':
    default:
      return value;
  }
}

export interface TileGridLayout<T> {
  /** Tile edge length resolved to pixels (square tiles). */
  tilePx: number;
  /** Gap between tiles resolved to pixels (horizontal). */
  gapPx: number;
  /** Number of tiles that fit in one row. */
  tilesPerRow: number;
  /** Items split into rows of `tilesPerRow`. */
  rows: T[][];
}

export interface ResolveTileGridOptions<T> {
  items: T[];
  /** Numeric tile size (already multiplied by any item scale). */
  tileValue: number;
  tileUnit: CssWidthUnit | string;
  /** Numeric horizontal gap. */
  gapValue: number;
  gapUnit: CssWidthUnit | string;
  /** Measured container width in pixels (0 before first measurement). */
  containerWidth: number;
  /** Minimum tiles per row so offset rows still read as a lattice. */
  minPerRow?: number;
  /** Tiles per row to assume before the container has been measured. */
  fallbackPerRow?: number;
}

/**
 * Resolve tile size + gap to pixels and split `items` into reflowed rows.
 *
 * Before the container is measured (`containerWidth <= 0`) or when the resolved
 * tile size is non-positive, `fallbackPerRow` is used so the grid still renders
 * something sensible on first paint.
 */
export function resolveTileGridLayout<T>({
  items,
  tileValue,
  tileUnit,
  gapValue,
  gapUnit,
  containerWidth,
  minPerRow = 2,
  fallbackPerRow = 4,
}: ResolveTileGridOptions<T>): TileGridLayout<T> {
  const tilePx = Math.round(resolveLengthToPx(tileValue, tileUnit, containerWidth));
  const gapPx = resolveLengthToPx(gapValue, gapUnit, containerWidth);

  const tilesPerRow =
    containerWidth > 0 && tilePx > 0
      ? Math.max(minPerRow, Math.floor((containerWidth + gapPx) / (tilePx + gapPx)))
      : fallbackPerRow;

  const perRow = Math.max(1, tilesPerRow);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) {
    rows.push(items.slice(i, i + perRow));
  }

  return { tilePx, gapPx, tilesPerRow, rows };
}
