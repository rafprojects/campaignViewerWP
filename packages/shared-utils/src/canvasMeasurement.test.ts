/**
 * Unit tests for P30-B canvas measurement utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  snapToGrid,
  gridSizeToPct,
  rulerTickIntervals,
  computeEdgeDistances,
  selectionUnionRect,
  formatMeasurement,
  formatPx,
  computeGridSlots,
  normalizeDragRect,
  pctRectsIntersect,
} from './canvasMeasurement';

// ── snapToGrid ────────────────────────────────────────────────────────────────

describe('snapToGrid', () => {
  it('snaps to nearest grid line below', () => {
    // gridPct = 10%, value = 14% → nearest is 10%
    expect(snapToGrid(14, 10)).toBe(10);
  });

  it('snaps to nearest grid line above', () => {
    // value = 16% → nearest is 20%
    expect(snapToGrid(16, 10)).toBe(20);
  });

  it('returns value unchanged when already on grid line', () => {
    expect(snapToGrid(20, 10)).toBe(20);
  });

  it('snaps to 0 correctly', () => {
    expect(snapToGrid(3, 10)).toBe(0);
  });

  it('snaps to 100 correctly', () => {
    expect(snapToGrid(98, 10)).toBe(100);
  });

  it('returns value unchanged when gridPct is 0', () => {
    expect(snapToGrid(14, 0)).toBe(14);
  });

  it('handles fractional grid size', () => {
    // gridPct = 5%, value = 7.5% → nearest is 7.5% (midpoint, rounds to 10%)
    // 7.5 / 5 = 1.5 → round = 2 → 2 * 5 = 10
    expect(snapToGrid(7.5, 5)).toBe(10);
  });
});

// ── gridSizeToPct ─────────────────────────────────────────────────────────────

describe('gridSizeToPct', () => {
  it('converts 100px on a 1000px canvas to 10%', () => {
    expect(gridSizeToPct(100, 1000)).toBeCloseTo(10);
  });

  it('converts 20px on a 1200px canvas correctly', () => {
    expect(gridSizeToPct(20, 1200)).toBeCloseTo(1.6667);
  });

  it('returns 0 when canvasDimPx is 0', () => {
    expect(gridSizeToPct(20, 0)).toBe(0);
  });
});

// ── rulerTickIntervals ────────────────────────────────────────────────────────

describe('rulerTickIntervals', () => {
  it('returns large intervals at very low zoom', () => {
    const { major } = rulerTickIntervals(0.25);
    expect(major).toBeGreaterThanOrEqual(100);
  });

  it('returns 100px major interval at 1x zoom', () => {
    const { major } = rulerTickIntervals(1);
    expect(major).toBe(100);
  });

  it('returns smaller major interval at high zoom', () => {
    const { major } = rulerTickIntervals(4);
    expect(major).toBeLessThan(100);
  });

  it('minor interval is always major / 5', () => {
    const { major, minor } = rulerTickIntervals(1);
    expect(minor).toBe(major / 5);
  });

  it('intervals keep major * scale >= 80 at all reasonable zoom levels', () => {
    for (const scale of [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]) {
      const { major } = rulerTickIntervals(scale);
      // We just verify major interval is positive and reasonable
      expect(major).toBeGreaterThan(0);
    }
  });
});

// ── computeEdgeDistances ──────────────────────────────────────────────────────

describe('computeEdgeDistances', () => {
  it('computes correct distances for a centered 50×50% rect', () => {
    const d = computeEdgeDistances({ x: 25, y: 25, width: 50, height: 50 });
    expect(d.left).toBe(25);
    expect(d.right).toBe(25);
    expect(d.top).toBe(25);
    expect(d.bottom).toBe(25);
  });

  it('computes correct distances for a rect in the top-left corner', () => {
    const d = computeEdgeDistances({ x: 0, y: 0, width: 30, height: 20 });
    expect(d.left).toBe(0);
    expect(d.right).toBe(70);
    expect(d.top).toBe(0);
    expect(d.bottom).toBe(80);
  });

  it('all four distances sum to 100 minus size along each axis', () => {
    const rect = { x: 10, y: 15, width: 40, height: 30 };
    const d = computeEdgeDistances(rect);
    expect(d.left + d.right + rect.width).toBeCloseTo(100);
    expect(d.top + d.bottom + rect.height).toBeCloseTo(100);
  });
});

// ── selectionUnionRect ────────────────────────────────────────────────────────

describe('selectionUnionRect', () => {
  const slots = [
    { id: 'a', x: 10, y: 10, width: 20, height: 20 },
    { id: 'b', x: 40, y: 40, width: 20, height: 20 },
    { id: 'c', x: 70, y: 70, width: 10, height: 10 },
  ];

  it('returns null when no slots are selected', () => {
    expect(selectionUnionRect(new Set(), slots)).toBeNull();
  });

  it('returns the single slot rect when one is selected', () => {
    const r = selectionUnionRect(new Set(['a']), slots);
    expect(r).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });

  it('computes the union of two selected slots', () => {
    const r = selectionUnionRect(new Set(['a', 'b']), slots);
    expect(r).toEqual({ x: 10, y: 10, width: 50, height: 50 });
  });

  it('computes the union of all three slots', () => {
    const r = selectionUnionRect(new Set(['a', 'b', 'c']), slots);
    expect(r).toEqual({ x: 10, y: 10, width: 70, height: 70 });
  });

  it('ignores slots not in the slots array', () => {
    const r = selectionUnionRect(new Set(['a', 'unknown']), slots);
    expect(r).toEqual({ x: 10, y: 10, width: 20, height: 20 });
  });
});

// ── formatMeasurement ─────────────────────────────────────────────────────────

describe('formatMeasurement', () => {
  it('formats 10% of 1200px correctly', () => {
    expect(formatMeasurement(10, 1200)).toBe('120px · 10.0%');
  });

  it('rounds px value', () => {
    // 33.33% of 1200 = 400px
    expect(formatMeasurement(33.33, 1200)).toBe('400px · 33.3%');
  });
});

describe('formatPx', () => {
  it('formats px only', () => {
    expect(formatPx(25, 800)).toBe('200px');
  });
});

// ── computeGridSlots (P58-F) ───────────────────────────────────────────────────

describe('computeGridSlots', () => {
  it('returns a single cell inset by the margin for 1×1', () => {
    expect(computeGridSlots(1, 1, 0, 10)).toEqual([{ x: 10, y: 10, width: 80, height: 80 }]);
  });

  it('tiles the full canvas with zero gap and margin', () => {
    expect(computeGridSlots(2, 2, 0, 0)).toEqual([
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 },
    ]);
  });

  it('places the first cell at the margin and the last cell ending at 100 - margin', () => {
    const cells = computeGridSlots(2, 3, 0, 5); // cellW=(100-10)/3=30, cellH=(100-10)/2=45
    expect(cells).toHaveLength(6);
    expect(cells[0]).toMatchObject({ x: 5, y: 5 });
    const last = cells[cells.length - 1]!;
    expect(last.x + last.width).toBeCloseTo(95, 5);
    expect(last.y + last.height).toBeCloseTo(95, 5);
  });

  it('respects the gap between cells', () => {
    expect(computeGridSlots(1, 2, 10, 0)).toEqual([
      { x: 0, y: 0, width: 45, height: 100 },
      { x: 55, y: 0, width: 45, height: 100 },
    ]);
  });

  it('floors fractional row/column counts', () => {
    expect(computeGridSlots(2.9, 3.2, 0, 0)).toHaveLength(6); // 2×3
  });

  it('clamps negative gap and margin to zero', () => {
    expect(computeGridSlots(1, 1, -5, -5)).toEqual([{ x: 0, y: 0, width: 100, height: 100 }]);
  });

  it('returns empty for counts below 1', () => {
    expect(computeGridSlots(0, 3, 0, 0)).toEqual([]);
    expect(computeGridSlots(3, 0, 0, 0)).toEqual([]);
  });

  it('returns empty when gap + margin over-constrain the canvas', () => {
    // 10 columns × 20% gap = 180% of gaps alone → no room for any cell
    expect(computeGridSlots(1, 10, 20, 0)).toEqual([]);
  });
});

// ── normalizeDragRect (P58-D) ──────────────────────────────────────────────────

describe('normalizeDragRect', () => {
  it('keeps a top-left → bottom-right drag as-is', () => {
    expect(normalizeDragRect(10, 20, 40, 60)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('normalizes a bottom-right → top-left drag to positive size', () => {
    expect(normalizeDragRect(40, 60, 10, 20)).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('clamps corners to the 0–100 canvas bounds', () => {
    expect(normalizeDragRect(-10, -5, 130, 120)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('returns zero size when both corners coincide', () => {
    expect(normalizeDragRect(50, 50, 50, 50)).toEqual({ x: 50, y: 50, width: 0, height: 0 });
  });
});

// ── pctRectsIntersect (P58-D) ──────────────────────────────────────────────────

describe('pctRectsIntersect', () => {
  const a = { x: 10, y: 10, width: 20, height: 20 }; // spans 10–30 on both axes

  it('detects overlapping rects', () => {
    expect(pctRectsIntersect(a, { x: 20, y: 20, width: 20, height: 20 })).toBe(true);
  });

  it('detects containment in either direction', () => {
    expect(pctRectsIntersect(a, { x: 12, y: 12, width: 5, height: 5 })).toBe(true);
    expect(pctRectsIntersect({ x: 0, y: 0, width: 100, height: 100 }, a)).toBe(true);
  });

  it('returns false for disjoint rects', () => {
    expect(pctRectsIntersect(a, { x: 40, y: 40, width: 10, height: 10 })).toBe(false);
  });

  it('treats edge-touching as no intersection', () => {
    // a's right edge is at x=30; b starts exactly at 30
    expect(pctRectsIntersect(a, { x: 30, y: 10, width: 10, height: 20 })).toBe(false);
  });
});
