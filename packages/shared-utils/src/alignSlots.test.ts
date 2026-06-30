import { describe, it, expect } from 'vitest';
import { fitRectsIntoBand } from './alignSlots';
import type { SlotRect } from './smartGuides';

function slot(id: string, x: number, y: number, width: number, height: number): SlotRect {
  return { id, x, y, width, height };
}

describe('fitRectsIntoBand (P58-B)', () => {
  // Band: centered 40%-wide region → 30%..70%.
  const BAND_LEFT = 30;
  const BAND_WIDTH = 40;

  it('returns no changes when the selection already fits inside the band', () => {
    const slots = [slot('a', 35, 40, 20, 20), slot('b', 45, 10, 10, 10)];
    expect(fitRectsIntoBand(slots, BAND_LEFT, BAND_WIDTH)).toEqual({});
  });

  it('returns {} for empty input', () => {
    expect(fitRectsIntoBand([], BAND_LEFT, BAND_WIDTH)).toEqual({});
  });

  it('translates + uniformly scales an overflowing selection into the band', () => {
    // Union bbox spans x 0..100 (width 100), y 0..40 (height 40).
    const slots = [slot('a', 0, 0, 20, 20), slot('b', 80, 20, 20, 20)];
    const out = fitRectsIntoBand(slots, BAND_LEFT, BAND_WIDTH);

    // scale = min(40/100, 100/40, 1) = 0.4
    expect(out.a).toEqual({ x: 30, y: 42, width: 8, height: 8 });
    // b: x = 30 + 80*0.4 = 62, y = 42 + 20*0.4 = 50
    expect(out.b).toEqual({ x: 62, y: 50, width: 8, height: 8 });

    // Result stays within the band horizontally and the canvas vertically.
    const maxRight = Math.max(out.a!.x! + out.a!.width!, out.b!.x! + out.b!.width!);
    expect(out.a!.x!).toBeGreaterThanOrEqual(BAND_LEFT - 0.001);
    expect(maxRight).toBeLessThanOrEqual(BAND_LEFT + BAND_WIDTH + 0.001);
  });

  it('scales and centers a single slot wider than the band', () => {
    const out = fitRectsIntoBand([slot('a', 0, 40, 100, 20)], BAND_LEFT, BAND_WIDTH);
    // scale = min(40/100, 100/20, 1) = 0.4 → width 40, centered in band (30..70)
    expect(out.a).toEqual({ x: 30, y: 46, width: 40, height: 8 });
  });

  it('preserves the relative arrangement of the selection', () => {
    const slots = [slot('a', 0, 0, 10, 10), slot('b', 90, 0, 10, 10)];
    const out = fitRectsIntoBand(slots, BAND_LEFT, BAND_WIDTH);
    // a stays left of b after fitting
    expect(out.a!.x!).toBeLessThan(out.b!.x!);
  });
});
