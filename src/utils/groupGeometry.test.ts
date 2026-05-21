/**
 * P30-G Tests — groupGeometry utility
 *
 * Covers: buildGroupMap, collectDescendantSlotIds, collectDescendantGroupIds,
 * getAncestorChain, computeGroupRect, refreshGroupRects, migrateGroupsToP30G,
 * computeGroupMoveDelta, computeGroupResizeDelta, reparentGroup,
 * dissolveGroupInHierarchy.
 */
import { describe, it, expect } from 'vitest';
import type { LayoutGroup, LayoutSlot } from '@/types';
import {
  buildGroupMap,
  collectDescendantSlotIds,
  collectDescendantGroupIds,
  getAncestorChain,
  computeGroupRect,
  refreshGroupRects,
  migrateGroupsToP30G,
  computeGroupMoveDelta,
  computeGroupResizeDelta,
  reparentGroup,
  dissolveGroupInHierarchy,
} from '@/utils/groupGeometry';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeSlot = (id: string, x: number, y: number, w: number, h: number): LayoutSlot => ({
  id, x, y, width: w, height: h, zIndex: 1,
  shape: 'rectangle', borderRadius: 0, borderWidth: 0, borderColor: '#fff',
  objectFit: 'cover', objectPosition: '50% 50%', clickAction: 'lightbox', hoverEffect: 'none',
});

const makeGroup = (id: string, memberIds: string[], overrides: Partial<LayoutGroup> = {}): LayoutGroup => ({
  id,
  memberIds,
  childGroupIds: [],
  parentGroupId: null,
  ...overrides,
});

// ── buildGroupMap ─────────────────────────────────────────────────────────────

describe('buildGroupMap', () => {
  it('creates a map keyed by group id', () => {
    const groups = [makeGroup('g1', ['s1']), makeGroup('g2', ['s2'])];
    const map = buildGroupMap(groups);
    expect(map.size).toBe(2);
    expect(map.get('g1')).toBe(groups[0]);
    expect(map.get('g2')).toBe(groups[1]);
  });

  it('returns empty map for empty input', () => {
    expect(buildGroupMap([]).size).toBe(0);
  });
});

// ── collectDescendantSlotIds ─────────────────────────────────────────────────

describe('collectDescendantSlotIds', () => {
  it('returns direct member IDs for a flat group', () => {
    const g = makeGroup('g1', ['s1', 's2']);
    const map = buildGroupMap([g]);
    expect(collectDescendantSlotIds('g1', map).sort()).toEqual(['s1', 's2']);
  });

  it('returns all descendants for a 2-level nested group', () => {
    // g_parent → [child: g_child], g_child → ['s1', 's2']
    const gParent = makeGroup('gP', [], { childGroupIds: ['gC'], parentGroupId: null });
    const gChild = makeGroup('gC', ['s1', 's2'], { parentGroupId: 'gP' });
    const map = buildGroupMap([gParent, gChild]);
    expect(collectDescendantSlotIds('gP', map).sort()).toEqual(['s1', 's2']);
  });

  it('returns all descendants for a 3-level nested group', () => {
    const gA = makeGroup('gA', [], { childGroupIds: ['gB'] });
    const gB = makeGroup('gB', ['s1'], { childGroupIds: ['gC'], parentGroupId: 'gA' });
    const gC = makeGroup('gC', ['s2', 's3'], { parentGroupId: 'gB' });
    const map = buildGroupMap([gA, gB, gC]);
    const ids = collectDescendantSlotIds('gA', map).sort();
    expect(ids).toEqual(['s1', 's2', 's3']);
  });

  it('returns empty array for unknown groupId', () => {
    expect(collectDescendantSlotIds('nonexistent', buildGroupMap([]))).toEqual([]);
  });

  it('does not loop infinitely on a cycle', () => {
    // gA → gB → gA (invalid but should not crash)
    const gA = makeGroup('gA', [], { childGroupIds: ['gB'] });
    const gB = makeGroup('gB', [], { childGroupIds: ['gA'] });
    const map = buildGroupMap([gA, gB]);
    expect(() => collectDescendantSlotIds('gA', map)).not.toThrow();
  });
});

// ── collectDescendantGroupIds ────────────────────────────────────────────────

describe('collectDescendantGroupIds', () => {
  it('returns empty for a leaf group (no children)', () => {
    const g = makeGroup('g1', ['s1']);
    expect(collectDescendantGroupIds('g1', buildGroupMap([g]))).toEqual([]);
  });

  it('returns all child group IDs recursively', () => {
    const gA = makeGroup('gA', [], { childGroupIds: ['gB'] });
    const gB = makeGroup('gB', [], { childGroupIds: ['gC'], parentGroupId: 'gA' });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gB' });
    const map = buildGroupMap([gA, gB, gC]);
    const ids = collectDescendantGroupIds('gA', map).sort();
    expect(ids).toEqual(['gB', 'gC']);
  });

  it('does not include the root groupId itself', () => {
    const g = makeGroup('g1', [], { childGroupIds: ['g2'] });
    const g2 = makeGroup('g2', ['s1']);
    const map = buildGroupMap([g, g2]);
    expect(collectDescendantGroupIds('g1', map)).not.toContain('g1');
  });
});

// ── getAncestorChain ──────────────────────────────────────────────────────────

describe('getAncestorChain', () => {
  it('returns empty array for a top-level group', () => {
    const g = makeGroup('g1', ['s1'], { parentGroupId: null });
    expect(getAncestorChain('g1', buildGroupMap([g]))).toEqual([]);
  });

  it('returns immediate parent for a 1-level nested group', () => {
    const gP = makeGroup('gP', [], { childGroupIds: ['gC'] });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gP' });
    const map = buildGroupMap([gP, gC]);
    expect(getAncestorChain('gC', map)).toEqual(['gP']);
  });

  it('returns full ancestor chain from immediate parent to root', () => {
    const gA = makeGroup('gA', [], { childGroupIds: ['gB'] });
    const gB = makeGroup('gB', [], { childGroupIds: ['gC'], parentGroupId: 'gA' });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gB' });
    const map = buildGroupMap([gA, gB, gC]);
    expect(getAncestorChain('gC', map)).toEqual(['gB', 'gA']);
  });

  it('guards against cycles', () => {
    const gA = makeGroup('gA', [], { childGroupIds: ['gB'], parentGroupId: 'gB' });
    const gB = makeGroup('gB', [], { childGroupIds: ['gA'], parentGroupId: 'gA' });
    const map = buildGroupMap([gA, gB]);
    expect(() => getAncestorChain('gA', map)).not.toThrow();
  });
});

// ── computeGroupRect ─────────────────────────────────────────────────────────

describe('computeGroupRect', () => {
  it('returns null for unknown groupId', () => {
    const map = buildGroupMap([]);
    const slotMap = new Map<string, LayoutSlot>();
    expect(computeGroupRect('nonexistent', slotMap, map)).toBeNull();
  });

  it('returns null for a group with no resolvable slots', () => {
    const g = makeGroup('g1', []);
    const map = buildGroupMap([g]);
    expect(computeGroupRect('g1', new Map(), map)).toBeNull();
  });

  it('computes bounding box for a flat group', () => {
    // s1: (10,10) 20x20 → right=30, bottom=30
    // s2: (5,5) 10x10 → right=15, bottom=15
    // union: x=5, y=5, w=25, h=25
    const g = makeGroup('g1', ['s1', 's2']);
    const slotMap = new Map([
      ['s1', makeSlot('s1', 10, 10, 20, 20)],
      ['s2', makeSlot('s2', 5, 5, 10, 10)],
    ]);
    const rect = computeGroupRect('g1', slotMap, buildGroupMap([g]));
    expect(rect).toEqual({ x: 5, y: 5, width: 25, height: 25 });
  });

  it('includes child group slots in bounding box', () => {
    // gParent has no direct members; gChild has s1 at (0,0) 10x10
    const gParent = makeGroup('gP', [], { childGroupIds: ['gC'] });
    const gChild = makeGroup('gC', ['s1'], { parentGroupId: 'gP' });
    const slotMap = new Map([['s1', makeSlot('s1', 0, 0, 10, 10)]]);
    const map = buildGroupMap([gParent, gChild]);
    const rect = computeGroupRect('gP', slotMap, map);
    expect(rect).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

// ── refreshGroupRects ────────────────────────────────────────────────────────

describe('refreshGroupRects', () => {
  it('updates group x/y/width/height in-place', () => {
    const g = makeGroup('g1', ['s1']);
    const slots = [makeSlot('s1', 20, 30, 15, 10)];
    refreshGroupRects([g], slots);
    expect(g.x).toBe(20);
    expect(g.y).toBe(30);
    expect(g.width).toBe(15);
    expect(g.height).toBe(10);
  });

  it('handles empty groups array', () => {
    expect(() => refreshGroupRects([], [])).not.toThrow();
  });
});

// ── migrateGroupsToP30G ───────────────────────────────────────────────────────

describe('migrateGroupsToP30G', () => {
  it('adds childGroupIds and parentGroupId to flat P29-G-C groups', () => {
    const flat: LayoutGroup[] = [{ id: 'g1', memberIds: ['s1'] } as LayoutGroup];
    const slots = [makeSlot('s1', 0, 0, 10, 10)];
    const migrated = migrateGroupsToP30G(flat, slots);
    expect(migrated[0]).toMatchObject({
      id: 'g1',
      memberIds: ['s1'],
      childGroupIds: [],
      parentGroupId: null,
    });
  });

  it('computes initial bounding boxes for migrated groups', () => {
    const flat: LayoutGroup[] = [{ id: 'g1', memberIds: ['s1'] } as LayoutGroup];
    const slots = [makeSlot('s1', 5, 10, 20, 15)];
    const migrated = migrateGroupsToP30G(flat, slots);
    expect(migrated[0].x).toBe(5);
    expect(migrated[0].y).toBe(10);
    expect(migrated[0].width).toBe(20);
    expect(migrated[0].height).toBe(15);
  });

  it('is idempotent — already-migrated groups are left unchanged', () => {
    const already = makeGroup('g1', ['s1'], { x: 0, y: 0, width: 10, height: 10 });
    const result = migrateGroupsToP30G([already], [makeSlot('s1', 0, 0, 10, 10)]);
    expect(result[0]).toBe(already); // same reference
  });
});

// ── computeGroupMoveDelta ─────────────────────────────────────────────────────

describe('computeGroupMoveDelta', () => {
  it('returns updated positions for all descendant slots', () => {
    const g = makeGroup('g1', ['s1', 's2']);
    const slotMap = new Map([
      ['s1', makeSlot('s1', 10, 20, 5, 5)],
      ['s2', makeSlot('s2', 30, 40, 5, 5)],
    ]);
    const delta = computeGroupMoveDelta('g1', 5, -3, buildGroupMap([g]), slotMap);
    expect(delta.get('s1')).toEqual({ x: 15, y: 17 });
    expect(delta.get('s2')).toEqual({ x: 35, y: 37 });
  });

  it('includes slots from nested child groups', () => {
    const gP = makeGroup('gP', [], { childGroupIds: ['gC'] });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gP' });
    const slotMap = new Map([['s1', makeSlot('s1', 10, 10, 5, 5)]]);
    const map = buildGroupMap([gP, gC]);
    const delta = computeGroupMoveDelta('gP', 10, 10, map, slotMap);
    expect(delta.get('s1')).toEqual({ x: 20, y: 20 });
  });

  it('returns empty map for unknown group', () => {
    const delta = computeGroupMoveDelta('nonexistent', 5, 5, buildGroupMap([]), new Map());
    expect(delta.size).toBe(0);
  });
});

// ── computeGroupResizeDelta ───────────────────────────────────────────────────

describe('computeGroupResizeDelta', () => {
  it('scales all descendant slots proportionally from the group origin', () => {
    // Group at (0,0) size 100x100. Slots at (0,0) 50x50 and (50,50) 50x50.
    // Resize to 200x200 (scaleX=2, scaleY=2).
    // Expected: s1 stays at (0,0) but becomes 100x100; s2 → (100,100) 100x100.
    const g = makeGroup('g1', ['s1', 's2'], { x: 0, y: 0, width: 100, height: 100 });
    const slotMap = new Map([
      ['s1', makeSlot('s1', 0, 0, 50, 50)],
      ['s2', makeSlot('s2', 50, 50, 50, 50)],
    ]);
    const result = computeGroupResizeDelta('g1', 200, 200, buildGroupMap([g]), slotMap);
    expect(result.get('s1')).toEqual({ x: 0, y: 0, width: 100, height: 100 });
    expect(result.get('s2')).toEqual({ x: 100, y: 100, width: 100, height: 100 });
  });

  it('returns empty map for unknown group', () => {
    const result = computeGroupResizeDelta('nonexistent', 100, 100, buildGroupMap([]), new Map());
    expect(result.size).toBe(0);
  });
});

// ── reparentGroup ─────────────────────────────────────────────────────────────

describe('reparentGroup', () => {
  it('reparents a top-level group under a new parent', () => {
    const gA = makeGroup('gA', ['s1']);
    const gB = makeGroup('gB', ['s2']);
    const result = reparentGroup('gA', 'gB', [gA, gB]);
    const rA = result.find((g) => g.id === 'gA')!;
    const rB = result.find((g) => g.id === 'gB')!;
    expect(rA.parentGroupId).toBe('gB');
    expect(rB.childGroupIds).toContain('gA');
  });

  it('moves a group back to top-level when newParentId is null', () => {
    const gP = makeGroup('gP', [], { childGroupIds: ['gC'] });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gP' });
    const result = reparentGroup('gC', null, [gP, gC]);
    const rC = result.find((g) => g.id === 'gC')!;
    const rP = result.find((g) => g.id === 'gP')!;
    expect(rC.parentGroupId).toBeNull();
    expect(rP.childGroupIds).not.toContain('gC');
  });

  it('rejects a reparent that would create a cycle', () => {
    const gA = makeGroup('gA', [], { childGroupIds: ['gB'] });
    const gB = makeGroup('gB', [], { parentGroupId: 'gA' });
    // Trying to reparent gA under gB would create gA→gB→gA cycle
    const result = reparentGroup('gA', 'gB', [gA, gB]);
    // Should return unchanged
    expect(result).toEqual([gA, gB]);
  });

  it('rejects reparenting a group under itself', () => {
    const g = makeGroup('g1', ['s1']);
    const result = reparentGroup('g1', 'g1', [g]);
    expect(result).toEqual([g]);
  });

  it('is a no-op when parent is unchanged', () => {
    const gP = makeGroup('gP', [], { childGroupIds: ['gC'] });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gP' });
    const result = reparentGroup('gC', 'gP', [gP, gC]);
    expect(result).toEqual([gP, gC]);
  });
});

// ── dissolveGroupInHierarchy ─────────────────────────────────────────────────

describe('dissolveGroupInHierarchy', () => {
  it('removes the group from the array', () => {
    const g = makeGroup('g1', ['s1']);
    const result = dissolveGroupInHierarchy('g1', [g]);
    expect(result.find((g) => g.id === 'g1')).toBeUndefined();
  });

  it('promotes child groups to the parent of the dissolved group', () => {
    const gGrand = makeGroup('gGrand', [], { childGroupIds: ['gParent'] });
    const gParent = makeGroup('gParent', [], { childGroupIds: ['gChild'], parentGroupId: 'gGrand' });
    const gChild = makeGroup('gChild', ['s1'], { parentGroupId: 'gParent' });
    const result = dissolveGroupInHierarchy('gParent', [gGrand, gParent, gChild]);
    const rGrand = result.find((g) => g.id === 'gGrand')!;
    const rChild = result.find((g) => g.id === 'gChild')!;
    expect(rGrand.childGroupIds).toContain('gChild');
    expect(rGrand.childGroupIds).not.toContain('gParent');
    expect(rChild.parentGroupId).toBe('gGrand');
  });

  it('promotes child groups to top-level when dissolved group was top-level', () => {
    const gP = makeGroup('gP', [], { childGroupIds: ['gC'] });
    const gC = makeGroup('gC', ['s1'], { parentGroupId: 'gP' });
    const result = dissolveGroupInHierarchy('gP', [gP, gC]);
    const rC = result.find((g) => g.id === 'gC')!;
    expect(rC.parentGroupId).toBeNull();
  });

  it('returns unchanged array for unknown groupId', () => {
    const g = makeGroup('g1', ['s1']);
    const result = dissolveGroupInHierarchy('nonexistent', [g]);
    expect(result).toEqual([g]);
  });
});
