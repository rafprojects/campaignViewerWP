/**
 * P30-B — Canvas measurement utilities: snap modes, grid snapping,
 * edge-distance computation, and inter-slot spacing.
 *
 * All position/dimension values use canvas-percentage space (0–100)
 * unless otherwise noted.
 */

// ── Snap mode ────────────────────────────────────────────────────────────────

/**
 * Snap mode for the builder canvas.
 *
 * - `off`:         No snap targets.
 * - `guides`:      Snap only to smart-guide targets (slot edges, canvas centre,
 *                  equal-spacing gaps).
 * - `grid`:        Snap only to grid intersections.
 * - `grid+guides`: Choose the closest valid target within threshold. On ties,
 *                  guides win so explicit alignment beats background rhythm.
 */
export type SnapMode = 'off' | 'guides' | 'grid' | 'grid+guides';

export const SNAP_MODE_LABELS: Record<SnapMode, string> = {
  off: 'Off',
  guides: 'Guides',
  grid: 'Grid',
  'grid+guides': 'Both',
};

// ── Grid helpers ─────────────────────────────────────────────────────────────

/**
 * Rounds a canvas-percentage value to the nearest grid line.
 *
 * @param valuePct   Position in canvas-percentage space (0–100).
 * @param gridPct    Grid cell size as a percentage of the canvas dimension.
 * @returns          Snapped position in canvas-percentage space.
 */
export function snapToGrid(valuePct: number, gridPct: number): number {
  if (gridPct <= 0) return valuePct;
  return Math.round(valuePct / gridPct) * gridPct;
}

/**
 * Converts a grid cell size in canvas pixels to a canvas-percentage value.
 * Use this to get the `gridPct` argument for `snapToGrid`.
 */
export function gridSizeToPct(gridSizePx: number, canvasDimPx: number): number {
  if (canvasDimPx <= 0) return 0;
  return (gridSizePx / canvasDimPx) * 100;
}

// ── Ruler tick helpers ────────────────────────────────────────────────────────

/**
 * Computes nice tick intervals for a canvas ruler given the current zoom scale.
 *
 * Returns canvas-pixel intervals for:
 * - `major`: labelled ticks (always shown).
 * - `minor`: unlabelled mid-ticks (shown at medium zoom).
 *
 * The goal is to keep major ticks ≥80 screen-pixels apart so labels don't collide.
 *
 * @param scale  Current zoom scale from react-zoom-pan-pinch (1 = 100%).
 */
export function rulerTickIntervals(scale: number): { major: number; minor: number } {
  // Candidate intervals in canvas pixels
  const candidates = [500, 250, 200, 100, 50, 25, 20, 10, 5];
  const targetScreenSpacing = 80; // minimum screen pixels between major ticks
  let major = 100;
  for (const c of candidates) {
    if (c * scale >= targetScreenSpacing) {
      major = c;
    } else {
      break;
    }
  }
  return { major, minor: major / 5 };
}

// ── Measurement helpers ───────────────────────────────────────────────────────

/**
 * Rectangle in canvas-percentage space.
 */
export interface PctRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Distances from each edge of a rectangle to the corresponding canvas edge,
 * expressed as canvas percentages (so they sum to 100% along each axis).
 */
export interface EdgeDistances {
  /** % from canvas left  to the rect's left  edge (= rect.x).               */
  left: number;
  /** % from the rect's right edge to the canvas right  (= 100 - x - width). */
  right: number;
  /** % from canvas top   to the rect's top   edge (= rect.y).               */
  top: number;
  /** % from the rect's bottom edge to the canvas bottom (= 100 - y - height). */
  bottom: number;
}

/**
 * Computes the four edge distances from a selection rect to the canvas edges.
 */
export function computeEdgeDistances(rect: PctRect): EdgeDistances {
  return {
    left: rect.x,
    right: 100 - rect.x - rect.width,
    top: rect.y,
    bottom: 100 - rect.y - rect.height,
  };
}

/**
 * Builds the union bounding box of all selected slots in canvas-percentage space.
 * Returns null when no slots are in the set.
 */
export function selectionUnionRect(
  slotIds: Set<string>,
  slots: ReadonlyArray<{ id: string; x: number; y: number; width: number; height: number }>,
): PctRect | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const slot of slots) {
    if (!slotIds.has(slot.id)) continue;
    minX = Math.min(minX, slot.x);
    minY = Math.min(minY, slot.y);
    maxX = Math.max(maxX, slot.x + slot.width);
    maxY = Math.max(maxY, slot.y + slot.height);
  }
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Formats a canvas-percentage value as a short label showing both pixel and
 * percentage values. Example: `"120px · 10.0%"`.
 */
export function formatMeasurement(pct: number, canvasPx: number): string {
  const px = Math.round((pct / 100) * canvasPx);
  return `${px}px · ${pct.toFixed(1)}%`;
}

/**
 * Formats a short px-only label (used when horizontal space is limited).
 */
export function formatPx(pct: number, canvasPx: number): string {
  return `${Math.round((pct / 100) * canvasPx)}px`;
}

// ── Auto-grid generator (P58-F) ───────────────────────────────────────────────

/**
 * Generates evenly-spaced grid cells in canvas-percentage space.
 *
 * Solves `2*margin + cols*cellW + (cols-1)*gap = 100` for `cellW` (and the row
 * equivalent for `cellH`), then lays cells out left-to-right, top-to-bottom.
 * The first cell's left edge sits at `margin` and the last cell's right edge at
 * `100 - margin`. Returns an empty array for invalid counts (`rows`/`cols < 1`)
 * or when gap + margin over-constrain the canvas so a cell would be non-positive.
 *
 * @param rows       Number of rows (≥ 1; floored).
 * @param cols       Number of columns (≥ 1; floored).
 * @param gapPct     Gap between cells, as a canvas percentage (≥ 0).
 * @param marginPct  Outer margin around the whole grid, as a canvas percentage (≥ 0).
 */
export function computeGridSlots(
  rows: number,
  cols: number,
  gapPct: number,
  marginPct: number,
): PctRect[] {
  const R = Math.floor(rows);
  const C = Math.floor(cols);
  if (!Number.isFinite(R) || !Number.isFinite(C) || R < 1 || C < 1) return [];
  const m = Math.max(0, marginPct);
  const g = Math.max(0, gapPct);
  const cellW = (100 - 2 * m - g * (C - 1)) / C;
  const cellH = (100 - 2 * m - g * (R - 1)) / R;
  if (cellW <= 0 || cellH <= 0) return [];
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const out: PctRect[] = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      out.push({
        x: round2(m + c * (cellW + g)),
        y: round2(m + r * (cellH + g)),
        width: round2(cellW),
        height: round2(cellH),
      });
    }
  }
  return out;
}

// ── Marquee selection (P58-D) ──────────────────────────────────────────────────

/**
 * Normalizes a drag defined by two corners (dragged in any direction) into a
 * positive-size rectangle in canvas-percentage space, clamped to the 0–100 bounds.
 */
export function normalizeDragRect(x0: number, y0: number, x1: number, y1: number): PctRect {
  const left = Math.max(0, Math.min(100, Math.min(x0, x1)));
  const top = Math.max(0, Math.min(100, Math.min(y0, y1)));
  const right = Math.max(0, Math.min(100, Math.max(x0, x1)));
  const bottom = Math.max(0, Math.min(100, Math.max(y0, y1)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Axis-aligned overlap test for two percentage-space rectangles. Edge-touching
 * (zero-area overlap) counts as NO intersection.
 */
export function pctRectsIntersect(a: PctRect, b: PctRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
