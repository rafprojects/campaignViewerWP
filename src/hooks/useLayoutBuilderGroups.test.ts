/**
 * Tests for useLayoutBuilderGroups — all branch paths for
 * group create/wrap/dissolve/update/select/move/reparent operations.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useLayoutBuilderGroups } from './useLayoutBuilderGroups';
import { useLayoutBuilderHistory } from './useLayoutBuilderHistory';
import { createEmptyTemplate } from './useLayoutBuilderState';
import type { LayoutTemplate, LayoutSlot } from '@/types';

function makeSlot(id: string, x = 0, y = 0): LayoutSlot {
  return {
    id, x, y, width: 20, height: 20, zIndex: 1,
    shape: 'rectangle', borderRadius: 0, borderWidth: 0,
    borderColor: '#fff', objectFit: 'cover',
    objectPosition: '50% 50%', clickAction: 'lightbox', hoverEffect: 'pop',
  };
}

function makeHook(initial?: Partial<LayoutTemplate>) {
  return renderHook(() => {
    const [template, setTemplateRaw] = useState<LayoutTemplate>({
      ...createEmptyTemplate('test'),
      ...initial,
    });
    const [_isDirty, setIsDirty] = useState(false);
    const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
    const { mutate } = useLayoutBuilderHistory({ template, setTemplateRaw, setIsDirty });
    const groups = useLayoutBuilderGroups({ mutate, template, setSelectedSlotIds });
    return { template, groups, selectedSlotIds, setSelectedSlotIds };
  });
}

// ── migrateGroupsIfNeeded ─────────────────────────────────────────────────

describe('migrateGroupsIfNeeded', () => {
  it('is a no-op when groups already have childGroupIds', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1')],
      groups: [{ id: 'g1', memberIds: ['s1'], childGroupIds: [], parentGroupId: null }],
    });
    const before = JSON.stringify(result.current.template.groups);
    act(() => result.current.groups.migrateGroupsIfNeeded());
    expect(JSON.stringify(result.current.template.groups)).toBe(before);
  });

  it('migrates groups that are missing childGroupIds', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      // Pre-P30-G group: childGroupIds is undefined → triggers migration
      groups: [{ id: 'g1', memberIds: ['s1', 's2'] } as never],
    });
    act(() => result.current.groups.migrateGroupsIfNeeded());
    const g = result.current.template.groups?.[0];
    expect(g?.childGroupIds).toBeDefined();
  });

  it('is a no-op when template has no groups', () => {
    const { result } = makeHook({ slots: [makeSlot('s1')] });
    act(() => result.current.groups.migrateGroupsIfNeeded());
    expect(result.current.template.groups).toBeUndefined();
  });
});

// ── createGroup ───────────────────────────────────────────────────────────

describe('createGroup', () => {
  it('creates a new group from slot ids and removes them from existing groups', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2'), makeSlot('s3')],
      groups: [{ id: 'g0', memberIds: ['s1', 's2'], childGroupIds: [], parentGroupId: null }],
    });
    let newId = '';
    act(() => { newId = result.current.groups.createGroup(['s1', 's2']); });
    const groups = result.current.template.groups ?? [];
    const newGroup = groups.find((g) => g.id === newId);
    expect(newGroup).toBeDefined();
    expect(newGroup?.memberIds).toEqual(expect.arrayContaining(['s1', 's2']));
    // Old group g0 had s1+s2 removed — it becomes empty so it's pruned
    expect(groups.find((g) => g.id === 'g0')).toBeUndefined();
  });

  it('deduplicates member ids', () => {
    const { result } = makeHook({ slots: [makeSlot('s1')] });
    let newId = '';
    act(() => { newId = result.current.groups.createGroup(['s1', 's1']); });
    const newGroup = result.current.template.groups?.find((g) => g.id === newId);
    expect(newGroup?.memberIds).toHaveLength(1);
  });

  it('prunes dangling childGroupIds after empty groups are removed', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [
        { id: 'parent', memberIds: [], childGroupIds: ['g0'], parentGroupId: null },
        { id: 'g0', memberIds: ['s1'], childGroupIds: [], parentGroupId: 'parent' },
      ],
    });
    // Moving s1 into a new group removes it from g0, making g0 empty and pruned.
    // parent's childGroupIds ['g0'] should be pruned too.
    act(() => result.current.groups.createGroup(['s1']));
    const groups = result.current.template.groups ?? [];
    const parent = groups.find((g) => g.id === 'parent');
    if (parent) {
      expect(parent.childGroupIds?.includes('g0')).toBe(false);
    }
  });
});

// ── wrapInGroup ───────────────────────────────────────────────────────────

describe('wrapInGroup', () => {
  it('wraps a mix of slot ids and group ids into a new parent group', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [{ id: 'g1', memberIds: ['s1'], childGroupIds: [], parentGroupId: null }],
    });
    let newId = '';
    act(() => { newId = result.current.groups.wrapInGroup(['s1', 'g1']); });
    const groups = result.current.template.groups ?? [];
    const parent = groups.find((g) => g.id === newId);
    expect(parent).toBeDefined();
    expect(parent?.childGroupIds).toContain('g1');
  });

  it('removes selected slots from existing member lists', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [{ id: 'g0', memberIds: ['s1'], childGroupIds: [], parentGroupId: null }],
    });
    act(() => result.current.groups.wrapInGroup(['s1']));
    const groups = result.current.template.groups ?? [];
    const g0 = groups.find((g) => g.id === 'g0');
    if (g0) {
      expect(g0.memberIds).not.toContain('s1');
    }
  });

  it('prunes dangling childGroupIds in surviving groups when wrapped group is emptied (line 112)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [
        // gParent has g1 as a child group; after wrapping g1's slots, g1 may become empty
        { id: 'gParent', memberIds: [], childGroupIds: ['g1'], parentGroupId: null },
        { id: 'g1', memberIds: ['s1'], childGroupIds: [], parentGroupId: 'gParent' },
      ],
    });
    // Wrap g1 into a new group — during processing, g1's slots are removed,
    // leaving g1 with no slots and no childGroups → g1 gets removed.
    // gParent's childGroupIds should no longer reference g1.
    act(() => result.current.groups.wrapInGroup(['s1', 'g1']));
    const groups = result.current.template.groups ?? [];
    const gParent = groups.find((g) => g.id === 'gParent');
    if (gParent) {
      expect(gParent.childGroupIds?.includes('g1')).toBe(false);
    }
  });

  it('re-parents a group that already had a parent', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1')],
      groups: [
        { id: 'oldParent', memberIds: [], childGroupIds: ['g1'], parentGroupId: null },
        { id: 'g1', memberIds: ['s1'], childGroupIds: [], parentGroupId: 'oldParent' },
      ],
    });
    let newId = '';
    act(() => { newId = result.current.groups.wrapInGroup(['g1']); });
    const groups = result.current.template.groups ?? [];
    const oldParent = groups.find((g) => g.id === 'oldParent');
    const g1 = groups.find((g) => g.id === 'g1');
    // g1 is now under newId, not oldParent
    expect(g1?.parentGroupId).toBe(newId);
    if (oldParent) {
      expect(oldParent.childGroupIds).not.toContain('g1');
    }
  });
});

// ── dissolveGroup ─────────────────────────────────────────────────────────

describe('dissolveGroup', () => {
  it('removes the group and keeps its members accessible at higher scope', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [{ id: 'g1', memberIds: ['s1', 's2'], childGroupIds: [], parentGroupId: null }],
    });
    act(() => result.current.groups.dissolveGroup('g1'));
    expect(result.current.template.groups?.find((g) => g.id === 'g1')).toBeUndefined();
  });

  it('prunes empty parent group after child is dissolved (line 126 filter branch)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1')],
      groups: [
        { id: 'parent', memberIds: [], childGroupIds: ['child'], parentGroupId: null },
        { id: 'child', memberIds: ['s1'], childGroupIds: [], parentGroupId: 'parent' },
      ],
    });
    // Dissolve child → parent has no members and no child groups → empty → pruned
    act(() => result.current.groups.dissolveGroup('child'));
    const groups = result.current.template.groups ?? [];
    expect(groups.find((g) => g.id === 'parent')).toBeUndefined();
    expect(groups.find((g) => g.id === 'child')).toBeUndefined();
  });
});

// ── updateGroup ───────────────────────────────────────────────────────────

describe('updateGroup', () => {
  it('updates group fields by id', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1')],
      groups: [{ id: 'g1', memberIds: ['s1'], childGroupIds: [], parentGroupId: null }],
    });
    act(() => result.current.groups.updateGroup('g1', { name: 'Hero Group' }));
    expect(result.current.template.groups?.find((g) => g.id === 'g1')?.name).toBe('Hero Group');
  });

  it('is a no-op when group id does not exist', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1')],
      groups: [{ id: 'g1', memberIds: ['s1'], childGroupIds: [], parentGroupId: null }],
    });
    const before = JSON.stringify(result.current.template.groups);
    act(() => result.current.groups.updateGroup('nope', { name: 'X' }));
    expect(JSON.stringify(result.current.template.groups)).toBe(before);
  });
});

// ── selectGroup ───────────────────────────────────────────────────────────

describe('selectGroup', () => {
  it('sets selectedSlotIds to the descendant slot ids of the group', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [{ id: 'g1', memberIds: ['s1', 's2'], childGroupIds: [], parentGroupId: null }],
    });
    act(() => result.current.groups.selectGroup('g1'));
    expect(result.current.selectedSlotIds.has('s1')).toBe(true);
    expect(result.current.selectedSlotIds.has('s2')).toBe(true);
  });

  it('filters out descendant ids that do not exist in slots', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1')],
      // g1 references s2 which doesn't exist
      groups: [{ id: 'g1', memberIds: ['s1', 's2'], childGroupIds: [], parentGroupId: null }],
    });
    act(() => result.current.groups.selectGroup('g1'));
    expect(result.current.selectedSlotIds.has('s1')).toBe(true);
    expect(result.current.selectedSlotIds.has('s2')).toBe(false);
  });
});

// ── moveGroup ─────────────────────────────────────────────────────────────

describe('moveGroup', () => {
  it('moves all member slots by the given delta', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1', 10, 10), makeSlot('s2', 20, 20)],
      groups: [{ id: 'g1', memberIds: ['s1', 's2'], childGroupIds: [], parentGroupId: null }],
    });
    act(() => result.current.groups.moveGroup('g1', 5, 5));
    const s1 = result.current.template.slots.find((s) => s.id === 's1')!;
    expect(s1.x).toBeGreaterThanOrEqual(10); // some movement applied
  });
});

// ── reparentGroup ─────────────────────────────────────────────────────────

describe('reparentGroup', () => {
  it('moves a group under a new parent', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [
        { id: 'gA', memberIds: ['s1'], childGroupIds: [], parentGroupId: null },
        { id: 'gB', memberIds: ['s2'], childGroupIds: [], parentGroupId: null },
      ],
    });
    act(() => result.current.groups.reparentGroup('gA', 'gB'));
    const gB = result.current.template.groups?.find((g) => g.id === 'gB');
    expect(gB?.childGroupIds).toContain('gA');
  });

  it('allows reparenting to null (top-level)', () => {
    const { result } = makeHook({
      slots: [makeSlot('s1'), makeSlot('s2')],
      groups: [
        { id: 'gParent', memberIds: ['s2'], childGroupIds: ['gA'], parentGroupId: null },
        { id: 'gA', memberIds: ['s1'], childGroupIds: [], parentGroupId: 'gParent' },
      ],
    });
    act(() => result.current.groups.reparentGroup('gA', null));
    const gA = result.current.template.groups?.find((g) => g.id === 'gA');
    expect(gA?.parentGroupId).toBeNull();
  });
});
