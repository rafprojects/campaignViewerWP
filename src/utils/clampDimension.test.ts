import { describe, expect, it } from 'vitest';
import { clampDimension } from './clampDimension';

describe('clampDimension', () => {
  it('returns containerMax when value is 0 (auto)', () => {
    expect(clampDimension(0, 0, 1200, 800)).toBe(800);
  });

  it('returns containerMax when value is negative', () => {
    expect(clampDimension(-5, 0, 1200, 800)).toBe(800);
  });

  it('clamps value to min when below min', () => {
    expect(clampDimension(50, 100, 600, 1000)).toBe(100);
  });

  it('clamps value to max when above max', () => {
    expect(clampDimension(700, 100, 600, 1000)).toBe(600);
  });

  it('clamps to containerMax when value exceeds containerMax', () => {
    expect(clampDimension(900, 0, 1200, 800)).toBe(800);
  });

  it('returns value when within bounds', () => {
    expect(clampDimension(500, 100, 600, 1000)).toBe(500);
  });
});
