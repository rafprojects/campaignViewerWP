import { describe, expect, it } from 'vitest';
import { spaceColor } from './spaceColor';

const PALETTE = ['blue', 'orange', 'green', 'red', 'violet', 'pink'] as const;

describe('spaceColor', () => {
  it('always returns a color that is in the known palette', () => {
    const inputs = ['gallery-1', 'wpsg-hero-0', 'a', 'products-space', '123'];
    for (const id of inputs) {
      expect(PALETTE as readonly string[]).toContain(spaceColor(id));
    }
  });

  it('is deterministic — same instanceId always yields the same color', () => {
    const ids = ['gallery-1', 'gallery-2', 'hero', 'products', 'wpsg-about-0'];
    for (const id of ids) {
      const first = spaceColor(id);
      expect(spaceColor(id)).toBe(first);
      expect(spaceColor(id)).toBe(first);
    }
  });

  it('handles empty string without throwing and returns a palette color', () => {
    expect(PALETTE as readonly string[]).toContain(spaceColor(''));
  });

  it('distributes across every palette color given sufficient distinct inputs', () => {
    // With a sound hash and 100 samples, every bucket in a 6-item palette must be hit.
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(spaceColor(`test-gallery-instance-${i}`));
    }
    expect(seen.size).toBe(PALETTE.length);
  });

  it('produces different colors for distinct inputs (not a constant function)', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(spaceColor));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('two different instanceIds that collide are still from the palette', () => {
    // Even if two IDs hash to the same bucket, the result must be in the palette.
    const c1 = spaceColor('x');
    const c2 = spaceColor('y');
    expect(PALETTE as readonly string[]).toContain(c1);
    expect(PALETTE as readonly string[]).toContain(c2);
  });
});
