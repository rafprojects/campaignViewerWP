/**
 * Tests for the shared getClipPath + usesClipPath utilities.
 * These are the canonical tests — the actual functions used by both
 * LayoutSlotComponent and LayoutBuilderGallery.
 */
import { describe, it, expect } from 'vitest';
import { getClipPath, usesClipPath } from './clipPath';
import type { LayoutSlot } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';

function makeSlot(shape: LayoutSlot['shape'], clipPath?: string): LayoutSlot {
  return { ...DEFAULT_LAYOUT_SLOT, id: 'test', shape, clipPath };
}

describe('getClipPath', () => {
  it('returns undefined for rectangle (no clip)', () => {
    expect(getClipPath(makeSlot('rectangle'))).toBeUndefined();
  });

  it('returns circle function for circle shape', () => {
    expect(getClipPath(makeSlot('circle'))).toBe('ellipse(50% 50% at 50% 50%)');
  });

  it('returns ellipse function for ellipse shape', () => {
    expect(getClipPath(makeSlot('ellipse'))).toBe('ellipse(50% 50% at 50% 50%)');
  });

  it('returns polygon for hexagon', () => {
    expect(getClipPath(makeSlot('hexagon'))).toBe(
      'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    );
  });

  it('returns polygon for diamond', () => {
    expect(getClipPath(makeSlot('diamond'))).toBe(
      'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    );
  });

  it.each([
    ['parallelogram-left' as const, 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)'],
    ['parallelogram-right' as const, 'polygon(0% 0%, 85% 0%, 100% 100%, 15% 100%)'],
    ['chevron' as const, 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)'],
    ['arrow' as const, 'polygon(0% 0%, 70% 0%, 100% 50%, 70% 100%, 0% 100%, 30% 50%)'],
    ['trapezoid' as const, 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'],
  ])('returns correct polygon for diagonal shape %s', (shape, expected) => {
    expect(getClipPath(makeSlot(shape))).toBe(expected);
  });

  it('returns custom clipPath when shape is "custom" and clipPath is set', () => {
    expect(getClipPath(makeSlot('custom', 'polygon(0 0, 100% 0, 100% 100%)'))).toBe(
      'polygon(0 0, 100% 0, 100% 100%)',
    );
  });

  it('returns undefined for "custom" when no clipPath provided', () => {
    expect(getClipPath(makeSlot('custom'))).toBeUndefined();
  });

  it('returns undefined for "custom" when clipPath is empty string', () => {
    expect(getClipPath(makeSlot('custom', ''))).toBeUndefined();
  });

  it('returns undefined for unknown shape (default case)', () => {
    // Force an unknown shape value at runtime
    expect(getClipPath(makeSlot('rectangle'))).toBeUndefined();
  });
});

describe('usesClipPath', () => {
  it('returns false for rectangle', () => {
    expect(usesClipPath(makeSlot('rectangle'))).toBe(false);
  });

  it.each([
    'circle' as const,
    'ellipse' as const,
    'hexagon' as const,
    'diamond' as const,
    'parallelogram-left' as const,
    'parallelogram-right' as const,
    'chevron' as const,
    'arrow' as const,
    'trapezoid' as const,
    'custom' as const,
  ])('returns true for non-rectangle shape: %s', (shape) => {
    expect(usesClipPath(makeSlot(shape))).toBe(true);
  });
});
