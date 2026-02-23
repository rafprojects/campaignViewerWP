/**
 * Sprint 6 Tests: P15-J (Premade Template Presets) + P15-K (Diagonal Shapes)
 */
import { describe, it, expect } from 'vitest';
import { LAYOUT_PRESETS, type LayoutPreset } from './layoutPresets';

describe('LAYOUT_PRESETS', () => {
  it('exports exactly 12 presets', () => {
    expect(LAYOUT_PRESETS).toHaveLength(12);
  });

  it('every preset has required fields', () => {
    for (const preset of LAYOUT_PRESETS) {
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.canvasAspectRatio).toBeGreaterThan(0);
      expect(preset.tags.length).toBeGreaterThanOrEqual(1);
      expect(preset.slots.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every slot has valid percentage positions (0–100)', () => {
    for (const preset of LAYOUT_PRESETS) {
      for (const slot of preset.slots) {
        expect(slot.x).toBeGreaterThanOrEqual(0);
        expect(slot.x).toBeLessThanOrEqual(100);
        expect(slot.y).toBeGreaterThanOrEqual(0);
        expect(slot.y).toBeLessThanOrEqual(100);
        expect(slot.width).toBeGreaterThan(0);
        expect(slot.width).toBeLessThanOrEqual(100);
        expect(slot.height).toBeGreaterThan(0);
        expect(slot.height).toBeLessThanOrEqual(100);
      }
    }
  });

  it('every slot has a unique id within its preset', () => {
    for (const preset of LAYOUT_PRESETS) {
      const ids = preset.slots.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('every slot has the expected default property values', () => {
    for (const preset of LAYOUT_PRESETS) {
      for (const slot of preset.slots) {
        expect(slot.objectFit).toBe('cover');
        expect(slot.objectPosition).toBe('50% 50%');
        expect(slot.clickAction).toBe('lightbox');
        expect(slot.hoverEffect).toBe('pop');
      }
    }
  });

  it('has the expected preset names', () => {
    const names = LAYOUT_PRESETS.map((p) => p.name);
    expect(names).toContain('Hero + Thumbnails');
    expect(names).toContain('Magazine Spread');
    expect(names).toContain('Pinterest Board');
    expect(names).toContain('Film Strip');
    expect(names).toContain('Spotlight');
    expect(names).toContain('Grid 2×2');
    expect(names).toContain('Grid 3×3');
    expect(names).toContain('Panoramic');
    expect(names).toContain('Diagonal Cascade');
    expect(names).toContain('Photo Stack');
    expect(names).toContain('L-Shape');
    expect(names).toContain('T-Layout');
  });

  it('all preset names are unique', () => {
    const names = LAYOUT_PRESETS.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('Grid 3×3 has exactly 9 slots', () => {
    const grid3x3 = LAYOUT_PRESETS.find((p) => p.name === 'Grid 3×3');
    expect(grid3x3).toBeDefined();
    expect(grid3x3!.slots).toHaveLength(9);
  });

  it('overlapping presets have ascending z-indices', () => {
    const cascade = LAYOUT_PRESETS.find((p) => p.name === 'Diagonal Cascade');
    expect(cascade).toBeDefined();
    const zIndices = cascade!.slots.map((s) => s.zIndex);
    for (let i = 1; i < zIndices.length; i++) {
      expect(zIndices[i]).toBeGreaterThan(zIndices[i - 1]);
    }
  });
});

// ── Per-preset slot count verification ───────────────────────

describe('LAYOUT_PRESETS — per-preset slot counts', () => {
  const expectations: Record<string, number> = {
    'Hero + Thumbnails': 5,
    'Magazine Spread': 5,
    'Pinterest Board': 6,
    'Film Strip': 5,
    'Spotlight': 3,
    'Grid 2×2': 4,
    'Grid 3×3': 9,
    'Panoramic': 4,
    'Diagonal Cascade': 4,
    'Photo Stack': 3,
    'L-Shape': 4,
    'T-Layout': 4,
  };

  it.each(Object.entries(expectations))(
    '%s has %d slots',
    (name, count) => {
      const preset = LAYOUT_PRESETS.find((p) => p.name === name);
      expect(preset).toBeDefined();
      expect(preset!.slots).toHaveLength(count);
    },
  );
});

// ── Aspect ratio validation ──────────────────────────────────

describe('LAYOUT_PRESETS — canvasAspectRatio values', () => {
  it.each([
    ['Film Strip', 21 / 9],
    ['Grid 2×2', 1],
    ['Grid 3×3', 1],
    ['Photo Stack', 1],
    ['Pinterest Board', 4 / 3],
    ['Panoramic', 4 / 3],
  ])('%s has aspect ratio %f', (name, ratio) => {
    const preset = LAYOUT_PRESETS.find((p) => p.name === name);
    expect(preset).toBeDefined();
    expect(preset!.canvasAspectRatio).toBeCloseTo(ratio, 3);
  });
});

// ── Grid presets should not overlap ──────────────────────────

describe('LAYOUT_PRESETS — grid presets non-overlapping', () => {
  it('Grid 2×2 slots do not overlap', () => {
    const preset = LAYOUT_PRESETS.find((p) => p.name === 'Grid 2×2')!;
    for (let i = 0; i < preset.slots.length; i++) {
      for (let j = i + 1; j < preset.slots.length; j++) {
        const a = preset.slots[i];
        const b = preset.slots[j];
        const overlapX = a.x < b.x + b.width && a.x + a.width > b.x;
        const overlapY = a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlapX && overlapY).toBe(false);
      }
    }
  });
});

// ── LayoutPreset interface contract test ─────────────────────

describe('LayoutPreset interface', () => {
  it('satisfies the expected structure', () => {
    const preset: LayoutPreset = {
      name: 'Test',
      description: 'A test preset',
      canvasAspectRatio: 1,
      tags: ['test'],
      slots: [],
    };
    expect(preset).toBeDefined();
    expect(typeof preset.name).toBe('string');
    expect(Array.isArray(preset.tags)).toBe(true);
    expect(Array.isArray(preset.slots)).toBe(true);
  });
});
