import type { LayoutTemplate, LayoutSlot, MediaItem, CampaignLayoutBinding } from '@/types';

/**
 * Assigns media items to layout template slots.
 *
 * Logic:
 * 1. Iterate slots in their array order.
 * 2. If the slot has an explicit override (via `slotOverrides[slot.id].mediaId`),
 *    find and assign that specific media item.
 * 3. Otherwise, assign the next available media item by `order` field.
 * 4. Slots that exceed the available media count remain empty (undefined value).
 * 5. Extra media items beyond the slot count are ignored in "full" mode,
 *    or can be shown in the thumbnail strip in "viewport" mode (handled by caller).
 *
 * @param template  - The layout template defining the slots.
 * @param media     - Available media items (will be sorted by `order`).
 * @param overrides - Per-slot overrides from the campaign binding.
 * @returns Map from slot ID → assigned MediaItem (or undefined for empty slots).
 */
export function assignMediaToSlots(
  template: LayoutTemplate,
  media: MediaItem[],
  overrides: CampaignLayoutBinding['slotOverrides'] = {},
): Map<string, MediaItem | undefined> {
  const result = new Map<string, MediaItem | undefined>();

  // Sort media by their order field.
  const sortedMedia = [...media].sort((a, b) => a.order - b.order);

  // Track which media IDs have been used (by override or auto-assignment).
  const usedMediaIds = new Set<string>();

  // First pass: resolve explicit overrides.
  for (const slot of template.slots) {
    const override = overrides[slot.id];
    const fixedMediaId = override?.mediaId ?? slot.mediaId;

    if (fixedMediaId) {
      const item = sortedMedia.find((m) => m.id === fixedMediaId);
      if (item) {
        result.set(slot.id, item);
        usedMediaIds.add(item.id);
      }
      // If the specified mediaId isn't found, the slot will be filled in auto-assign
      // pass (if possible) or left empty.
    }
  }

  // Second pass: auto-assign remaining slots from unassigned media.
  const availableMedia = sortedMedia.filter((m) => !usedMediaIds.has(m.id));
  let autoIndex = 0;

  for (const slot of template.slots) {
    if (result.has(slot.id)) {
      continue; // Already assigned by override.
    }

    if (autoIndex < availableMedia.length) {
      result.set(slot.id, availableMedia[autoIndex]);
      autoIndex++;
    } else {
      result.set(slot.id, undefined); // No media left for this slot.
    }
  }

  return result;
}

/**
 * Returns media items that were NOT assigned to any slot.
 * Useful in "viewport" mode where extra media should appear in the thumbnail strip.
 */
export function getUnassignedMedia(
  _template: LayoutTemplate,
  media: MediaItem[],
  assignments: Map<string, MediaItem | undefined>,
): MediaItem[] {
  const assignedIds = new Set<string>();
  for (const item of assignments.values()) {
    if (item) {
      assignedIds.add(item.id);
    }
  }
  return media
    .filter((m) => !assignedIds.has(m.id))
    .sort((a, b) => a.order - b.order);
}

/**
 * Compute the effective slot properties with overrides applied.
 * Merges slot defaults with any per-campaign overrides.
 */
export function resolveSlotWithOverrides(
  slot: LayoutSlot,
  overrides: CampaignLayoutBinding['slotOverrides'] = {},
): LayoutSlot {
  const slotOverride = overrides[slot.id];
  if (!slotOverride) {
    return slot;
  }
  return {
    ...slot,
    ...(slotOverride.objectPosition !== undefined && {
      objectPosition: slotOverride.objectPosition,
    }),
  };
}
