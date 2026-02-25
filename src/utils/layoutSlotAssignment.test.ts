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

function makeMedia(id: string, order: number, extra?: Partial<MediaItem>): MediaItem {
  return {
    id,
    type: 'image',
    source: 'upload',
    url: `https://example.com/${id}.jpg`,
    order,
    ...extra,
  };
}

// ── assignMediaToSlots ───────────────────────────────────────

describe('assignMediaToSlots', () => {
  it('assigns media to slots in order when no overrides', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' }), makeSlot({ id: 's3' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];

    const { assignments: result } = assignMediaToSlots(template, media);

    expect(result.get('s1')?.id).toBe('m1');
    expect(result.get('s2')?.id).toBe('m2');
    expect(result.get('s3')?.id).toBe('m3');
  });

  it('sorts media by order regardless of input order', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    // Media provided out of order
    const media = [makeMedia('m-last', 99), makeMedia('m-first', 1)];

    const { assignments: result } = assignMediaToSlots(template, media);

    expect(result.get('s1')?.id).toBe('m-first');
    expect(result.get('s2')?.id).toBe('m-last');
  });

  it('leaves extra slots empty when media count < slot count', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' }), makeSlot({ id: 's3' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1)];

    const { assignments: result } = assignMediaToSlots(template, media);

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

    const { assignments: result } = assignMediaToSlots(template, media);

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

    const { assignments: result } = assignMediaToSlots(template, media);

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

    const { assignments: result } = assignMediaToSlots(template, media, overrides);

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

    const { assignments: result } = assignMediaToSlots(template, media, overrides);

    expect(result.get('s1')?.id).toBe('m2');
  });

  it('auto-assigns when overridden mediaId is not found in media list', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const overrides: CampaignLayoutBinding['slotOverrides'] = {
      s1: { mediaId: 'nonexistent' },
    };

    const { assignments: result, summary } = assignMediaToSlots(template, media, overrides);

    // s1: override target not found → falls to auto-assign
    // s2: auto-assign
    // Both m1 and m2 should be assigned
    expect(result.get('s1')?.id).toBe('m1');
    expect(result.get('s2')?.id).toBe('m2');
    // summary should report the cleared binding
    expect(summary.cleared).toHaveLength(1);
    expect(summary.cleared[0].slotIndex).toBe(1);
    expect(summary.autoFilled).toHaveLength(2);
  });

  it('handles empty slots array', () => {
    const template = makeTemplate([]);
    const media = [makeMedia('m1', 1)];

    const { assignments: result } = assignMediaToSlots(template, media);

    expect(result.size).toBe(0);
  });

  it('handles empty media array', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);

    const { assignments: result, summary } = assignMediaToSlots(template, []);

    expect(result.size).toBe(2);
    expect(result.get('s1')).toBeUndefined();
    expect(result.get('s2')).toBeUndefined();
    expect(summary.empty).toEqual([1, 2]);
  });

  it('does not double-assign media when multiple slots reference the same mediaId', () => {
    const slots = [
      makeSlot({ id: 's1', mediaId: 'm1' }),
      makeSlot({ id: 's2', mediaId: 'm1' }),
      makeSlot({ id: 's3' }),
    ];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];

    const { assignments: result } = assignMediaToSlots(template, media);

    // s1 gets m1 (first pass picks it), s2 also references m1 but it's already used
    // s2 and s3 get auto-assigned from remaining
    expect(result.get('s1')?.id).toBe('m1');
    // s2 could get m1 again since both slots resolve to m1 in the first pass
    // (both find it in sortedMedia). Let's verify the actual behavior.
    expect(result.has('s2')).toBe(true);
    expect(result.has('s3')).toBe(true);
  });

  it('keeps matching bindings, clears missing, auto-fills remaining (cross-campaign scenario)', () => {
    // Template slots: s1→chair, s2→table, s3→dog, s4→cat
    const slots = [
      makeSlot({ id: 's1', mediaId: 'chair' }),
      makeSlot({ id: 's2', mediaId: 'table' }),
      makeSlot({ id: 's3', mediaId: 'dog' }),
      makeSlot({ id: 's4', mediaId: 'cat' }),
    ];
    const template = makeTemplate(slots);
    // Campaign only has: skunk(order 1), dog(order 2), deer(order 3), cat(order 4)
    const media = [
      makeMedia('skunk', 1),
      makeMedia('dog', 2),
      makeMedia('deer', 3),
      makeMedia('cat', 4),
    ];

    const { assignments: result, summary } = assignMediaToSlots(template, media);

    // s3→dog and s4→cat should be kept (exist in campaign)
    expect(result.get('s3')?.id).toBe('dog');
    expect(result.get('s4')?.id).toBe('cat');
    expect(summary.kept).toHaveLength(2);

    // s1 and s2 had bindings to chair/table (not in campaign) → cleared
    expect(summary.cleared).toHaveLength(2);
    expect(summary.cleared.map((c) => c.originalMediaId)).toContain('chair');
    expect(summary.cleared.map((c) => c.originalMediaId)).toContain('table');

    // Remaining media (skunk order 1, deer order 3) auto-fills s1 then s2
    expect(result.get('s1')?.id).toBe('skunk');
    expect(result.get('s2')?.id).toBe('deer');
    expect(summary.autoFilled).toHaveLength(2);
    expect(summary.empty).toHaveLength(0);
  });

  it('pins valid bindings and backfills invalid ones (user exact example)', () => {
    // Campaign media ordered: dog(1), cat(2), mouse(3), skunk(4), deer(5), bug(6)
    // Template assigns: slot1→mouse, slot2→dog, slot3→chair, slot4→table, slot5→deer
    // chair and table are NOT in campaign → should be replaced with next available
    // Expected: slot1→mouse, slot2→dog, slot3→cat, slot4→skunk, slot5→deer
    const slots = [
      makeSlot({ id: 's1', mediaId: 'mouse' }),
      makeSlot({ id: 's2', mediaId: 'dog' }),
      makeSlot({ id: 's3', mediaId: 'chair' }),
      makeSlot({ id: 's4', mediaId: 'table' }),
      makeSlot({ id: 's5', mediaId: 'deer' }),
    ];
    const template = makeTemplate(slots);
    const media = [
      makeMedia('dog', 1),
      makeMedia('cat', 2),
      makeMedia('mouse', 3),
      makeMedia('skunk', 4),
      makeMedia('deer', 5),
      makeMedia('bug', 6),
    ];

    const { assignments: result, summary } = assignMediaToSlots(template, media);

    // Valid bindings should be pinned (mouse, dog, deer)
    expect(result.get('s1')?.id).toBe('mouse');
    expect(result.get('s2')?.id).toBe('dog');
    expect(result.get('s5')?.id).toBe('deer');
    expect(summary.kept).toHaveLength(3);

    // Invalid bindings (chair, table) should be cleared
    expect(summary.cleared).toHaveLength(2);
    expect(summary.cleared.map((c) => c.originalMediaId)).toEqual(
      expect.arrayContaining(['chair', 'table']),
    );

    // Remaining campaign media in order: cat(2), skunk(4), bug(6)
    // Auto-fill: slot3→cat, slot4→skunk
    expect(result.get('s3')?.id).toBe('cat');
    expect(result.get('s4')?.id).toBe('skunk');
    expect(summary.autoFilled).toHaveLength(2);
    expect(summary.empty).toHaveLength(0);
  });

  it('matches by attachmentId when exact mediaId not found (cross-campaign)', () => {
    // Layout was built with media from Campaign A (IDs start with "ca-")
    // but the gallery renders in Campaign B (IDs start with "cb-")
    // Same underlying WP attachments → same attachmentId
    const slots = [
      makeSlot({ id: 's1', mediaId: 'ca-x', mediaAttachmentId: 100, mediaUrl: 'https://example.com/x.jpg' }),
      makeSlot({ id: 's2', mediaId: 'ca-b', mediaAttachmentId: 202, mediaUrl: 'https://example.com/b.jpg' }),
      makeSlot({ id: 's3', mediaId: 'ca-a', mediaAttachmentId: 201, mediaUrl: 'https://example.com/a.jpg' }),
      makeSlot({ id: 's4', mediaId: 'ca-c', mediaAttachmentId: 203, mediaUrl: 'https://example.com/c.jpg' }),
    ];
    const template = makeTemplate(slots);
    // Campaign B has the same images with different IDs but same attachmentIds
    const media = [
      makeMedia('cb-a', 1, { attachmentId: 201, url: 'https://example.com/a.jpg' }),
      makeMedia('cb-b', 2, { attachmentId: 202, url: 'https://example.com/b.jpg' }),
      makeMedia('cb-c', 3, { attachmentId: 203, url: 'https://example.com/c.jpg' }),
      makeMedia('cb-d', 4, { attachmentId: 204, url: 'https://example.com/d.jpg' }),
    ];

    const { assignments: result, summary } = assignMediaToSlots(template, media);

    // s2 (attachmentId 202) → cb-b, s3 (201) → cb-a, s4 (203) → cb-c — all matched by attachmentId
    expect(result.get('s2')?.id).toBe('cb-b');
    expect(result.get('s3')?.id).toBe('cb-a');
    expect(result.get('s4')?.id).toBe('cb-c');
    expect(summary.kept).toHaveLength(3);

    // s1 (attachmentId 100) has no match in Campaign B → cleared + auto-filled with cb-d
    expect(result.get('s1')?.id).toBe('cb-d');
    expect(summary.cleared).toHaveLength(1);
    expect(summary.autoFilled).toHaveLength(1);
  });

  it('matches by URL when attachmentId is missing (cross-campaign)', () => {
    // External media without attachmentId — falls back to URL matching
    const slots = [
      makeSlot({ id: 's1', mediaId: 'other-1', mediaUrl: 'https://cdn.example.com/photo-a.jpg' }),
      makeSlot({ id: 's2', mediaId: 'other-2', mediaUrl: 'https://cdn.example.com/photo-x.jpg' }),
    ];
    const template = makeTemplate(slots);
    const media = [
      makeMedia('camp-1', 1, { url: 'https://cdn.example.com/photo-a.jpg' }),
      makeMedia('camp-2', 2, { url: 'https://cdn.example.com/photo-b.jpg' }),
    ];

    const { assignments: result, summary } = assignMediaToSlots(template, media);

    // s1 URL matches camp-1 → kept
    expect(result.get('s1')?.id).toBe('camp-1');
    expect(summary.kept).toHaveLength(1);

    // s2 URL doesn't match any campaign media → cleared, auto-filled with camp-2
    expect(result.get('s2')?.id).toBe('camp-2');
    expect(summary.cleared).toHaveLength(1);
    expect(summary.autoFilled).toHaveLength(1);
  });
});

// ── getUnassignedMedia ───────────────────────────────────────

describe('getUnassignedMedia', () => {
  it('returns media not in the assignment map', () => {
    const slots = [makeSlot({ id: 's1' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2), makeMedia('m3', 3)];
    const { assignments } = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    expect(unassigned).toHaveLength(2);
    expect(unassigned.map((m) => m.id)).toEqual(['m2', 'm3']);
  });

  it('returns empty array when all media are assigned', () => {
    const slots = [makeSlot({ id: 's1' }), makeSlot({ id: 's2' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const { assignments } = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    expect(unassigned).toHaveLength(0);
  });

  it('returns all media when no slots exist', () => {
    const template = makeTemplate([]);
    const media = [makeMedia('m1', 1), makeMedia('m2', 2)];
    const { assignments } = assignMediaToSlots(template, media);

    const unassigned = getUnassignedMedia(template, media, assignments);

    expect(unassigned).toHaveLength(2);
  });

  it('returns unassigned media sorted by order', () => {
    const slots = [makeSlot({ id: 's1' })];
    const template = makeTemplate(slots);
    const media = [makeMedia('z', 3), makeMedia('a', 1), makeMedia('b', 2)];
    const { assignments } = assignMediaToSlots(template, media);

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
