import { describe, expect, it } from 'vitest';
import { combineMaxWidthConstraints, resolveBreakpointValue } from './resolveBreakpointValue';

describe('resolveBreakpointValue', () => {
  it('returns the desktop value on desktop', () => {
    expect(
      resolveBreakpointValue('desktop', {
        desktop: 'desktop-value',
        tablet: 'tablet-value',
        mobile: 'mobile-value',
      }),
    ).toBe('desktop-value');
  });

  it('falls back from tablet to desktop when no tablet override exists', () => {
    expect(
      resolveBreakpointValue('tablet', {
        desktop: 'desktop-value',
      }),
    ).toBe('desktop-value');
  });

  it('falls back from mobile to tablet before desktop', () => {
    expect(
      resolveBreakpointValue('mobile', {
        desktop: 'desktop-value',
        tablet: 'tablet-value',
      }),
    ).toBe('tablet-value');
  });

  it('returns the mobile override when present', () => {
    expect(
      resolveBreakpointValue('mobile', {
        desktop: 'desktop-value',
        tablet: 'tablet-value',
        mobile: 'mobile-value',
      }),
    ).toBe('mobile-value');
  });
});

describe('combineMaxWidthConstraints', () => {
  it('returns undefined when no constraints are provided', () => {
    expect(combineMaxWidthConstraints(undefined, undefined)).toBeUndefined();
  });

  it('returns the only defined constraint when one exists', () => {
    expect(combineMaxWidthConstraints('800px', undefined)).toBe('800px');
  });

  it('combines multiple constraints with CSS min()', () => {
    expect(combineMaxWidthConstraints('800px', 'calc(100dvh - 10rem)')).toBe(
      'min(800px, calc(100dvh - 10rem))',
    );
  });
});
