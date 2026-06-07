import { describe, it, expect } from 'vitest';
import { toCss, toCssOrUndefined, toCssOrNumber, UNIT_MAX_DEFAULTS } from './cssUnits';

describe('toCss', () => {
  it('joins value and unit', () => {
    expect(toCss(16, 'px')).toBe('16px');
    expect(toCss(50, '%')).toBe('50%');
    expect(toCss(2.5, 'em')).toBe('2.5em');
    expect(toCss(80, 'vh')).toBe('80vh');
    expect(toCss(100, 'dvh')).toBe('100dvh');
  });

  it('defaults to px when unit is omitted', () => {
    expect(toCss(10)).toBe('10px');
  });

  it('handles zero', () => {
    expect(toCss(0, 'px')).toBe('0px');
    expect(toCss(0, '%')).toBe('0%');
  });

  it('handles negative values', () => {
    expect(toCss(-10, 'px')).toBe('-10px');
  });
});

describe('toCssOrUndefined', () => {
  it('returns CSS string for non-zero values', () => {
    expect(toCssOrUndefined(16, 'px')).toBe('16px');
    expect(toCssOrUndefined(50, '%', false)).toBe('50%');
  });

  it('returns CSS string for zero when zeroDisabled is false', () => {
    expect(toCssOrUndefined(0, 'px', false)).toBe('0px');
    expect(toCssOrUndefined(0, 'px')).toBe('0px');
  });

  it('returns undefined for zero when zeroDisabled is true', () => {
    expect(toCssOrUndefined(0, 'px', true)).toBeUndefined();
    expect(toCssOrUndefined(0, '%', true)).toBeUndefined();
  });

  it('returns CSS string for non-zero even when zeroDisabled is true', () => {
    expect(toCssOrUndefined(10, 'px', true)).toBe('10px');
  });
});

describe('toCssOrNumber', () => {
  it('returns raw number for px unit', () => {
    expect(toCssOrNumber(16, 'px')).toBe(16);
    expect(toCssOrNumber(0, 'px')).toBe(0);
  });

  it('returns CSS string for non-px units', () => {
    expect(toCssOrNumber(50, '%')).toBe('50%');
    expect(toCssOrNumber(80, 'vh')).toBe('80vh');
    expect(toCssOrNumber(2, 'em')).toBe('2em');
    expect(toCssOrNumber(1.5, 'rem')).toBe('1.5rem');
    expect(toCssOrNumber(100, 'dvh')).toBe('100dvh');
  });

  it('defaults to px (returns number) when unit omitted', () => {
    expect(toCssOrNumber(16)).toBe(16);
  });
});

describe('UNIT_MAX_DEFAULTS', () => {
  it('has sensible px max', () => {
    expect(UNIT_MAX_DEFAULTS.px).toBe(5000);
  });

  it('has 100 for percentage-based units', () => {
    expect(UNIT_MAX_DEFAULTS['%']).toBe(100);
    expect(UNIT_MAX_DEFAULTS.vw).toBe(100);
    expect(UNIT_MAX_DEFAULTS.vh).toBe(100);
    expect(UNIT_MAX_DEFAULTS.dvh).toBe(100);
    expect(UNIT_MAX_DEFAULTS.svh).toBe(100);
    expect(UNIT_MAX_DEFAULTS.lvh).toBe(100);
    expect(UNIT_MAX_DEFAULTS.em).toBe(100);
    expect(UNIT_MAX_DEFAULTS.rem).toBe(100);
  });
});
