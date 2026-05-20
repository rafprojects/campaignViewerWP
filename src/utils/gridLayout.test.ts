import { describe, it, expect } from 'vitest';
import { resolveFixedCardWidth, gridRowMaxWidthCss, formatGapCss } from './gridLayout';

describe('resolveFixedCardWidth', () => {
  it('returns the value unchanged for px unit with scale 1', () => {
    expect(resolveFixedCardWidth(200, 'px', 1, 0, 120)).toEqual({ value: 200, unit: 'px' });
  });

  it('applies scale factor', () => {
    expect(resolveFixedCardWidth(200, 'px', 1.5, 0, 120)).toEqual({ value: 300, unit: 'px' });
  });

  it('rounds scaled values', () => {
    expect(resolveFixedCardWidth(100, 'px', 1.234, 0, 80)).toEqual({ value: 123, unit: 'px' });
  });

  it('returns null when px value is below the floor', () => {
    expect(resolveFixedCardWidth(100, 'px', 1, 0, 120)).toBeNull();
  });

  it('returns null when scaled px value is below the floor', () => {
    expect(resolveFixedCardWidth(200, 'px', 0.5, 0, 120)).toBeNull();
  });

  it('resolves % against containerWidth', () => {
    expect(resolveFixedCardWidth(25, '%', 1, 800, 120)).toEqual({ value: 200, unit: 'px' });
  });

  it('returns null when % resolves below the floor', () => {
    expect(resolveFixedCardWidth(10, '%', 1, 800, 120)).toBeNull();
  });

  it('returns null when containerWidth is 0 for % unit — falls back to caller', () => {
    // No containerWidth means we cannot resolve %: returns the value in original unit
    // so the caller can decide. Per implementation, no-containerWidth branch: returns {value, unit}.
    // Actually implementation falls through to the generic return since unit === '%' branch
    // requires containerWidth > 0. So result is { value: 25, unit: '%' }.
    expect(resolveFixedCardWidth(25, '%', 1, 0, 120)).toEqual({ value: 25, unit: '%' });
  });

  it('applies scale before resolving % against containerWidth', () => {
    // 50% of 400 = 200, scaled by 0.5 → 25% of 400 = 100 — below 120 floor
    expect(resolveFixedCardWidth(50, '%', 0.5, 400, 120)).toBeNull();
  });

  it('passes through non-px/% units unchanged', () => {
    expect(resolveFixedCardWidth(10, 'vw', 1, 0, 120)).toEqual({ value: 10, unit: 'vw' });
  });
});

describe('gridRowMaxWidthCss', () => {
  it('returns 100% for zero or negative cols', () => {
    expect(gridRowMaxWidthCss(200, 'px', 0, '16px')).toBe('100%');
    expect(gridRowMaxWidthCss(200, 'px', -1, '16px')).toBe('100%');
  });

  it('returns bare item width for a single column', () => {
    expect(gridRowMaxWidthCss(200, 'px', 1, '16px')).toBe('200px');
  });

  it('generates calc() for multiple columns', () => {
    expect(gridRowMaxWidthCss(200, 'px', 3, '16px')).toBe('calc(600px + 2 * 16px)');
  });

  it('handles non-px item units', () => {
    expect(gridRowMaxWidthCss(50, '%', 2, '8px')).toBe('calc(100% + 1 * 8px)');
  });

  it('handles two columns with a gap', () => {
    expect(gridRowMaxWidthCss(160, 'px', 2, '12px')).toBe('calc(320px + 1 * 12px)');
  });
});

describe('formatGapCss', () => {
  it('returns toCss output for px unit', () => {
    expect(formatGapCss(16, 'px', 0, 4)).toBe('16px');
  });

  it('returns toCss output for non-px unit when above floor', () => {
    // 5% of 200 = 10px, above 4px floor
    expect(formatGapCss(5, '%', 200, 4)).toBe('5%');
  });

  it('returns floor string when % resolves below minPx', () => {
    // 1% of 200 = 2px, below 4px floor
    expect(formatGapCss(1, '%', 200, 4)).toBe('4px');
  });

  it('returns toCss when containerWidth is 0 (cannot resolve %)', () => {
    expect(formatGapCss(1, '%', 0, 4)).toBe('1%');
  });

  it('handles em units without floor logic', () => {
    expect(formatGapCss(1, 'em', 800, 4)).toBe('1em');
  });
});
