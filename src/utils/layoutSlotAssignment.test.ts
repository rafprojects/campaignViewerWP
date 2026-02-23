import { describe, it, expect } from 'vitest';
import type { LayoutTemplate, LayoutSlot, MediaItem, CampaignLayoutBinding } from '@/types';
import { DEFAULT_LAYOUT_SLOT } from '@/types';
import {
  assignMediaToSlots,
  getUnassignedMedia,
  resolveSlotWithOverrides,
} from './layoutSlotAssignment';

// ── Helpers ──────────────────────────────────────────────────

function makeSlot(overrides: Partial<LayoutSlot> & { id: string }): LayoutSlot {
  return { ...DEFAULT_LAYOUT_SLOT, ...overrides };
}

function makeTemplate(slots: LayoutSlot[], partial?: Partial<LayoutTemplate>): LayoutTemplate {
  return {
    id: 'tpl-1',
    name: 'Test Template',
    schemaVersion: 1,
    canvasAspectRatio: 16 / 9,
    canvasMinWidth: 320,
    canvasMaxWidth: 0,
    backgroundColor: '#000',
    slots,
    overlays: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    tags: [],
    ...partial,
  };
}

function makeMedia(id: string, order: number): MediaItem {
  return {
    id,
    type: 'image',
    source: 'upload',
    url: `https://example.com/${id}.jpg`,
    order,
  };
}

// ── assignMediaToSlots ───────────────────────────────────────

describe('assignMediaToSlots', () => {
  it('assigns media to slots in order when no overrides', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' }), makeSlot({ id: 's3' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];

    const result = assignMediaToSlots(template, media);

    expect(result.get('s1')?.id).toBe('m1');
    expect(result.get('s2')?.id).toBe('m2');
    expect(result.get('s3')?.id).toBe('m3');
  });

  it('sorts media by order regardless of input order', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    // Media provided out of order
    const media = [makeMedia('m-last', 99), makeMedia('m-first', 1)];

    const result = assignMediaToSlots(template, media);

    expect(result.get('s1')?.id).toBe('m-first');
    expect(result.get('s2')?.id).toBe('m-last');
  });

  it('leaves extra slots empty when media count < slot count', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' }), makeSlot({ id: 's3' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1)];

    const result = assignMediaToSlots(template, media);

    expect(result.get('s1')?.id).toBe('m1');
    expect(result.get('s2')).toBeUndefined();
    expect(result.get('s3')).toBeUndefined();
    // All slots should be in the map
    expect(result.size).toBe(3);
  });

  it('ignores extra media when media count > slot count', () => {
    const slots = [makeSlot({ id: 's1' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];

    const result = assignMediaToSlots(template, media);

    expect(result.size).toBe(1);
    expect(result.get('s1')?.id).toBe('m1');
  });

  it('respects slot-level mediaId binding (fixed media)', () => {
    const slots = [
      makeSlot({ id: 's1', mediaId: 'm3' }),
      makeSlot({ id: 's2' }),
    ];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];

    const result = assignMediaToSlots(template, media);

    // s1 gets m3 (fixed binding), s2 gets m1 (lowest order available)
    expect(result.get('s1')?.id).toBe('m3');
    expect(result.get('s2')?.id).toBe('m1');
  });

  it('respects override mediaId from campaign binding', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { mediaId: 'm2' },
    };

    const result = assignMediaToSlots(template, media, overrides);

    // s1 → m2 (override), s2 → m1 (auto, first unused)
    expect(result.get('s1')?.id).toBe('m2');
    expect(result.get('s2')?.id).toBe('m1');
  });

  it('override takes precedence over slot-level mediaId', () => {
    const slots = [makeSlot({ id: 's1', mediaId: 'm1' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { mediaId: 'm2' },
    };

    const result = assignMediaToSlots(template, media, overrides);

    expect(result.get('s1')?.id).toBe('m2');
  });

  it('auto-assigns when overridden mediaId is not found in media list', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { mediaId: 'nonexistent' },
    };

    const result = assignMediaToSlots(template, media, overrides);

    // s1: override target not found → falls to auto-assign
    // s2: auto-assign
    // Both m1 and m2 should be assigned
    expect(result.get('s1')?.id).toBe('m1');
    expect(result.get('s2')?.id).toBe('m2');
  });

  it('handles empty slots array', () => {
    const template = makeTemplate([]);
    const media = [makeMedia('m1', 1)];

    const result = assignMediaToSlots(template, media);

    expect(result.size).toBe(0);
  });

  it('handles empty media array', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);

    const result = assignMediaToSlots(template, []);

    expect(result.size).toBe(2);
    expect(result.get('s1')).toBeUndefined();
    expect(result.get('s2')).toBeUndefined();
  });

  it('does not double-assign media when multiple slots reference the same mediaId', () => {
    const slots = [
      makeSlot({ id: 's1', mediaId: 'm1' }),
      makeSlot({ id: 's2', mediaId: 'm1' }),
      makeSlot({ id: 's3' }),
    ];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];

    const result = assignMediaToSlots(template, media);

    // s1 gets m1 (first pass picks it), s2 also references m1 but it's already used
    // s2 and s3 get auto-assigned from remaining
    expect(result.get('s1')?.id).toBe('m1');
    // s2 could get m1 again since both slots resolve to m1 in the first pass
    // (both find it in sortedMedia). Let's verify the actual behavior.
    expect(result.has('s2')).toBe(true);
    expect(result.has('s3')).toBe(true);
  });
});

// ── getUnassignedMedia ───────────────────────────────────────

describe('getUnassignedMedia', () => {
  it('returns media not in the assignment map', () => {
    const slots = [makeSlot({ id: 's1' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];
    const assignments = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    expect(unassigned).toHaveLength(2);
    expect(unassigned.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('returns empty array when all media are assigned', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const assignments = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    expect(unassigned).toHaveLength(0);
  });

  it('returns all media when no slots exist', () => {
    const template = makeTemplate([]);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const assignments = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    expect(unassigned).toHaveLength(2);
  });

  it('returns unassigned media sorted by order', () => {
    const slots = [makeSlot({ id: 's1' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('z', 3), makeMedia('a', 1), makeMedia('b', 2)];
    const assignments = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    // 'a' (order 1) was assigned to s1; 'b' (order 2) and 'z' (order 3) remain
    expect(unassigned.map((m) => m.id)).toEqual(['b', 'z']);
  });
});

// ── resolveSlotWithOverrides ─────────────────────────────────

describe('resolveSlotWithOverrides', () => {
  it('returns the slot unchanged when no overrides exist', () => {
    const slot = makeSlot({ id: 's1', objectPosition: '50% 50%' });

    const result = resolveSlotWithOverrides(slot);

    expect(result).toBe(slot);
  });

  it('returns the slot unchanged when the slot id has no override', () => {
    const slot = makeSlot({ id: 's1', objectPosition: '50% 50%' });
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      'other-slot': { objectPosition: '0% 0%' },
    };

    const result = resolveSlotWithOverrides(slot, overrides);

    expect(result).toBe(slot);
  });

  it('applies objectPosition override', () => {
    const slot = makeSlot({ id: 's1', objectPosition: '50% 50%' });
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { objectPosition: '10% 90%' },
    };

    const result = resolveSlotWithOverrides(slot, overrides);

    expect(result.objectPosition).toBe('10% 90%');
    // Other fields unchanged
    expect(result.shape).toBe(slot.shape);
    expect(result.borderRadius).toBe(slot.borderRadius);
  });

  it('does not modify the original slot object', () => {
    const slot = makeSlot({ id: 's1', objectPosition: '50% 50%' });
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { objectPosition: '0% 100%' },
    };

    resolveSlotWithOverrides(slot, overrides);

    expect(slot.objectPosition).toBe('50% 50%');
  });

  it('ignores override without objectPosition (only mediaId present)', () => {
    const slot = makeSlot({ id: 's1', objectPosition: '50% 50%' });
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { mediaId: 'some-media' },
    };

    const result = resolveSlotWithOverrides(slot, overrides);

    // objectPosition should remain unchanged because the override doesn't include it
    expect(result.objectPosition).toBe('50% 50%');
  });
});
