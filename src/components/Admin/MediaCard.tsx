import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { Card, Image, Text, Group, Box, ActionIcon, Badge } from '@mantine/core';
import { IconPhoto, IconTrash, IconGripVertical } from '@tabler/icons-react';
import type { MediaItem } from '@/types';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import styles from './MediaCard.module.scss';

interface MediaCardProps {
  item: MediaItem;
  height: number;
  compact?: boolean | undefined;
  showUrl?: boolean | undefined;
  overlayBadge?: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onImageClick?: (() => void) | undefined;
  style?: CSSProperties | undefined;
  cardStyle?: CSSProperties | undefined;
  dragHandleProps?: HTMLAttributes<HTMLButtonElement> | undefined;
}

export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(
  ({
    item,
    height,
    compact = false,
    showUrl = false,
    overlayBadge,
    onEdit,
    onDelete,
    onImageClick,
    style,
    cardStyle,
    dragHandleProps,
  }, ref) => {
    const isClickableImage = item.type === 'image' && onImageClick;
    const mediaTypeLabel = item.type === 'video' ? 'Video' : 'Image';
    const sourceLabel = item.source === 'external' ? 'External' : 'Upload';
    const mediaTypeColor = item.type === 'video' ? 'violet' : 'blue';
    const sourceColor = item.source === 'external' ? 'grape' : 'teal';

    return (
      <div
        ref={ref}
        className={styles.mediaCard}
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
            <Box {...(styles.previewWrapper ? { className: styles.previewWrapper } : {})}>
              <Image
                src={item.thumbnail ?? item.url}
                alt={item.caption || 'Media thumbnail'}
                h={height}
                fit="cover"
                loading="lazy"
                fallbackSrc={FALLBACK_IMAGE_SRC}
              />
              <Box
                data-testid="media-card-overlay-stack"
                {...(styles.overlayStack ? { className: styles.overlayStack } : {})}
              >
                <Group gap={4} wrap="nowrap" align="center" {...(styles.badgeGroup ? { className: styles.badgeGroup } : {})}>
                  <Badge size="xs" variant="filled" color={mediaTypeColor}>{mediaTypeLabel}</Badge>
                  <Badge size="xs" variant="light" color={sourceColor}>{sourceLabel}</Badge>
                  {/* Future Admin Panel redesign: move overlayBadge into its own upper-left thumbnail overlay layer instead of this shared inline badge row. */}
                  {overlayBadge}
                </Group>
              </Box>
            </Box>
          </Card.Section>

          {/* Show controls based on size */}
          {!compact ? (
            <Group justify="space-between" mt="sm">
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" lineClamp={1}>{item.caption || '—'}</Text>
                {showUrl && item.url && (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>{item.url}</a>
                  </Text>
                )}
              </Box>
              <Group gap={4} wrap="nowrap">
                {dragHandleProps !== undefined && (
                  <ActionIcon
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    {...(dragHandleProps as any)}
                    variant="subtle"
                    aria-label="Drag media to reorder"
                    style={{ cursor: 'grab' }}
                  >
                    <IconGripVertical size={16} />
                  </ActionIcon>
                )}
                <ActionIcon variant="subtle" onClick={onEdit} aria-label="Edit"><IconPhoto size={16} /></ActionIcon>
                <ActionIcon variant="subtle" color="red" onClick={onDelete} aria-label="Delete media"><IconTrash size={16} /></ActionIcon>
              </Group>
            </Group>
          ) : (
            /* Compact/Small: hover overlay for actions */
            <Group justify="center" mt={4} gap={4}>
              <ActionIcon size="sm" variant="subtle" onClick={onEdit} aria-label="Edit"><IconPhoto size={14} /></ActionIcon>
              <ActionIcon size="sm" variant="subtle" color="red" onClick={onDelete} aria-label="Delete media"><IconTrash size={14} /></ActionIcon>
            </Group>
          )}
        </Card>
      </div>
    );
  },
);

setWpsgDebugDisplayName(MediaCard, 'AdminPanel:MediaCard');
