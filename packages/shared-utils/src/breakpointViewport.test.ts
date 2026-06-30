import { describe, it, expect } from 'vitest';
import { computeBreakpointBand } from './breakpointViewport';

describe('computeBreakpointBand (P58-B)', () => {
  // Design canvas: 1200 × 675 (16:9), matching the builder's clamped canvas width.
  const DESIGN_W = 1200;
  const DESIGN_H = 675;

  it('centers the mobile (390) band in the design canvas', () => {
    const g = computeBreakpointBand(DESIGN_W, DESIGN_H, 390, 390);
    expect(g.bandWidthPx).toBe(390);
    // (1200 - 390) / 2
    expect(g.bandLeftPx).toBe(405);
    // On a 390px device the band renders 1:1.
    expect(g.scale).toBe(1);
    expect(g.windowWidthPx).toBe(390);
    expect(g.windowHeightPx).toBe(675);
  });

  it('centers the tablet (768) band in the design canvas', () => {
    const g = computeBreakpointBand(DESIGN_W, DESIGN_H, 768, 768);
    expect(g.bandWidthPx).toBe(768);
    expect(g.bandLeftPx).toBe(216); // (1200 - 768) / 2
    expect(g.scale).toBe(1);
    expect(g.windowWidthPx).toBe(768);
  });

  it('scales the band to fill a wider container (scale-to-fill)', () => {
    // 390 mobile band shown on a 780px container → 2× scale.
    const g = computeBreakpointBand(DESIGN_W, DESIGN_H, 390, 780);
    expect(g.scale).toBe(2);
    expect(g.windowWidthPx).toBe(780); // == containerWidth
    expect(g.windowHeightPx).toBe(1350); // designHeight * scale
  });

  it('scales the band down for a narrower container', () => {
    // 390 mobile band on a 351px device → 0.9× scale.
    const g = computeBreakpointBand(DESIGN_W, DESIGN_H, 390, 351);
    expect(g.scale).toBeCloseTo(0.9, 5);
    expect(g.windowWidthPx).toBeCloseTo(351, 5);
    expect(g.windowHeightPx).toBeCloseTo(607.5, 5);
  });

  it('clamps the band to the design width when the breakpoint is wider', () => {
    // Narrow fixed template (designWidth 400) at the 768 tablet breakpoint.
    const g = computeBreakpointBand(400, 300, 768, 768);
    expect(g.bandWidthPx).toBe(400);
    expect(g.bandLeftPx).toBe(0);
    expect(g.scale).toBe(1.92); // 768 / 400
  });

  it('returns scale 1 for an unmeasured container (width <= 0)', () => {
    const g = computeBreakpointBand(DESIGN_W, DESIGN_H, 390, 0);
    expect(g.scale).toBe(1);
    expect(g.windowWidthPx).toBe(390);
    expect(g.windowHeightPx).toBe(675);
  });
});
