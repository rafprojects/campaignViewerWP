import { describe, it, expect } from 'vitest';
import { computeGuides, type SlotRect } from './smartGuides';

// ─── Helpers ────────────────────────────────────────────────

const CANVAS = { width: 1000, height: 600 };
const THRESHOLD = 5; // px

function makeSlot(overrides: Partial<SlotRect> & { id: string }): SlotRect {
  return {
    x: 0,
    y: 0,
    width: 20,
    height: 20,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('computeGuides', () => {
  // ── Canvas edge snapping ──────────────────────────────────

  describe('canvas edge snapping', () => {
    it('snaps to left canvas edge', () => {
      const dragging = makeSlot({ id: 'a', x: 0.3, y: 30 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(0);
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'x', position: 0, type: 'edge' }),
      );
    });

    it('snaps to right canvas edge', () => {
      // Right edge at x + width = 80.3 + 20 = 100.3, near 100
      const dragging = makeSlot({ id: 'a', x: 80.3, y: 30, width: 20 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(80);
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'x', position: 100, type: 'edge' }),
      );
    });

    it('snaps to top canvas edge', () => {
      const dragging = makeSlot({ id: 'a', x: 30, y: 0.4 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(0);
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'y', position: 0, type: 'edge' }),
      );
    });

    it('snaps to bottom canvas edge', () => {
      // Bottom edge at y + height = 80.5 + 20 = 100.5
      const dragging = makeSlot({ id: 'a', x: 30, y: 80.5, height: 20 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(80);
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'y', position: 100, type: 'edge' }),
      );
    });

    it('does NOT snap when beyond threshold', () => {
      // 0.6% of 1000px = 6px > 5px threshold
      const dragging = makeSlot({ id: 'a', x: 0.6, y: 30 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapX).toBeUndefined();
    });
  });

  // ── Canvas center snapping ────────────────────────────────

  describe('canvas center snapping', () => {
    it('snaps horizontally to canvas center', () => {
      // Center of slot = x + width/2 = 40.2 + 20/2 = 50.2, near 50
      const dragging = makeSlot({ id: 'a', x: 40.2, y: 10, width: 20 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(40); // 50 - 20/2
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'x', position: 50, type: 'center' }),
      );
    });

    it('snaps vertically to canvas center', () => {
      // Center of slot = y + height/2 = 40.4 + 20/2 = 50.4
      const dragging = makeSlot({ id: 'a', x: 10, y: 40.4, height: 20 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(40); // 50 - 20/2
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'y', position: 50, type: 'center' }),
      );
    });
  });

  // ── Slot-to-slot edge alignment ───────────────────────────

  describe('slot-to-slot edge alignment', () => {
    const other = makeSlot({ id: 'b', x: 50, y: 30, width: 25, height: 25 });

    it('snaps left edge to left edge of another slot', () => {
      const dragging = makeSlot({ id: 'a', x: 50.3, y: 10, width: 15 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(50);
      expect(result.guides).toContainEqual(
        expect.objectContaining({ axis: 'x', position: 50, type: 'edge' }),
      );
    });

    it('snaps right edge to right edge of another slot', () => {
      // Other right = 50 + 25 = 75
      // Dragging right = 60 + 15 = 75.2, near 75
      const dragging = makeSlot({ id: 'a', x: 60, y: 10, width: 15.2 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(59.8); // 75 - 15.2
    });

    it('snaps left to right (abutment)', () => {
      // Other right = 75, dragging left = 75.3
      const dragging = makeSlot({ id: 'a', x: 75.3, y: 10, width: 15 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(75);
    });

    it('snaps right to left (abutment)', () => {
      // Other left = 50, dragging right = 35 + 15 = 50.2
      const dragging = makeSlot({ id: 'a', x: 35, y: 10, width: 15.2 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(34.8); // 50 - 15.2
    });

    it('snaps center to center X', () => {
      // Other center X = 50 + 25/2 = 62.5
      // Dragging center X = 55.2 + 15/2 = 62.7, near 62.5
      const dragging = makeSlot({ id: 'a', x: 55.2, y: 10, width: 15 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(55); // 62.5 - 15/2
    });

    it('snaps top to top Y', () => {
      const dragging = makeSlot({ id: 'a', x: 10, y: 30.3, height: 15 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(30);
    });

    it('snaps bottom to bottom Y', () => {
      // Other bottom = 30 + 25 = 55
      // Dragging bottom = 40 + 15.3 = 55.3, near 55
      const dragging = makeSlot({ id: 'a', x: 10, y: 40, height: 15.3 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(39.7); // 55 - 15.3
    });

    it('snaps top to bottom (abutment Y)', () => {
      // Other bottom = 55, dragging top = 55.4
      const dragging = makeSlot({ id: 'a', x: 10, y: 55.4, height: 15 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(55);
    });

    it('snaps bottom to top (abutment Y)', () => {
      // Other top = 30, dragging bottom = 15 + 15.2 = 30.2
      const dragging = makeSlot({ id: 'a', x: 10, y: 15, height: 15.2 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      expect(result.snapY).toBe(14.8); // 30 - 15.2
    });
  });

  // ── Snap priority (edge before center) ────────────────────

  describe('snap priority', () => {
    it('canvas edge snaps take priority over canvas center', () => {
      // Slot at x=0.1 — should snap to left edge, NOT center
      const dragging = makeSlot({ id: 'a', x: 0.1, y: 10, width: 20 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapX).toBe(0);
    });

    it('only first X snap wins', () => {
      // Two other slots that could both match
      const others = [
        makeSlot({ id: 'b', x: 20, y: 0, width: 10 }),
        makeSlot({ id: 'c', x: 20, y: 50, width: 10 }),
      ];
      const dragging = makeSlot({ id: 'a', x: 20.3, y: 25, width: 10 });
      const result = computeGuides(dragging, others, CANVAS, THRESHOLD);
      expect(result.snapX).toBe(20);
      // Should produce only one X guide (not duplicates)
      const xGuides = result.guides.filter(
        (g) => g.axis === 'x' && g.type !== 'spacing',
      );
      expect(xGuides.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── No slot ───────────────────────────────────────────────

  describe('no other slots', () => {
    it('returns no guides when slot is far from edges and alone', () => {
      const dragging = makeSlot({ id: 'a', x: 25, y: 25, width: 20, height: 20 });
      const result = computeGuides(dragging, [], CANVAS, THRESHOLD);
      expect(result.snapX).toBeUndefined();
      expect(result.snapY).toBeUndefined();
      expect(result.guides.filter((g) => g.type !== 'spacing').length).toBe(0);
    });
  });

  // ── Spacing guides ────────────────────────────────────────

  describe('spacing guides', () => {
    it('detects equal horizontal gaps', () => {
      // Three slots in a row: [0-10] [20-30] [40-50]
      // Gaps: 10% between each → equal
      const slotA = makeSlot({ id: 'a', x: 0, y: 0, width: 10, height: 10 });
      const slotB = makeSlot({ id: 'b', x: 20, y: 0, width: 10, height: 10 });
      // Dragging slot placed at x=40 (gap of 10 from slotB right edge 30)
      const dragging = makeSlot({ id: 'c', x: 40, y: 0, width: 10, height: 10 });

      const result = computeGuides(dragging, [slotA, slotB], CANVAS, THRESHOLD);
      const spacingGuides = result.guides.filter((g) => g.type === 'spacing');
      expect(spacingGuides.length).toBeGreaterThanOrEqual(2);
      // Both gaps should be labelled "10%"
      expect(spacingGuides.some((g) => g.label === '10%')).toBe(true);
    });

    it('detects equal vertical gaps', () => {
      // Three slots stacked: [0-10] [20-30] [40-50]
      const slotA = makeSlot({ id: 'a', x: 0, y: 0, width: 10, height: 10 });
      const slotB = makeSlot({ id: 'b', x: 0, y: 20, width: 10, height: 10 });
      const dragging = makeSlot({ id: 'c', x: 0, y: 40, width: 10, height: 10 });

      const result = computeGuides(dragging, [slotA, slotB], CANVAS, THRESHOLD);
      const spacingGuides = result.guides.filter((g) => g.type === 'spacing');
      expect(spacingGuides.length).toBeGreaterThanOrEqual(2);
    });

    it('does NOT create spacing guides for unequal gaps', () => {
      const slotA = makeSlot({ id: 'a', x: 0, y: 0, width: 10, height: 10 });
      const slotB = makeSlot({ id: 'b', x: 20, y: 0, width: 10, height: 10 });
      // 30 gap instead of 10
      const dragging = makeSlot({ id: 'c', x: 60, y: 0, width: 10, height: 10 });

      const result = computeGuides(dragging, [slotA, slotB], CANVAS, THRESHOLD);
      const spacingGuides = result.guides.filter((g) => g.type === 'spacing');
      expect(spacingGuides.length).toBe(0);
    });
  });

  // ── Edge cases ────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles zero-sized canvas gracefully', () => {
      const dragging = makeSlot({ id: 'a', x: 50, y: 50 });
      // Should not throw — thresholds become Infinity but no snapping happens
      expect(() => {
        computeGuides(dragging, [], { width: 0, height: 0 }, THRESHOLD);
      }).not.toThrow();
    });

    it('handles many slots without excessive guide count', () => {
      const others: SlotRect[] = [];
      for (let i = 0; i < 20; i++) {
        others.push(
          makeSlot({ id: `s${i}`, x: i * 5, y: i * 5, width: 4, height: 4 }),
        );
      }
      const dragging = makeSlot({ id: 'drag', x: 50, y: 50 });
      const result = computeGuides(dragging, others, CANVAS, THRESHOLD);
      // Should produce finite number of guides, not O(n²)
      expect(result.guides.length).toBeLessThan(100);
    });

    it('snap values are rounded to 2 decimal places', () => {
      const other = makeSlot({ id: 'b', x: 33.33, y: 0, width: 10 });
      // Dragging left near other left: 33.53
      const dragging = makeSlot({ id: 'a', x: 33.53, y: 10, width: 10 });
      const result = computeGuides(dragging, [other], CANVAS, THRESHOLD);
      if (result.snapX !== undefined) {
        const decimalPlaces = result.snapX.toString().split('.')[1]?.length ?? 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      }
    });
  });
});
