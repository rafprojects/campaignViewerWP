import type { LayoutTemplate, LayoutSlot, MediaItem, CampaignLayoutBinding } from '@/types';
import { debugGroup, debugLog, debugGroupEnd } from './debug';

// ── Assignment summary (for admin notification) ─────────────────────────────

/** Describes what happened during media→slot assignment for admin messaging. */
export interface SlotAssignmentSummary {
  /** Slots whose template/override binding matched campaign media — kept as-is. */
  kept: { slotIndex: number; mediaTitle: string }[];
  /** Slots whose template/override binding did NOT match campaign media — cleared. */
  cleared: { slotIndex: number; originalMediaId: string }[];
  /** Cleared slots that were auto-filled from remaining campaign media. */
  autoFilled: { slotIndex: number; mediaTitle: string }[];
  /** Slots left empty (no media remaining to fill them). */
  empty: number[];
}

/** Return value of `assignMediaToSlots`. */
export interface SlotAssignmentResult {
  assignments: Map<string, MediaItem | undefined>;
  summary: SlotAssignmentSummary;
}

/**
 * Assigns media items to layout template slots.
 *
 * Logic:
 * 1. Iterate slots in their array order.
 * 2. If the slot has an explicit override (via `slotOverrides[slot.id].mediaId`
 *    or `slot.mediaId`) AND that media exists in the campaign, keep the binding.
 * 3. If the bound media is NOT in the campaign, clear the binding and mark it
 *    for auto-fill from remaining campaign media (sorted by `order`).
 * 4. Unbound slots are auto-filled from remaining media.
 * 5. Slots that still have no media after auto-fill remain empty (placeholder).
 * 6. Returns both the assignment map and a summary for admin notification.
 *
 * @param template  - The layout template defining the slots.
 * @param media     - Available media items (will be sorted by `order`).
 * @param overrides - Per-slot overrides from the campaign binding.
 * @returns Assignment map + summary describing what happened.
 */
export function assignMediaToSlots(
  template: LayoutTemplate,
  media: MediaItem[],
  overrides: CampaignLayoutBinding['slotOverrides'] = {},
): SlotAssignmentResult {
  const result = new Map<string, MediaItem | undefined>();
  const summary: SlotAssignmentSummary = { kept: [], cleared: [], autoFilled: [], empty: [] };

  // ── DEBUG: Log inputs so we can trace assignment issues ──
  debugGroup('[WPSG] assignMediaToSlots');
  debugLog('Slots:', template.slots.map((s, i) => `${i + 1}:${s.id}→mediaId=${s.mediaId ?? '(none)'}`));
  debugLog('Campaign media (by order):', [...media].sort((a, b) => a.order - b.order).map((m) => `${m.id} (order ${m.order}, ${m.title ?? m.url})`));
  debugLog('Overrides:', Object.entries(overrides).length > 0 ? overrides : '(none)');

  // Sort media by their order field.
  const sortedMedia = [...media].sort((a, b) => a.order - b.order);

  // Build lookup helpers for cross-campaign matching.
  // The same WP attachment can have different media IDs in different campaigns,
  // so we fall back to attachmentId or URL matching when exact ID fails.
  const mediaByAttachmentId = new Map<number, MediaItem>();
  const mediaByUrl = new Map<string, MediaItem>();
  for (const m of sortedMedia) {
    if (m.attachmentId != null && !mediaByAttachmentId.has(m.attachmentId)) {
      mediaByAttachmentId.set(m.attachmentId, m);
    }
    if (m.url && !mediaByUrl.has(m.url)) {
      mediaByUrl.set(m.url, m);
    }
  }

  // Track which media IDs have been used (by override or auto-assignment).
  const usedMediaIds = new Set<string>();

  // First pass: resolve explicit bindings (overrides take precedence over template).
  for (let i = 0; i < template.slots.length; i++) {
    const slot = template.slots[i];
    const override = overrides[slot.id];
    const fixedMediaId = override?.mediaId ?? slot.mediaId;

    if (fixedMediaId) {
      // 1) Exact ID match
      let item = sortedMedia.find((m) => m.id === fixedMediaId);

      // 2) Cross-campaign fallback: match by WP attachment ID
      if (!item && slot.mediaAttachmentId != null) {
        item = mediaByAttachmentId.get(slot.mediaAttachmentId);
      }

      // 3) Cross-campaign fallback: match by URL
      if (!item && slot.mediaUrl) {
        item = mediaByUrl.get(slot.mediaUrl);
      }

      if (item) {
        result.set(slot.id, item);
        usedMediaIds.add(item.id);
        summary.kept.push({ slotIndex: i + 1, mediaTitle: item.title || item.url });
      } else {
        // Binding references media not in this campaign — clear it.
        summary.cleared.push({ slotIndex: i + 1, originalMediaId: fixedMediaId });
      }
    }
  }

  // Second pass: auto-assign remaining slots from unassigned media.
  const availableMedia = sortedMedia.filter((m) => !usedMediaIds.has(m.id));
  let autoIndex = 0;

  for (let i = 0; i < template.slots.length; i++) {
    const slot = template.slots[i];
    if (result.has(slot.id)) {
      continue; // Already assigned by binding.
    }

    if (autoIndex < availableMedia.length) {
      const item = availableMedia[autoIndex];
      result.set(slot.id, item);
      autoIndex++;
      summary.autoFilled.push({ slotIndex: i + 1, mediaTitle: item.title || item.url });
    } else {
      result.set(slot.id, undefined); // No media left for this slot.
      summary.empty.push(i + 1);
    }
  }

  // ── DEBUG: Log results ──
  debugLog('Final assignments:', Array.from(result.entries()).map(([slotId, item]) => {
    const idx = template.slots.findIndex((s) => s.id === slotId) + 1;
    return `slot ${idx} → ${item ? `${item.id} (${item.title ?? item.url})` : '(empty)'}`;
  }));
  debugLog('Summary:', JSON.stringify(summary, null, 2));
  debugGroupEnd();

  return { assignments: result, summary };
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
