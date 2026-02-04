import { forwardRef } from 'react';
import { Card, Image, Text, Group, Box, ActionIcon } from '@mantine/core';
import { IconPhoto, IconTrash } from '@tabler/icons-react';
import type { MediaItem } from '@/types';
import styles from './MediaCard.module.scss';

interface MediaCardProps {
  item: MediaItem;
  height: number;
  compact?: boolean;
  showUrl?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onImageClick?: () => void;
}

export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(
  ({ item, height, compact = false, showUrl = false, onEdit, onDelete, onMoveUp, onMoveDown, onImageClick }, ref) => {
    const isClickableImage = item.type === 'image' && onImageClick;

    return (
      <div
        ref={ref}
        className={styles.mediaCard}
      >
        <Card
          shadow="sm"
          padding={compact ? 'xs' : 'sm'}
          radius="md"
          withBorder
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
                fallbackSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23374151' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E"
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
                <ActionIcon variant="subtle" onClick={onEdit} aria-label="Edit"><IconPhoto size={16} /></ActionIcon>
                <ActionIcon variant="subtle" onClick={onMoveUp} aria-label="Move media up">↑</ActionIcon>
                <ActionIcon variant="subtle" onClick={onMoveDown} aria-label="Move media down">↓</ActionIcon>
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
