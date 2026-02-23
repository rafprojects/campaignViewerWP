/**
 * MediaPickerSidebar — campaign media list for assigning images to layout slots.
 *
 * Supports:
 * - Click-to-assign: select a slot first, then click a media item to assign it
 * - Drag-to-slot: drag a media item from the sidebar onto a canvas slot
 * - Auto-assign all: fill all slots in order from campaign media
 * - Visual feedback: badge showing which slot a media item is assigned to
 */

import { useCallback, useMemo } from 'react';
import {
  Stack,
  Text,
  Button,
  Group,
  ScrollArea,
  Badge,
  UnstyledButton,
  Image,
  Tooltip,
} from '@mantine/core';
import { IconWand, IconX } from '@tabler/icons-react';
import type { LayoutSlot, LayoutTemplate, MediaItem } from '@/types';

// ── Props ────────────────────────────────────────────────────

export interface MediaPickerSidebarProps {
  media: MediaItem[];
  template: LayoutTemplate;
  selectedSlotIds: Set<string>;
  /** Called to assign a media item to a specific slot. */
  onAssignMedia: (slotId: string, mediaId: string) => void;
  /** Called to clear a slot's fixed media assignment. */
  onClearMedia: (slotId: string) => void;
  /** Called to auto-assign all media in order. */
  onAutoAssign: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

/** Build a reverse map: mediaId → slotIndex (1-based) for badge display. */
function buildMediaSlotMap(
  slots: LayoutSlot[],
): Map<string, number> {
  const map = new Map<string, number>();
  slots.forEach((slot, idx) => {
    if (slot.mediaId) {
      map.set(slot.mediaId, idx + 1);
    }
  });
  return map;
}

// ── Component ────────────────────────────────────────────────

export function MediaPickerSidebar({
  media,
  template,
  selectedSlotIds,
  onAssignMedia,
  onClearMedia,
  onAutoAssign,
}: MediaPickerSidebarProps) {
  // Which media items are assigned to which slots
  const mediaSlotMap = useMemo(
    () => buildMediaSlotMap(template.slots),
    [template.slots],
  );

  // The single selected slot (for click-to-assign)
  const singleSelectedSlotId = useMemo(() => {
    if (selectedSlotIds.size !== 1) return undefined;
    return Array.from(selectedSlotIds)[0];
  }, [selectedSlotIds]);

  // Handle click on a media item: assign to selected slot
  const handleMediaClick = useCallback(
    (mediaItem: MediaItem) => {
      if (!singleSelectedSlotId) return;
      onAssignMedia(singleSelectedSlotId, mediaItem.id);
    },
    [singleSelectedSlotId, onAssignMedia],
  );

  // Handle drag start: store mediaId in dataTransfer
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLButtonElement>, mediaItem: MediaItem) => {
      e.dataTransfer.setData('application/x-wpsg-media-id', mediaItem.id);
      e.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  // Clear assignment for a slot
  const handleClearSlotMedia = useCallback(
    (slotId: string) => {
      onClearMedia(slotId);
    },
    [onClearMedia],
  );

  return (
    <Stack gap="sm" h="100%">
      <Group justify="space-between" wrap="nowrap">
        <Text size="sm" fw={600}>
          Media ({media.length})
        </Text>
        <Tooltip label="Auto-assign media to all slots by order">
          <Button
            size="xs"
            variant="light"
            leftSection={<IconWand size={14} />}
            onClick={onAutoAssign}
            disabled={media.length === 0 || template.slots.length === 0}
          >
            Auto
          </Button>
        </Tooltip>
      </Group>

      {singleSelectedSlotId ? (
        <Text size="xs" c="dimmed">
          Click or drag a media item to assign it to the selected slot.
        </Text>
      ) : (
        <Text size="xs" c="dimmed">
          Select a slot first, then choose media to assign.
        </Text>
      )}

      {/* Assigned media per slot — quick overview */}
      {template.slots.some((s) => s.mediaId) && (
        <>
          <Text size="xs" fw={500} mt="xs">
            Assignments
          </Text>
          <Stack gap={2}>
            {template.slots.map((slot, idx) => {
              if (!slot.mediaId) return null;
              const mediaItem = media.find((m) => m.id === slot.mediaId);
              return (
                <Group key={slot.id} gap={4} wrap="nowrap">
                  <Badge size="xs" variant="light" w={50} style={{ flexShrink: 0 }}>
                    Slot {idx + 1}
                  </Badge>
                  <Text size="xs" truncate style={{ flex: 1 }}>
                    {mediaItem?.title || slot.mediaId}
                  </Text>
                  <Tooltip label="Unassign">
                    <UnstyledButton
                      onClick={() => handleClearSlotMedia(slot.id)}
                      style={{ lineHeight: 0 }}
                      aria-label={`Unassign media from slot ${idx + 1}`}
                    >
                      <IconX size={12} />
                    </UnstyledButton>
                  </Tooltip>
                </Group>
              );
            })}
          </Stack>
        </>
      )}

      {/* Media items scroll area */}
      <ScrollArea style={{ flex: 1 }} offsetScrollbars>
        <Stack gap={4}>
          {media.map((item) => {
            const assignedToSlot = mediaSlotMap.get(item.id);
            return (
              <UnstyledButton
                key={item.id}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                onClick={() => handleMediaClick(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '4px 6px',
                  borderRadius: 4,
                  cursor: singleSelectedSlotId ? 'pointer' : 'grab',
                  border: '1px solid transparent',
                  transition: 'background 0.1s',
                  opacity: singleSelectedSlotId ? 1 : 0.7,
                }}
                aria-label={`${item.title || 'Media item'} — ${
                  assignedToSlot
                    ? `assigned to slot ${assignedToSlot}`
                    : 'unassigned'
                }`}
              >
                <Image
                  src={item.thumbnail || item.url}
                  alt=""
                  w={40}
                  h={40}
                  radius={4}
                  fit="cover"
                  style={{ flexShrink: 0 }}
                />
                <Stack gap={0} style={{ flex: 1, overflow: 'hidden' }}>
                  <Text size="xs" truncate>
                    {item.title || `Media #${item.order + 1}`}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {item.type}
                    {item.width && item.height
                      ? ` · ${item.width}×${item.height}`
                      : ''}
                  </Text>
                </Stack>
                {assignedToSlot !== undefined && (
                  <Badge size="xs" variant="filled" color="blue" circle>
                    {assignedToSlot}
                  </Badge>
                )}
              </UnstyledButton>
            );
          })}

          {media.length === 0 && (
            <Text size="xs" c="dimmed" ta="center" py="lg">
              No media items available.
            </Text>
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
