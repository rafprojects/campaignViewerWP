import { type CSSProperties, type KeyboardEventHandler } from 'react';
import { Image, Text, Group, Badge, Table, ActionIcon, Grid, Box, Skeleton } from '@mantine/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconGripVertical, IconPhoto, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { MediaCard } from './MediaCard';
import { MediaUsageBadge } from './MediaUsageBadge';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';

export type SharedSortableProps = {
  item: MediaItem;
  getInsertionStyle: (itemId: string, axis: 'horizontal' | 'vertical') => CSSProperties | undefined;
  moveByKeyboard: (itemId: string, direction: 'forward' | 'backward') => Promise<void>;
  openLightbox: (item: MediaItem) => void;
  openEdit: (item: MediaItem) => void;
  handleDelete: (item: MediaItem) => void;
  usageSummaryLoading: boolean;
  usageSummary: Record<string, number>;
  apiClient: ApiClient;
  /** P34-B: when true, drag-handle is hidden (active when not in 'order' sort mode). */
  dragDisabled?: boolean;
};

export function SortableListRow({
  item, getInsertionStyle, moveByKeyboard, openLightbox, openEdit, handleDelete,
  usageSummaryLoading, usageSummary, apiClient, dragDisabled,
}: SharedSortableProps) {
  const { t } = useTranslation('wpsg');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const onHandleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
    listeners?.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      void moveByKeyboard(item.id, 'forward');
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      void moveByKeyboard(item.id, 'backward');
    }
  };
  const rowStyle: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.2 : 1,
    ...getInsertionStyle(item.id, 'vertical'),
  };
  const mediaTypeLabel = item.type === 'video' ? t('admin_media_type_video', 'Video') : t('admin_media_type_image', 'Image');
  const sourceLabel = item.source === 'external' ? t('admin_media_source_external', 'External') : t('admin_media_source_upload', 'Upload');
  const mediaTypeColor = item.type === 'video' ? 'violet' : 'blue';
  const sourceColor = item.source === 'external' ? 'grape' : 'teal';

  return (
    <Table.Tr ref={setNodeRef} data-testid={`media-draggable-${item.id}`} style={rowStyle}>
      <Table.Td>
        <Image
          src={item.thumbnail ?? item.url}
          alt={item.caption || t('admin_media_thumb_alt', 'Media thumbnail')}
          w={50}
          h={50}
          fit="cover"
          radius="sm"
          loading="lazy"
          style={{ cursor: item.type === 'image' ? 'pointer' : 'default' }}
          onClick={() => item.type === 'image' && openLightbox(item)}
          role={item.type === 'image' ? 'button' : undefined}
          tabIndex={item.type === 'image' ? 0 : -1}
          aria-label={
            item.type === 'image'
              ? t('admin_media_open_preview', 'Open image preview for {{label}}', { label: item.caption || item.url })
              : undefined
          }
          onKeyDown={(event) => {
            if (item.type !== 'image') return;
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openLightbox(item);
            }
          }}
          fallbackSrc={FALLBACK_IMAGE_SRC}
        />
      </Table.Td>
      <Table.Td>
        <Text size="sm" lineClamp={1}>{item.caption || '—'}</Text>
        <Group gap={4} mt={4}>
          <Badge size="xs" variant="filled" color={mediaTypeColor}>{mediaTypeLabel}</Badge>
          <Badge size="xs" variant="light" color={sourceColor}>{sourceLabel}</Badge>
        </Group>
        <Text size="xs" c="dimmed" lineClamp={1}>{item.url}</Text>
      </Table.Td>
      <Table.Td><Text size="sm">{item.type}</Text></Table.Td>
      <Table.Td><Text size="sm">{item.source}</Text></Table.Td>
      <Table.Td>
        {usageSummaryLoading
          ? <Skeleton width={64} height={20} radius="xl" />
          : <MediaUsageBadge count={usageSummary[item.id] ?? 0} mediaId={item.id} apiClient={apiClient} />}
      </Table.Td>
      <Table.Td>
        <Group gap={4}>
          {!dragDisabled && (
            <ActionIcon
              variant="subtle"
              aria-label={t('admin_media_drag_reorder', 'Drag media to reorder')}
              style={{ cursor: 'grab' }}
              {...attributes}
              {...listeners}
              onKeyDown={onHandleKeyDown}
            >
              <IconGripVertical size={16} />
            </ActionIcon>
          )}
          <ActionIcon variant="subtle" onClick={() => openEdit(item)} aria-label={t('admin_media_edit_aria', 'Edit')}><IconPhoto size={16} /></ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)} aria-label={t('admin_media_delete_aria', 'Delete media')}><IconTrash size={16} /></ActionIcon>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

type SortableGridItemProps = SharedSortableProps & {
  viewMode: 'grid' | 'list' | 'compact';
  cardSize: 'small' | 'medium' | 'large';
  mediaHeight: number;
  gridSpan: number;
  showUrl: boolean;
};

export function SortableGridItem({
  item, getInsertionStyle, moveByKeyboard, openLightbox, openEdit, handleDelete,
  usageSummaryLoading, usageSummary, apiClient, dragDisabled,
  viewMode, cardSize, mediaHeight, gridSpan, showUrl,
}: SortableGridItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const onHandleKeyDown: KeyboardEventHandler<HTMLButtonElement> = (event) => {
    listeners?.onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      void moveByKeyboard(item.id, 'forward');
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      void moveByKeyboard(item.id, 'backward');
    }
  };
  const isCompact = viewMode === 'compact' || cardSize === 'small';

  return (
    <Grid.Col
      ref={setNodeRef}
      data-testid={`media-draggable-${item.id}`}
      style={{ transform: CSS.Transform.toString(transform) ?? undefined, transition: transition ?? undefined } as CSSProperties}
      span={gridSpan!}
    >
      <Box style={{ position: 'relative' }}>
        {/* Keep card in DOM so it holds the slot height; hide it while dragging */}
        <div style={{ opacity: isDragging ? 0 : 1, pointerEvents: isDragging ? 'none' : undefined }}>
          <MediaCard
            item={item}
            height={mediaHeight}
            compact={isCompact}
            showUrl={showUrl}
            overlayBadge={usageSummaryLoading
              ? <Skeleton width={64} height={20} radius="xl" />
              : <MediaUsageBadge count={usageSummary[item.id] ?? 0} mediaId={item.id} apiClient={apiClient} size="xs" />}
            onEdit={() => openEdit(item)}
            onDelete={() => handleDelete(item)}
            onImageClick={item.type === 'image' ? () => openLightbox(item) : undefined}
            cardStyle={getInsertionStyle(item.id, 'horizontal')}
            dragHandleProps={dragDisabled ? undefined : { ...attributes, ...listeners, onKeyDown: onHandleKeyDown }}
          />
        </div>
        {isDragging && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 8,
            border: '2px dashed color-mix(in srgb, var(--mantine-color-blue-5) 55%, transparent)',
            background: 'color-mix(in srgb, var(--mantine-color-blue-5) 5%, transparent)',
            pointerEvents: 'none',
          }} />
        )}
      </Box>
    </Grid.Col>
  );
}
