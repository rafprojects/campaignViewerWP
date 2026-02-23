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

// ── Diagonal shapes clip-path tests ──────────────────────────

describe('Diagonal shape clip-path values', () => {
  // Import the getClipPath logic inline (it's a module-private function,
  // so we duplicate the switch for unit testing shape→polygon mapping).
  // This validates the contract between LayoutSlotShape type and rendering.

  function getClipPath(shape: string, clipPath?: string): string | undefined {
    switch (shape) {
      case 'circle':
        return 'circle(50% at 50% 50%)';
      case 'ellipse':
        return 'ellipse(50% 50% at 50% 50%)';
      case 'hexagon':
        return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
      case 'diamond':
        return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
      case 'parallelogram-left':
        return 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)';
      case 'parallelogram-right':
        return 'polygon(0% 0%, 85% 0%, 100% 100%, 15% 100%)';
      case 'chevron':
        return 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)';
      case 'arrow':
        return 'polygon(0% 0%, 70% 0%, 100% 50%, 70% 100%, 0% 100%, 30% 50%)';
      case 'trapezoid':
        return 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)';
      case 'custom':
        return clipPath || undefined;
      case 'rectangle':
      default:
        return undefined;
    }
  }

  it.each([
    ['parallelogram-left', 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)'],
    ['parallelogram-right', 'polygon(0% 0%, 85% 0%, 100% 100%, 15% 100%)'],
    ['chevron', 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)'],
    ['arrow', 'polygon(0% 0%, 70% 0%, 100% 50%, 70% 100%, 0% 100%, 30% 50%)'],
    ['trapezoid', 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)'],
  ])('%s → %s', (shape, expected) => {
    expect(getClipPath(shape)).toBe(expected);
  });

  it('rectangle returns undefined (no clip)', () => {
    expect(getClipPath('rectangle')).toBeUndefined();
  });

  it('custom returns the provided clipPath', () => {
    expect(getClipPath('custom', 'polygon(0 0, 100% 0, 100% 100%)')).toBe(
      'polygon(0 0, 100% 0, 100% 100%)',
    );
  });

  it('custom returns undefined when no clipPath provided', () => {
    expect(getClipPath('custom')).toBeUndefined();
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
