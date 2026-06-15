/**
 * P51-E: unit tests for the shared tile-grid layout helper used by the
 * hexagonal and diamond adapters.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveLengthToPx, resolveTileGridLayout } from './tileLayout';

describe('resolveLengthToPx', () => {
  beforeEach(() => {
    // Deterministic font + viewport context for vw/rem resolution.
    document.documentElement.style.fontSize = '16px';
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
  });

  it('passes px values through unchanged', () => {
    expect(resolveLengthToPx(150, 'px', 800)).toBe(150);
  });

  it('resolves % against the container width', () => {
    expect(resolveLengthToPx(25, '%', 800)).toBe(200);
  });

  it('resolves vw against the window width', () => {
    expect(resolveLengthToPx(10, 'vw', 800)).toBe(100);
  });

  it('resolves rem and em against the root font size', () => {
    expect(resolveLengthToPx(2, 'rem', 800)).toBe(32);
    expect(resolveLengthToPx(2, 'em', 800)).toBe(32);
  });

  it('defaults unknown units to a raw pixel value', () => {
    expect(resolveLengthToPx(42, 'frobnozzle', 800)).toBe(42);
  });
});

describe('resolveTileGridLayout', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));

  it('wraps px tiles into rows that fit the container', () => {
    // (800 + 8) / (100 + 8) = 7.4 -> 7 per row
    const { tilePx, tilesPerRow, rows } = resolveTileGridLayout({
      items,
      tileValue: 100,
      tileUnit: 'px',
      gapValue: 8,
      gapUnit: 'px',
      containerWidth: 800,
    });
    expect(tilePx).toBe(100);
    expect(tilesPerRow).toBe(7);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(7);
    expect(rows[1]).toHaveLength(3);
  });

  it('resolves % tiles to pixels so they still wrap (the bug this fixes)', () => {
    // 25% of 800 = 200px tiles -> (800 + 8) / (200 + 8) = 3.8 -> 3 per row
    const { tilePx, tilesPerRow } = resolveTileGridLayout({
      items,
      tileValue: 25,
      tileUnit: '%',
      gapValue: 8,
      gapUnit: 'px',
      containerWidth: 800,
    });
    expect(tilePx).toBe(200);
    expect(tilesPerRow).toBe(3);
  });

  it('falls back to fallbackPerRow before the container is measured', () => {
    const { tilesPerRow, rows } = resolveTileGridLayout({
      items,
      tileValue: 25,
      tileUnit: '%',
      gapValue: 8,
      gapUnit: 'px',
      containerWidth: 0,
      fallbackPerRow: 4,
    });
    expect(tilesPerRow).toBe(4);
    expect(rows[0]).toHaveLength(4);
  });

  it('never drops below minPerRow', () => {
    // Huge tiles in a narrow container would yield <2 without the floor.
    const { tilesPerRow } = resolveTileGridLayout({
      items,
      tileValue: 5000,
      tileUnit: 'px',
      gapValue: 8,
      gapUnit: 'px',
      containerWidth: 300,
      minPerRow: 2,
    });
    expect(tilesPerRow).toBe(2);
  });
});
