/**
 * MediaPickerSidebar — campaign media list for assigning images to layout slots.
 *
 * Supports:
 * - Click-to-assign: select a slot first, then click a media item to assign it
 * - Drag-to-slot: drag a media item from the sidebar onto a canvas slot
 * - Auto-assign all: fill all slots in order from campaign media
 * - Visual feedback: badge showing which slot a media item is assigned to
 */

import { useCallback, useMemo, useState } from 'react';
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
  TextInput,
  ActionIcon,
  Menu,
} from '@mantine/core';
import {
  IconWand,
  IconX,
  IconSearch,
  IconLayoutList,
  IconLayoutGrid,
  IconChevronDown,
  IconArrowsRandom,
  IconArrowRight,
  IconArrowLeft,
  IconTrash,
} from '@tabler/icons-react';
import type { LayoutSlot, LayoutTemplate, MediaItem } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

// ── Props ────────────────────────────────────────────────────

export interface MediaPickerSidebarProps {
  media: MediaItem[];
  template: LayoutTemplate;
  selectedSlotIds: Set<string>;
  /** Called to assign a media item to a specific slot (with cross-campaign metadata). */
  onAssignMedia: (slotId: string, mediaId: string, meta?: { attachmentId?: number; url?: string }) => void;
  /** Called to clear a slot's fixed media assignment. */
  onClearMedia: (slotId: string) => void;
  /** Called to auto-assign all media in order. */
  onAutoAssign: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

/** Build a reverse map: mediaId → slotIndex[] (1-based) for badge display.
 *  A single media item can be assigned to multiple slots. */
function buildMediaSlotMap(
  slots: LayoutSlot[],
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  slots.forEach((slot, idx) => {
    if (slot.mediaId) {
      const existing = map.get(slot.mediaId) ?? [];
      existing.push(idx + 1);
      map.set(slot.mediaId, existing);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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

  const filteredMedia = useMemo(
    () =>
      media.filter(
        (m) =>
          !searchQuery ||
          m.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m as { caption?: string }).caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.type?.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [media, searchQuery],
  );

  // Auto-fill reverse: slots in reverse order, media in forward order
  const handleAutoAssignReverse = useCallback(() => {
    const slots = [...template.slots].reverse();
    slots.forEach((slot, idx) => {
      const item = media[idx];
      if (!item) return;
      onAssignMedia(slot.id, item.id, {
        ...(item.attachmentId !== undefined ? { attachmentId: item.attachmentId } : {}),
        url: item.url,
      });
    });
  }, [template.slots, media, onAssignMedia]);

  // Shuffle & fill: Fisher-Yates shuffle then assign in slot order
  const handleShuffleAssign = useCallback(() => {
    const shuffled = [...media];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    template.slots.forEach((slot, idx) => {
      if (idx < shuffled.length) {
        const item = shuffled[idx]!;
        onAssignMedia(slot.id, item.id, {
          ...(item.attachmentId !== undefined ? { attachmentId: item.attachmentId } : {}),
          url: item.url,
        });
      }
    });
  }, [template.slots, media, onAssignMedia]);

  // Clear all slot assignments
  const handleClearAll = useCallback(() => {
    template.slots.forEach((slot) => {
      if (slot.mediaId) onClearMedia(slot.id);
    });
  }, [template.slots, onClearMedia]);

  // Handle click on a media item: assign to selected slot
  const handleMediaClick = useCallback(
    (mediaItem: MediaItem) => {
      if (!singleSelectedSlotId) return;
      onAssignMedia(singleSelectedSlotId, mediaItem.id, {
        ...(mediaItem.attachmentId !== undefined ? { attachmentId: mediaItem.attachmentId } : {}),
        url: mediaItem.url,
      });
    },
    [singleSelectedSlotId, onAssignMedia],
  );

  // Handle drag start: store mediaId + metadata in dataTransfer
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLButtonElement>, mediaItem: MediaItem) => {
      e.dataTransfer.setData('application/x-wpsg-media-id', mediaItem.id);
      e.dataTransfer.setData('application/x-wpsg-media-meta', JSON.stringify({
        attachmentId: mediaItem.attachmentId,
        url: mediaItem.url,
      }));
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
        <Menu shadow="md" width={190} withinPortal>
          <Menu.Target>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconWand size={14} />}
              rightSection={<IconChevronDown size={12} />}
              disabled={media.length === 0 || template.slots.length === 0}
            >
              Auto
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconArrowRight size={13} />} onClick={onAutoAssign}>
              Auto-fill (forward)
            </Menu.Item>
            <Menu.Item leftSection={<IconArrowLeft size={13} />} onClick={handleAutoAssignReverse}>
              Auto-fill (reverse)
            </Menu.Item>
            <Menu.Item leftSection={<IconArrowsRandom size={13} />} onClick={handleShuffleAssign}>
              Shuffle &amp; fill
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconTrash size={13} />}
              color="red"
              onClick={handleClearAll}
              disabled={!template.slots.some((s) => s.mediaId)}
            >
              Clear all assigns
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Search + view toggle */}
      <Group gap={4} wrap="nowrap">
        <TextInput
          placeholder="Search media…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={13} />}
          size="xs"
          style={{ flex: 1 }}
          aria-label="Search media"
        />
        <Tooltip label="List view">
          <ActionIcon
            size="sm"
            variant={viewMode === 'list' ? 'filled' : 'subtle'}
            onClick={() => setViewMode('list')}
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
          >
            <IconLayoutList size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Grid view">
          <ActionIcon
            size="sm"
            variant={viewMode === 'grid' ? 'filled' : 'subtle'}
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
          >
            <IconLayoutGrid size={14} />
          </ActionIcon>
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
        {viewMode === 'list' ? (
          <Stack gap={4}>
            {filteredMedia.map((item) => {
              const assignedToSlots = mediaSlotMap.get(item.id);
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
                  aria-label={`${item.title || 'Media item'} — ${assignedToSlots && assignedToSlots.length > 0
                    ? `assigned to slot${assignedToSlots.length > 1 ? 's' : ''} ${assignedToSlots.join(', ')}`
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
                      {item.width && item.height ? ` · ${item.width}×${item.height}` : ''}
                    </Text>
                  </Stack>
                  {assignedToSlots && assignedToSlots.length > 0 && (
                    <Badge size="xs" variant="filled" color="blue" style={assignedToSlots.length > 1 ? { borderRadius: 8, minWidth: 'auto', paddingInline: 6 } : undefined}>
                      {assignedToSlots.join(',')}
                    </Badge>
                  )}
                </UnstyledButton>
              );
            })}

            {filteredMedia.length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="lg">
                {searchQuery ? 'No results.' : 'No media items available.'}
              </Text>
            )}
          </Stack>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
              gap: 4,
            }}
          >
            {filteredMedia.map((item) => {
              const assignedToSlots = mediaSlotMap.get(item.id);
              return (
                <UnstyledButton
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleMediaClick(item)}
                  style={{
                    position: 'relative',
                    borderRadius: 4,
                    overflow: 'hidden',
                    cursor: singleSelectedSlotId ? 'pointer' : 'grab',
                    opacity: singleSelectedSlotId ? 1 : 0.7,
                    border: assignedToSlots?.length
                      ? '2px solid var(--mantine-color-blue-5)'
                      : '2px solid transparent',
                  }}
                  aria-label={`${item.title || 'Media item'} — ${assignedToSlots && assignedToSlots.length > 0
                    ? `assigned to slot${assignedToSlots.length > 1 ? 's' : ''} ${assignedToSlots.join(', ')}`
                    : 'unassigned'
                  }`}
                >
                  <Image
                    src={item.thumbnail || item.url}
                    alt=""
                    w="100%"
                    h={80}
                    fit="cover"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                      padding: '2px 4px 3px',
                    }}
                  >
                    <Text size="9px" c="white" truncate lineClamp={1}>
                      {item.title || `#${item.order + 1}`}
                    </Text>
                  </div>
                  {assignedToSlots && assignedToSlots.length > 0 && (
                    <Badge
                      size="xs"
                      variant="filled"
                      color="blue"
                      style={{ position: 'absolute', top: 3, right: 3, minWidth: 'auto', paddingInline: 4 }}
                    >
                      {assignedToSlots.join(',')}
                    </Badge>
                  )}
                </UnstyledButton>
              );
            })}

            {filteredMedia.length === 0 && (
              <Text size="xs" c="dimmed" ta="center" py="lg" style={{ gridColumn: '1 / -1' }}>
                {searchQuery ? 'No results.' : 'No media items available.'}
              </Text>
            )}
          </div>
        )}
      </ScrollArea>
    </Stack>
  );
}

setWpsgDebugDisplayName(MediaPickerSidebar, 'LayoutBuilder:MediaPickerSidebar');