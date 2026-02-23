/**
 * Smart Guides — Figma-style alignment & spacing guides for the layout builder.
 *
 * Pure-function module: no React, no side-effects, fully unit-testable.
 * Called on every drag frame to compute guide lines and snap positions.
 */

// ── Types ────────────────────────────────────────────────────

export interface SlotRect {
  id: string;
  x: number;      // % from left edge
  y: number;      // % from top edge
  width: number;  // % of canvas width
  height: number; // % of canvas height
}

export interface GuideLine {
  /** Which canvas dimension this line spans. */
  axis: 'x' | 'y';
  /** Position along the perpendicular axis (% of canvas). */
  position: number;
  /** Visual style hint. */
  type: 'edge' | 'center' | 'spacing';
  /** Optional text label (e.g. "10.5%"). */
  label?: string;
}

export interface GuideResult {
  /** If set, snap the dragged slot's X to this value (%). */
  snapX?: number;
  /** If set, snap the dragged slot's Y to this value (%). */
  snapY?: number;
  /** Guide lines to render on the SVG overlay. */
  guides: GuideLine[];
}

// ── Snap helpers ─────────────────────────────────────────────

/** Returns match info if `a` is within `threshold` of `b`. */
function near(a: number, b: number, threshold: number): boolean {
  return Math.abs(a - b) <= threshold;
}

/** Round to 2 decimal places. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Core ─────────────────────────────────────────────────────

/**
 * Compute alignment guides and snap positions for a slot being dragged.
 *
 * @param dragging - The current (un-snapped) rect of the dragged slot.
 * @param otherSlots - All *other* slots (excluding the dragged one).
 * @param canvasDimensions - Pixel dimensions of the canvas (for px→% threshold).
 * @param snapThresholdPx - Snap detection distance in canvas pixels (default 5).
 * @returns Guide lines to render + optional snap coordinates.
 */
export function computeGuides(
  dragging: SlotRect,
  otherSlots: SlotRect[],
  canvasDimensions: { width: number; height: number },
  snapThresholdPx = 5,
): GuideResult {
  // Convert pixel threshold to % for each axis
  const thX = (snapThresholdPx / canvasDimensions.width) * 100;
  const thY = (snapThresholdPx / canvasDimensions.height) * 100;

  const guides: GuideLine[] = [];
  let snapX: number | undefined;
  let snapY: number | undefined;

  // Dragged slot edges & centers
  const dL = dragging.x;
  const dR = dragging.x + dragging.width;
  const dT = dragging.y;
  const dB = dragging.y + dragging.height;
  const dCX = dragging.x + dragging.width / 2;
  const dCY = dragging.y + dragging.height / 2;

  // ── Canvas-edge snapping (0 / 100) ─────────────────────────

  if (near(dL, 0, thX)) {
    snapX = 0;
    guides.push({ axis: 'x', position: 0, type: 'edge' });
  } else if (near(dR, 100, thX)) {
    snapX = r2(100 - dragging.width);
    guides.push({ axis: 'x', position: 100, type: 'edge' });
  }

  if (near(dT, 0, thY)) {
    snapY = 0;
    guides.push({ axis: 'y', position: 0, type: 'edge' });
  } else if (near(dB, 100, thY)) {
    snapY = r2(100 - dragging.height);
    guides.push({ axis: 'y', position: 100, type: 'edge' });
  }

  // ── Canvas-center snapping ─────────────────────────────────

  if (snapX === undefined && near(dCX, 50, thX)) {
    snapX = r2(50 - dragging.width / 2);
    guides.push({ axis: 'x', position: 50, type: 'center' });
  }
  if (snapY === undefined && near(dCY, 50, thY)) {
    snapY = r2(50 - dragging.height / 2);
    guides.push({ axis: 'y', position: 50, type: 'center' });
  }

  // ── Slot-to-slot snapping ──────────────────────────────────

  for (const other of otherSlots) {
    const oL = other.x;
    const oR = other.x + other.width;
    const oT = other.y;
    const oB = other.y + other.height;
    const oCX = other.x + other.width / 2;
    const oCY = other.y + other.height / 2;

    // ── X-axis alignment ──

    if (snapX === undefined) {
      // Left ↔ Left
      if (near(dL, oL, thX)) {
        snapX = r2(oL);
        guides.push({ axis: 'x', position: r2(oL), type: 'edge' });
      }
      // Right ↔ Right
      else if (near(dR, oR, thX)) {
        snapX = r2(oR - dragging.width);
        guides.push({ axis: 'x', position: r2(oR), type: 'edge' });
      }
      // Left ↔ Right (abutting)
      else if (near(dL, oR, thX)) {
        snapX = r2(oR);
        guides.push({ axis: 'x', position: r2(oR), type: 'edge' });
      }
      // Right ↔ Left (abutting)
      else if (near(dR, oL, thX)) {
        snapX = r2(oL - dragging.width);
        guides.push({ axis: 'x', position: r2(oL), type: 'edge' });
      }
      // Center ↔ Center X
      else if (near(dCX, oCX, thX)) {
        snapX = r2(oCX - dragging.width / 2);
        guides.push({ axis: 'x', position: r2(oCX), type: 'center' });
      }
    }

    // ── Y-axis alignment ──

    if (snapY === undefined) {
      // Top ↔ Top
      if (near(dT, oT, thY)) {
        snapY = r2(oT);
        guides.push({ axis: 'y', position: r2(oT), type: 'edge' });
      }
      // Bottom ↔ Bottom
      else if (near(dB, oB, thY)) {
        snapY = r2(oB - dragging.height);
        guides.push({ axis: 'y', position: r2(oB), type: 'edge' });
      }
      // Top ↔ Bottom
      else if (near(dT, oB, thY)) {
        snapY = r2(oB);
        guides.push({ axis: 'y', position: r2(oB), type: 'edge' });
      }
      // Bottom ↔ Top
      else if (near(dB, oT, thY)) {
        snapY = r2(oT - dragging.height);
        guides.push({ axis: 'y', position: r2(oT), type: 'edge' });
      }
      // Center ↔ Center Y
      else if (near(dCY, oCY, thY)) {
        snapY = r2(oCY - dragging.height / 2);
        guides.push({ axis: 'y', position: r2(oCY), type: 'center' });
      }
    }
  }

  // ── Spacing guides ─────────────────────────────────────────
  // Detect equal gaps between consecutive non-overlapping slots.

  computeSpacingGuides(dragging, otherSlots, thX, thY, guides);

  return { snapX, snapY, guides };
}

// ── Spacing guide computation ────────────────────────────────

interface Gap {
  /** Distance (%) between trailing edge of one slot and leading edge of next. */
  distance: number;
  /** Position of the gap's start edge (trailing edge of left/top slot). */
  startEdge: number;
  /** Position of the gap's end edge (leading edge of right/bottom slot). */
  endEdge: number;
}

/**
 * Find equal horizontal and vertical gaps among sorted slots, including
 * the dragged slot at its current position. Mutates the `guides` array.
 */
function computeSpacingGuides(
  dragging: SlotRect,
  others: SlotRect[],
  thX: number,
  thY: number,
  guides: GuideLine[],
): void {
  const all = [dragging, ...others];

  // ── Horizontal spacing ──
  const sortedX = [...all].sort((a, b) => a.x - b.x);
  const hGaps: Gap[] = [];
  for (let i = 0; i < sortedX.length - 1; i++) {
    const aRight = sortedX[i].x + sortedX[i].width;
    const bLeft = sortedX[i + 1].x;
    const gap = bLeft - aRight;
    if (gap > 0) {
      hGaps.push({ distance: gap, startEdge: aRight, endEdge: bLeft });
    }
  }
  markEqualGaps(hGaps, thX, 'y', guides);

  // ── Vertical spacing ──
  const sortedY = [...all].sort((a, b) => a.y - b.y);
  const vGaps: Gap[] = [];
  for (let i = 0; i < sortedY.length - 1; i++) {
    const aBottom = sortedY[i].y + sortedY[i].height;
    const bTop = sortedY[i + 1].y;
    const gap = bTop - aBottom;
    if (gap > 0) {
      vGaps.push({ distance: gap, startEdge: aBottom, endEdge: bTop });
    }
  }
  markEqualGaps(vGaps, thY, 'x', guides);
}

/** Push spacing guide lines for any pair of gaps with (approximately) equal distance. */
function markEqualGaps(
  gaps: Gap[],
  threshold: number,
  axis: 'x' | 'y',
  guides: GuideLine[],
): void {
  const matched = new Set<number>();
  for (let i = 0; i < gaps.length; i++) {
    for (let j = i + 1; j < gaps.length; j++) {
      if (near(gaps[i].distance, gaps[j].distance, threshold)) {
        matched.add(i);
        matched.add(j);
      }
    }
  }
  for (const idx of matched) {
    const gap = gaps[idx];
    const midpoint = r2((gap.startEdge + gap.endEdge) / 2);
    guides.push({
      axis,
      position: midpoint,
      type: 'spacing',
      label: `${r2(gap.distance)}%`,
    });
  }
}
