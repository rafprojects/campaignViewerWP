/**
 * Phase 16 Tests: P16-A.1 — layerList utility (buildLayerList, getLayerName, computeReorderedZIndices)
 */
import { describe, it, expect } from 'vitest';
import {
  buildLayerList,
  getLayerName,
  computeReorderedZIndices,
} from '@/utils/layerList';
import type { LayoutTemplate, LayoutSlot, LayoutGraphicLayer } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSlot = (id: string, zIndex: number, overrides: Partial<LayoutSlot> = {}): LayoutSlot => ({
  id,
  x: 0, y: 0, width: 25, height: 25, zIndex,
  shape: 'rectangle',
  borderRadius: 4, borderWidth: 0, borderColor: '#fff',
  objectFit: 'cover', objectPosition: '50% 50%',
  clickAction: 'lightbox', hoverEffect: 'pop',
  ...overrides,
});

const makeOverlay = (id: string, zIndex: number, overrides: Partial<LayoutGraphicLayer> = {}): LayoutGraphicLayer => ({
  id, imageUrl: '/img.png',
  x: 0, y: 0, width: 50, height: 50, zIndex,
  opacity: 1, pointerEvents: false,
  ...overrides,
});

const makeTemplate = (slots: LayoutSlot[], overlays: LayoutGraphicLayer[] = []): LayoutTemplate => ({
  id: 'tpl', name: 'Test', schemaVersion: 1,
  canvasAspectRatio: 16 / 9, canvasMinWidth: 400, canvasMaxWidth: 1200,
  backgroundColor: '#000',
  slots, overlays,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  tags: [],
});

// ── buildLayerList ─────────────────────────────────────────────────────────

describe('buildLayerList', () => {
  it('returns only background row for empty template', () => {
    const layers = buildLayerList(makeTemplate([], []));
    expect(layers).toHaveLength(1);
    expect(layers[0].kind).toBe('background');
  });

  it('background is always the last item', () => {
    const tpl = makeTemplate(
      [makeSlot('s1', 10), makeSlot('s2', 5)],
      [makeOverlay('o1', 20)],
    );
    const layers = buildLayerList(tpl);
    expect(layers[layers.length - 1].kind).toBe('background');
  });

  it('sorts items descending by zIndex', () => {
    const tpl = makeTemplate([makeSlot('s1', 1), makeSlot('s2', 5), makeSlot('s3', 3)]);
    const layers = buildLayerList(tpl);
    const nonBg = layers.filter((l) => l.kind !== 'background');
    expect(nonBg.map((l) => l.id)).toEqual(['s2', 's3', 's1']);
  });

  it('interleaves slots and overlays by zIndex', () => {
    const tpl = makeTemplate(
      [makeSlot('s1', 10)],
      [makeOverlay('o1', 20), makeOverlay('o2', 5)],
    );
    const layers = buildLayerList(tpl);
    const nonBg = layers.filter((l) => l.kind !== 'background');
    expect(nonBg[0].id).toBe('o1'); // zIndex 20
    expect(nonBg[1].id).toBe('s1'); // zIndex 10
    expect(nonBg[2].id).toBe('o2'); // zIndex 5
  });

  it('uses arrayIndex as stable tie-breaker for equal zIndex', () => {
    // Both slots have zIndex 5; slot at arrayIndex 1 (s2) should come first
    const tpl = makeTemplate([makeSlot('s1', 5), makeSlot('s2', 5)]);
    const layers = buildLayerList(tpl);
    const nonBg = layers.filter((l) => l.kind !== 'background');
    // Higher arrayIndex wins (later in array = placed above in panel on equal z)
    expect(nonBg[0].id).toBe('s2');
    expect(nonBg[1].id).toBe('s1');
  });

  it('assigns correct index (0-based) to slot items', () => {
    const tpl = makeTemplate([makeSlot('s1', 10), makeSlot('s2', 5)]);
    const layers = buildLayerList(tpl);
    const s1 = layers.find((l) => l.id === 's1');
    const s2 = layers.find((l) => l.id === 's2');
    expect(s1?.kind === 'slot' && s1.index).toBe(0);
    expect(s2?.kind === 'slot' && s2.index).toBe(1);
  });

  it('defaults visible to true when not set', () => {
    const tpl = makeTemplate([makeSlot('s1', 1)]);
    const layers = buildLayerList(tpl);
    const s = layers.find((l) => l.id === 's1');
    expect(s?.visible).toBe(true);
  });

  it('respects visible: false on slot', () => {
    const tpl = makeTemplate([makeSlot('s1', 1, { visible: false })]);
    const layers = buildLayerList(tpl);
    const s = layers.find((l) => l.id === 's1');
    expect(s?.visible).toBe(false);
  });

  it('defaults locked to false when not set', () => {
    const tpl = makeTemplate([makeSlot('s1', 1)]);
    const layers = buildLayerList(tpl);
    const s = layers.find((l) => l.id === 's1') as { locked?: boolean };
    expect(s?.locked).toBe(false);
  });

  it('respects locked: true on overlay', () => {
    const tpl = makeTemplate([], [makeOverlay('o1', 5, { locked: true })]);
    const layers = buildLayerList(tpl);
    const o = layers.find((l) => l.id === 'o1') as { locked?: boolean };
    expect(o?.locked).toBe(true);
  });

  it('passes overlay opacity through', () => {
    const tpl = makeTemplate([], [makeOverlay('o1', 5, { opacity: 0.6 })]);
    const layers = buildLayerList(tpl);
    const o = layers.find((l) => l.id === 'o1');
    expect(o?.kind === 'graphic' && o.opacity).toBe(0.6);
  });

  it('handles single slot + no overlays', () => {
    const tpl = makeTemplate([makeSlot('s1', 3)]);
    const layers = buildLayerList(tpl);
    expect(layers).toHaveLength(2); // 1 slot + background
    expect(layers[0].id).toBe('s1');
  });

  it('total count = slots + overlays + 1 (background)', () => {
    const tpl = makeTemplate(
      [makeSlot('s1', 1), makeSlot('s2', 2)],
      [makeOverlay('o1', 3)],
    );
    expect(buildLayerList(tpl)).toHaveLength(4);
  });
});

// ── getLayerName ───────────────────────────────────────────────────────────

describe('getLayerName', () => {
  const tpl = makeTemplate(
    [makeSlot('s1', 1), makeSlot('s2', 2)],
    [makeOverlay('o1', 10), makeOverlay('o2', 20)],
  );

  it('returns "Background" for background item with no name', () => {
    const layers = buildLayerList(tpl);
    const bg = layers.find((l) => l.kind === 'background')!;
    expect(getLayerName(bg, tpl)).toBe('Background');
  });

  it('returns "Media Layer 1" for first slot with no name', () => {
    const layers = buildLayerList(tpl);
    const s1 = layers.find((l) => l.id === 's1')!;
    expect(getLayerName(s1, tpl)).toBe('Media Layer 1');
  });

  it('returns "Media Layer 2" for second slot', () => {
    const layers = buildLayerList(tpl);
    const s2 = layers.find((l) => l.id === 's2')!;
    expect(getLayerName(s2, tpl)).toBe('Media Layer 2');
  });

  it('returns "Graphic Layer 1" for first overlay', () => {
    const layers = buildLayerList(tpl);
    const o1 = layers.find((l) => l.id === 'o1')!;
    expect(getLayerName(o1, tpl)).toBe('Graphic Layer 1');
  });

  it('returns "Graphic Layer 2" for second overlay', () => {
    const layers = buildLayerList(tpl);
    const o2 = layers.find((l) => l.id === 'o2')!;
    expect(getLayerName(o2, tpl)).toBe('Graphic Layer 2');
  });

  it('returns explicit name when set on slot', () => {
    const tplNamed = makeTemplate([makeSlot('s1', 1, { name: 'Hero Image' })]);
    const layers = buildLayerList(tplNamed);
    const s = layers.find((l) => l.id === 's1')!;
    expect(getLayerName(s, tplNamed)).toBe('Hero Image');
  });

  it('returns explicit name when set on overlay', () => {
    const tplNamed = makeTemplate([], [makeOverlay('o1', 5, { name: 'Logo Watermark' })]);
    const layers = buildLayerList(tplNamed);
    const o = layers.find((l) => l.id === 'o1')!;
    expect(getLayerName(o, tplNamed)).toBe('Logo Watermark');
  });
});

// ── computeReorderedZIndices ─────────────────────────────────────────────────

describe('computeReorderedZIndices', () => {
  it('moves dragged item above target and assigns sequential z-indices', () => {
    // Panel order (desc z): s3(3), s2(2), s1(1)
    const tpl = makeTemplate([makeSlot('s1', 1), makeSlot('s2', 2), makeSlot('s3', 3)]);
    const layers = buildLayerList(tpl);
    // Drag s1 (bottom) above s3 (top)
    const result = computeReorderedZIndices(layers, 's1', 's3');
    // After move panel should be: s1, s3, s2
    // s1 gets z=3, s3 gets z=2, s2 gets z=1
    expect(result.get('s1')).toBe(3);
    expect(result.get('s3')).toBe(2);
    expect(result.get('s2')).toBe(1);
  });

  it('handles cross-type reorder (slot above overlay)', () => {
    const tpl = makeTemplate(
      [makeSlot('s1', 1)],
      [makeOverlay('o1', 3)],
    );
    const layers = buildLayerList(tpl);
    // Panel order: o1(3), s1(1). Drag s1 above o1.
    const result = computeReorderedZIndices(layers, 's1', 'o1');
    expect(result.get('s1')).toBe(2); // top
    expect(result.get('o1')).toBe(1); // bottom
  });

  it('returns unchanged z-indices when dragged and target are the same', () => {
    const tpl = makeTemplate([makeSlot('s1', 1), makeSlot('s2', 2)]);
    const layers = buildLayerList(tpl);
    const result = computeReorderedZIndices(layers, 's1', 's1');
    expect(result.get('s1')).toBe(1);
    expect(result.get('s2')).toBe(2);
  });

  it('returns unchanged z-indices when dragged id not found', () => {
    const tpl = makeTemplate([makeSlot('s1', 1), makeSlot('s2', 2)]);
    const layers = buildLayerList(tpl);
    const result = computeReorderedZIndices(layers, 'nonexistent', 's2');
    expect(result.get('s1')).toBe(1);
    expect(result.get('s2')).toBe(2);
  });

  it('always produces sequential z-indices starting at 1', () => {
    const tpl = makeTemplate(
      [makeSlot('s1', 10), makeSlot('s2', 20), makeSlot('s3', 30)],
    );
    const layers = buildLayerList(tpl);
    const result = computeReorderedZIndices(layers, 's1', 's2');
    const values = Array.from(result.values()).sort((a, b) => a - b);
    expect(values).toEqual([1, 2, 3]);
  });

  it('dropping onto background row places dragged item at bottom of stack', () => {
    // Panel order: s3(3), s2(2), s1(1), background
    // Drag s3 (top) onto background row → s3 should become z=1
    const tpl = makeTemplate([makeSlot('s1', 1), makeSlot('s2', 2), makeSlot('s3', 3)]);
    const layers = buildLayerList(tpl);
    const result = computeReorderedZIndices(layers, 's3', 'background');
    expect(result.get('s2')).toBe(3); // was 2, now top
    expect(result.get('s1')).toBe(2); // was 1, now middle
    expect(result.get('s3')).toBe(1); // was 3, now bottom
  });

  it('dropping onto background row is a no-op when item is already at the bottom', () => {
    const tpl = makeTemplate([makeSlot('s1', 1), makeSlot('s2', 2)]);
    const layers = buildLayerList(tpl);
    // s1 is already at the bottom (z=1)
    const result = computeReorderedZIndices(layers, 's1', 'background');
    expect(result.get('s1')).toBe(1);
    expect(result.get('s2')).toBe(2);
  });
});
