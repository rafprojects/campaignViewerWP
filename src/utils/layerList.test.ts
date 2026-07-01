/**
 * Comprehensive unit tests for layerList.ts — layer panel tree building and reordering.
 * Covers layer list generation with group hierarchy, name resolution, and z-index reordering.
 */
import { describe, it, expect } from 'vitest';
import type {
  LayerItem,
  SlotLayerItem,
  GraphicLayerItem,
  TextLayerItem,
  BackgroundLayerItem,
  GroupLayerItem,
} from './layerList';
import {
  buildLayerList,
  getLayerName,
  computeReorderedZIndices,
} from '@/utils/layerList';
import type { LayoutTemplate, LayoutSlot, LayoutGroup, LayoutGraphicLayer, LayoutTextLayer } from '@/types';

// ── Test helpers ────────────────────────────────────────────────────────

function makeSlot(id: string, options: Partial<LayoutSlot> = {}): LayoutSlot {
  return {
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    zIndex: 1,
    name: '',
    visible: true,
    locked: false,
    maskLayer: undefined,
    ...options,
  } as LayoutSlot;
}

function makeGroup(id: string, options: Partial<LayoutGroup> = {}): LayoutGroup {
  return {
    id,
    memberIds: [],
    childGroupIds: [],
    parentGroupId: null,
    name: '',
    visible: true,
    locked: false,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...options,
  } as LayoutGroup;
}

function makeOverlay(id: string, options: Partial<LayoutGraphicLayer> = {}): LayoutGraphicLayer {
  return {
    id,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    zIndex: 1,
    name: '',
    visible: true,
    locked: false,
    opacity: 1,
    ...options,
  } as LayoutGraphicLayer;
}

function makeText(id: string, options: Partial<LayoutTextLayer> = {}): LayoutTextLayer {
  return {
    id,
    x: 0,
    y: 0,
    width: 40,
    height: 12,
    zIndex: 1,
    opacity: 1,
    content: 'Text',
    semanticTag: 'heading',
    textAlign: 'left',
    typography: {},
    name: '',
    visible: true,
    locked: false,
    ...options,
  } as LayoutTextLayer;
}

function makeTemplate(overrides: Partial<LayoutTemplate> = {}): LayoutTemplate {
  return {
    id: 'template-1',
    name: 'Test Template',
    aspectRatio: 16 / 9,
    slots: [],
    overlays: [],
    groups: [],
    backgroundColor: { h: 0, s: 0, l: 50, a: 1 },
    backgroundVisible: true,
    backgroundLocked: false,
    ...overrides,
  } as LayoutTemplate;
}

// ── Text layers (P59-B) ────────────────────────────────────────────────

describe('buildLayerList — text layers (P59-B)', () => {
  it('includes text layers as kind "text" with name + visible/locked', () => {
    const template = makeTemplate({
      texts: [makeText('tx1', { name: 'Headline', zIndex: 3, locked: true })],
    });
    const list = buildLayerList(template);
    const textItem = list.find((l) => l.kind === 'text') as TextLayerItem | undefined;
    expect(textItem).toBeDefined();
    expect(textItem!.id).toBe('tx1');
    expect(textItem!.name).toBe('Headline');
    expect(textItem!.locked).toBe(true);
    expect(textItem!.visible).toBe(true);
  });

  it('orders a higher-z text above a lower-z slot in the panel', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { zIndex: 1 })],
      texts: [makeText('tx1', { zIndex: 5 })],
    });
    const list = buildLayerList(template).filter((l) => l.kind === 'slot' || l.kind === 'text');
    expect(list[0]!.kind).toBe('text'); // higher z sorts to the top
    expect(list[1]!.kind).toBe('slot');
  });

  it('getLayerName falls back to "Text Layer N" using arrayIndex', () => {
    const item: TextLayerItem = {
      kind: 'text', id: 'tx1', zIndex: 1, arrayIndex: 2,
      name: '', visible: true, locked: false, opacity: 1,
      depth: 0, ancestorGroupIds: [],
    };
    expect(getLayerName(item, makeTemplate())).toBe('Text Layer 3');
  });

  it('computeReorderedZIndices treats text layers as movable', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { zIndex: 1 })],
      texts: [makeText('tx1', { zIndex: 2 })],
    });
    const z = computeReorderedZIndices(buildLayerList(template), 's1', 'tx1');
    expect(z.has('s1')).toBe(true);
    expect(z.has('tx1')).toBe(true);
  });

  it('templates without a texts array still build (back-compat)', () => {
    const list = buildLayerList(makeTemplate());
    expect(list.some((l) => l.kind === 'text')).toBe(false);
  });
});

// ── getLayerName ───────────────────────────────────────────────────────

describe('getLayerName', () => {
  const template = makeTemplate();

  it('returns name for background layer', () => {
    const item: BackgroundLayerItem = {
      kind: 'background',
      id: 'background',
      zIndex: 0,
      arrayIndex: -1,
      name: 'Custom Background',
      visible: true,
      depth: 0,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('Custom Background');
  });

  it('returns "Background" if background has no explicit name', () => {
    const item: BackgroundLayerItem = {
      kind: 'background',
      id: 'background',
      zIndex: 0,
      arrayIndex: -1,
      name: '',
      visible: true,
      depth: 0,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('Background');
  });

  it('returns explicit name for mask', () => {
    const item = {
      kind: 'mask' as const,
      id: 'mask-s1',
      parentSlotId: 's1',
      zIndex: 1,
      arrayIndex: -1,
      name: 'Custom Mask',
      visible: true,
      depth: 2,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('Custom Mask');
  });

  it('returns "Mask" for mask with no explicit name', () => {
    const item = {
      kind: 'mask' as const,
      id: 'mask-s1',
      parentSlotId: 's1',
      zIndex: 1,
      arrayIndex: -1,
      name: '',
      visible: true,
      depth: 2,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('Mask');
  });

  it('returns explicit name for group', () => {
    const item: GroupLayerItem = {
      kind: 'group',
      id: 'g1',
      group: makeGroup('g1'),
      zIndex: 1,
      arrayIndex: 0,
      name: 'My Group',
      visible: true,
      locked: false,
      depth: 0,
      ancestorGroupIds: [],
      totalDescendantCount: 2,
      descendantSlotIds: ['s1', 's2'],
    };
    expect(getLayerName(item, template)).toBe('My Group');
  });

  it('returns "Group" for group with no explicit name', () => {
    const item: GroupLayerItem = {
      kind: 'group',
      id: 'g1',
      group: makeGroup('g1'),
      zIndex: 1,
      arrayIndex: 0,
      name: '',
      visible: true,
      locked: false,
      depth: 0,
      ancestorGroupIds: [],
      totalDescendantCount: 2,
      descendantSlotIds: ['s1', 's2'],
    };
    expect(getLayerName(item, template)).toBe('Group');
  });

  it('returns explicit name for slot', () => {
    const item: SlotLayerItem = {
      kind: 'slot',
      id: 's1',
      zIndex: 1,
      arrayIndex: 0,
      index: 0,
      name: 'My Slot',
      visible: true,
      locked: false,
      depth: 0,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('My Slot');
  });

  it('returns "Media Layer N" fallback for slot (1-based)', () => {
    const item: SlotLayerItem = {
      kind: 'slot',
      id: 's1',
      zIndex: 1,
      arrayIndex: 0,
      index: 2,
      name: '',
      visible: true,
      locked: false,
      depth: 0,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('Media Layer 3');
  });

  it('returns explicit name for graphic layer', () => {
    const item: GraphicLayerItem = {
      kind: 'graphic',
      id: 'g-overlay-1',
      zIndex: 1,
      arrayIndex: 0,
      name: 'My Overlay',
      visible: true,
      locked: false,
      opacity: 1,
      depth: 0,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('My Overlay');
  });

  it('returns "Graphic Layer N" fallback for graphic (1-based from arrayIndex)', () => {
    const item: GraphicLayerItem = {
      kind: 'graphic',
      id: 'overlay-2',
      zIndex: 1,
      arrayIndex: 1,
      name: '',
      visible: true,
      locked: false,
      opacity: 1,
      depth: 0,
      ancestorGroupIds: [],
    };
    expect(getLayerName(item, template)).toBe('Graphic Layer 2');
  });
});

// ── buildLayerList ─────────────────────────────────────────────────────────

describe('buildLayerList', () => {
  it('returns only background for empty template', () => {
    const template = makeTemplate();
    const result = buildLayerList(template);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('background');
  });

  it('builds layer list with single ungrouped slot', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { zIndex: 10 })],
    });
    const result = buildLayerList(template);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('slot');
    expect(result[0].id).toBe('s1');
    expect(result[1].kind).toBe('background');
  });

  it('builds layer list with multiple ungrouped slots sorted by z-index descending', () => {
    const template = makeTemplate({
      slots: [
        makeSlot('s1', { zIndex: 10 }),
        makeSlot('s2', { zIndex: 20 }),
        makeSlot('s3', { zIndex: 5 }),
      ],
    });
    const result = buildLayerList(template);
    expect(result[0].id).toBe('s2');
    expect(result[1].id).toBe('s1');
    expect(result[2].id).toBe('s3');
  });

  it('uses array index as tie-breaker for slots with same z-index', () => {
    const template = makeTemplate({
      slots: [
        makeSlot('s1', { zIndex: 10 }),
        makeSlot('s2', { zIndex: 10 }),
      ],
    });
    const result = buildLayerList(template);
    expect(result[0].id).toBe('s2');
    expect(result[1].id).toBe('s1');
  });

  it('includes slot.maskLayer when present', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { maskLayer: { visible: true } as any })],
    });
    const result = buildLayerList(template);
    expect(result.length).toBeGreaterThan(2);
    const maskLayer = result.find((l) => l.kind === 'mask');
    expect(maskLayer).toBeDefined();
    expect(maskLayer?.id).toBe('mask-s1');
  });

  it('skips slot.maskLayer when not present', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1')],
    });
    const result = buildLayerList(template);
    const maskLayers = result.filter((l) => l.kind === 'mask');
    expect(maskLayers).toHaveLength(0);
  });

  it('includes graphic overlays sorted by z-index', () => {
    const template = makeTemplate({
      overlays: [
        makeOverlay('o1', { zIndex: 15 }),
        makeOverlay('o2', { zIndex: 25 }),
      ],
    });
    const result = buildLayerList(template);
    expect(result[0].kind).toBe('graphic');
    expect(result[0].id).toBe('o2');
    expect(result[1].kind).toBe('graphic');
    expect(result[1].id).toBe('o1');
  });

  it('respects visible flag on slots and groups', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { visible: false })],
    });
    const result = buildLayerList(template);
    const slot = result.find((l) => l.id === 's1') as SlotLayerItem;
    expect(slot.visible).toBe(false);
  });

  it('respects locked flag on slots and groups', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { locked: true })],
    });
    const result = buildLayerList(template);
    const slot = result.find((l) => l.id === 's1') as SlotLayerItem;
    expect(slot.locked).toBe(true);
  });

  it('emits flat group when no child groups', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { zIndex: 10 })],
      groups: [makeGroup('g1', { memberIds: ['s1'] })],
    });
    const result = buildLayerList(template);
    const groupItem = result.find((l) => l.kind === 'group') as GroupLayerItem;
    expect(groupItem).toBeDefined();
    expect(groupItem.depth).toBe(0);
    expect(groupItem.ancestorGroupIds).toEqual([]);
  });

  it('emits nested group hierarchy with correct depth', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { zIndex: 10 })],
      groups: [
        makeGroup('g1', { memberIds: [], childGroupIds: ['g2'] }),
        makeGroup('g2', { memberIds: ['s1'], parentGroupId: 'g1' }),
      ],
    });
    const result = buildLayerList(template);
    const g1 = result.find((l) => l.kind === 'group' && l.id === 'g1') as GroupLayerItem;
    const g2 = result.find((l) => l.kind === 'group' && l.id === 'g2') as GroupLayerItem;
    const s1 = result.find((l) => l.kind === 'slot') as SlotLayerItem;
    expect(g1.depth).toBe(0);
    expect(g2.depth).toBe(1);
    expect(s1.depth).toBe(2);
  });

  it('computes ancestorGroupIds correctly for nested items', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1')],
      groups: [
        makeGroup('g1', { memberIds: [], childGroupIds: ['g2'] }),
        makeGroup('g2', { memberIds: ['s1'], parentGroupId: 'g1' }),
      ],
    });
    const result = buildLayerList(template);
    const s1 = result.find((l) => l.kind === 'slot') as SlotLayerItem;
    // ancestorGroupIds is built as [parent, grandparent, ...] via myAncestors
    expect(s1.ancestorGroupIds).toEqual(['g1', 'g2']);
  });

  it('excludes grouped slots from top-level ungrouped list', () => {
    const template = makeTemplate({
      slots: [
        makeSlot('s1'),
        makeSlot('s2'),
      ],
      groups: [makeGroup('g1', { memberIds: ['s1'] })],
    });
    const result = buildLayerList(template);
    const topLevelSlots = result.filter((l) => l.kind === 'slot' && l.depth === 0);
    expect(topLevelSlots).toHaveLength(1);
    expect(topLevelSlots[0].id).toBe('s2');
  });

  it('computes totalDescendantCount and descendantSlotIds for group', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [makeGroup('g1', { memberIds: ['s1', 's2'] })],
    });
    const result = buildLayerList(template);
    const group = result.find((l) => l.kind === 'group') as GroupLayerItem;
    expect(group.totalDescendantCount).toBe(2);
    expect(new Set(group.descendantSlotIds)).toEqual(new Set(['s1', 's2']));
  });

  it('masks inherit depth from parent slot + 1', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { maskLayer: { visible: true } as any })],
      groups: [makeGroup('g1', { memberIds: ['s1'] })],
    });
    const result = buildLayerList(template);
    const slot = result.find((l) => l.kind === 'slot') as SlotLayerItem;
    const mask = result.find((l) => l.kind === 'mask');
    expect(mask?.depth).toBe((slot.depth ?? 0) + 1);
  });

  it('masks inherit ancestorGroupIds from parent slot', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1', { maskLayer: { visible: true } as any })],
      groups: [
        makeGroup('g1', { memberIds: [], childGroupIds: ['g2'] }),
        makeGroup('g2', { memberIds: ['s1'], parentGroupId: 'g1' }),
      ],
    });
    const result = buildLayerList(template);
    const slot = result.find((l) => l.kind === 'slot') as SlotLayerItem;
    const mask = result.find((l) => l.kind === 'mask');
    expect(mask?.ancestorGroupIds).toEqual(['g1', 'g2']);
    expect(mask?.ancestorGroupIds).toEqual(slot.ancestorGroupIds);
  });

  it('group rep z-index is max of all descendant slots', () => {
    const template = makeTemplate({
      slots: [
        makeSlot('s1', { zIndex: 5 }),
        makeSlot('s2', { zIndex: 20 }),
        makeSlot('s3', { zIndex: 15 }),
      ],
      groups: [makeGroup('g1', { memberIds: ['s1', 's2', 's3'] })],
    });
    const result = buildLayerList(template);
    const group = result.find((l) => l.kind === 'group') as GroupLayerItem;
    expect(group.zIndex).toBe(20);
  });

  it('group with no resolvable slots has rep z-index of 0', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1')],
      groups: [makeGroup('g1', { memberIds: ['s99'] })],
    });
    const result = buildLayerList(template);
    const group = result.find((l) => l.kind === 'group') as GroupLayerItem;
    expect(group.zIndex).toBe(0);
  });

  it('background is always the last item', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1')],
      overlays: [makeOverlay('o1')],
    });
    const result = buildLayerList(template);
    expect(result[result.length - 1].kind).toBe('background');
  });

  it('handles backward-compatible templates without groups field', () => {
    const template = makeTemplate({
      slots: [makeSlot('s1')],
      groups: undefined,
    });
    const result = buildLayerList(template);
    const slot = result.find((l) => l.kind === 'slot') as SlotLayerItem;
    expect(slot.depth).toBe(0);
    expect(slot.ancestorGroupIds).toEqual([]);
  });
});

// ── computeReorderedZIndices ────────────────────────────────────────────

describe('computeReorderedZIndices', () => {
  function makeLayerList(count: number): (SlotLayerItem | GraphicLayerItem)[] {
    return Array.from({ length: count }, (_, i) => ({
      kind: 'slot' as const,
      id: `s${i}`,
      zIndex: count - i,
      arrayIndex: i,
      index: i,
      name: '',
      visible: true,
      locked: false,
      depth: 0,
      ancestorGroupIds: [],
    }));
  }

  it('returns current z-indices if dragged item not found', () => {
    const layers: LayerItem[] = [
      ...makeLayerList(2),
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 'nonexistent', 's1');
    expect(result.get('s0')).toBe(2);
    expect(result.get('s1')).toBe(1);
  });

  it('returns current z-indices if target not found', () => {
    const layers: LayerItem[] = [
      ...makeLayerList(2),
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's1', 'nonexistent');
    expect(result.get('s0')).toBe(2);
    expect(result.get('s1')).toBe(1);
  });

  it('moves dragged item above target in the movable list', () => {
    const layers: LayerItem[] = [
      { kind: 'slot', id: 's0', zIndex: 3, arrayIndex: 0, index: 0, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'slot', id: 's1', zIndex: 2, arrayIndex: 1, index: 1, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'slot', id: 's2', zIndex: 1, arrayIndex: 2, index: 2, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's2', 's0');
    expect(result.get('s2')).toBeGreaterThan(result.get('s0')!);
  });

  it('assigns sequential z-indices from top (highest) to bottom (lowest)', () => {
    const layers: LayerItem[] = [
      ...makeLayerList(3),
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's2', 's0');
    const values = Array.from(result.values());
    expect(values[0]).toBeGreaterThan(values[1]);
    expect(values[1]).toBeGreaterThan(values[2]);
  });

  it('ignores background and mask layers when reordering', () => {
    const layers: LayerItem[] = [
      { kind: 'slot', id: 's0', zIndex: 2, arrayIndex: 0, index: 0, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'slot', id: 's1', zIndex: 1, arrayIndex: 1, index: 1, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'mask', id: 'mask-s0', parentSlotId: 's0', zIndex: 2, arrayIndex: -1, name: '', visible: true, depth: 1, ancestorGroupIds: [] },
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's1', 's0');
    expect(result.size).toBe(2);
    expect(result.has('mask-s0')).toBe(false);
    expect(result.has('background')).toBe(false);
  });

  it('ignores group layers when reordering', () => {
    const layers: LayerItem[] = [
      {
        kind: 'group',
        id: 'g0',
        group: {} as any,
        zIndex: 2,
        arrayIndex: 0,
        name: '',
        visible: true,
        locked: false,
        depth: 0,
        ancestorGroupIds: [],
        totalDescendantCount: 0,
        descendantSlotIds: [],
      },
      { kind: 'slot', id: 's0', zIndex: 1, arrayIndex: 1, index: 1, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's0', 'g0');
    expect(result.size).toBe(1);
    expect(result.has('g0')).toBe(false);
  });

  it('places dragged item at bottom when target is background', () => {
    const layers: LayerItem[] = [
      { kind: 'slot', id: 's0', zIndex: 2, arrayIndex: 0, index: 0, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'slot', id: 's1', zIndex: 1, arrayIndex: 1, index: 1, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's0', 'background');
    expect(result.get('s0')).toBeLessThan(result.get('s1')!);
  });

  it('handles moving item within same level', () => {
    const layers: LayerItem[] = [
      { kind: 'slot', id: 's0', zIndex: 3, arrayIndex: 0, index: 0, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'slot', id: 's1', zIndex: 2, arrayIndex: 1, index: 1, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'slot', id: 's2', zIndex: 1, arrayIndex: 2, index: 2, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's2', 's1');
    const values = Array.from(result.values()).sort((a, b) => b - a);
    expect(values).toEqual([3, 2, 1]);
  });

  it('handles graphic overlays in reordering', () => {
    const layers: LayerItem[] = [
      { kind: 'slot', id: 's0', zIndex: 2, arrayIndex: 0, index: 0, name: '', visible: true, locked: false, depth: 0, ancestorGroupIds: [] },
      { kind: 'graphic', id: 'g0', zIndex: 1, arrayIndex: 0, name: '', visible: true, locked: false, opacity: 1, depth: 0, ancestorGroupIds: [] },
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 'g0', 's0');
    expect(result.get('g0')).toBeGreaterThan(result.get('s0')!);
  });

  it('returns empty map for empty movable list', () => {
    const layers: LayerItem[] = [
      { kind: 'background', id: 'background', zIndex: 0, arrayIndex: -1, name: '', visible: true, depth: 0, ancestorGroupIds: [] },
    ];
    const result = computeReorderedZIndices(layers, 's0', 's1');
    expect(result.size).toBe(0);
  });
});
