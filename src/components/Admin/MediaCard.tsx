import { forwardRef, type DragEvent, type CSSProperties, type HTMLAttributes } from 'react';
import { Card, Image, Text, Group, Box, ActionIcon } from '@mantine/core';
import { IconPhoto, IconTrash, IconGripVertical } from '@tabler/icons-react';
import type { MediaItem } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import styles from './MediaCard.module.scss';

interface MediaCardProps {
  item: MediaItem;
  height: number;
  compact?: boolean;
  showUrl?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onImageClick?: () => void;
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void;
  style?: CSSProperties;
  cardStyle?: CSSProperties;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement>;
}

export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(
  ({
    item,
    height,
    compact = false,
    showUrl = false,
    onEdit,
    onDelete,
    onImageClick,
    draggable = false,
    onDragStart,
    onDragEnter,
    onDragOver,
    onDrop,
    onDragEnd,
    style,
    cardStyle,
    dragHandleProps,
  }, ref) => {
    const isClickableImage = item.type === 'image' && onImageClick;

    return (
      <div
        ref={ref}
        className={styles.mediaCard}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        style={style}
      >
        <Card
          shadow="sm"
          padding={compact ? 'xs' : 'sm'}
          radius="md"
          withBorder
          style={cardStyle}
        >
          <Card.Section
            style={{ cursor: isClickableImage ? 'pointer' : 'default' }}
            onClick={isClickableImage ? onImageClick : undefined}
            role={isClickableImage ? 'button' : undefined}
            tabIndex={isClickableImage ? 0 : -1}
            aria-label={
              isClickableImage
                ? `Open image preview for ${item.caption || item.url}`
                : undefined
            }
            onKeyDown={(event) => {
              if (!isClickableImage) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onImageClick?.();
              }
            }}
          >
            {item.source === 'external' && item.type === 'video' && item.embedUrl ? (
              <div style={{ height, width: '100%' }}>
                <iframe
                  src={item.embedUrl}
                  title={item.caption || 'External video'}
                  style={{ width: '100%', height: '100%', border: 0 }}
                  allowFullScreen
                />
              </div>
            ) : (
              <Image
                src={item.thumbnail ?? item.url}
                alt={item.caption || 'Media thumbnail'}
                h={height}
                fit="cover"
                loading="lazy"
                fallbackSrc={FALLBACK_IMAGE_SRC}
              />
            )}
          </Card.Section>

          {/* Show controls based on size */}
          {!compact ? (
            <Group justify="space-between" mt="sm">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" c="gray.1" lineClamp={1}>{item.caption || '—'}</Text>
                {showUrl && item.url && (
                  <Text size="xs" c="gray.4" lineClamp={1}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{item.url}</a>
                  </Text>
                )}
              </Box>
              <Group gap={4} wrap="nowrap">
                <ActionIcon
                  variant="subtle"
                  aria-label="Drag media to reorder"
                  style={{ cursor: 'grab' }}
                  {...dragHandleProps}
                >
                  <IconGripVertical size={16} />
                </ActionIcon>
                <ActionIcon variant="subtle" onClick={onEdit} aria-label="Edit"><IconPhoto size={16} /></ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={onDelete} aria-label="Delete media"><IconTrash size={16} /></ActionIcon>
              </Group>
            </Group>
          ) : (
            /* Compact/Small: hover overlay for actions */
            <Group justify="center" mt={4} gap={2}>
              <ActionIcon size="xs" variant="subtle" onClick={onEdit} aria-label="Edit"><IconPhoto size={12} /></ActionIcon>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={onDelete} aria-label="Delete media"><IconTrash size={12} /></ActionIcon>
            </Group>
          )}
        </Card>
      </div>
    );
  },
);

MediaCard.displayName = 'MediaCard';
