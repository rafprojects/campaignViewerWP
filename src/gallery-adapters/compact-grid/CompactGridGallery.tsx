/**
 * P12-C: Compact Grid Gallery Adapter
 *
 * Responsive CSS grid with playing-card–proportioned media tiles
 * (configurable width/height, default 160×224 px — a 5:7 ratio).
 * Accepts a unified media array (images + videos). Image tiles open the
 * shared Portal-based Lightbox; video tiles show a play-button overlay
 * and also open in the lightbox (the lightbox handles both types).
 *
 * Registered as adapter id="compact-grid".
 */
import { useState, useCallback } from 'react';
import { Box, Group, Stack, Title } from '@mantine/core';
import { IconLayoutGrid, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { LazyImage } from '@/components/Gallery/LazyImage';

interface CompactGridGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function CompactGridGallery({ media, settings }: CompactGridGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);

  const openAt = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLightboxOpen(true);
    },
    [setCurrentIndex],
  );

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const cardWidth = settings.gridCardWidth;
  const cardHeight = settings.gridCardHeight;
  const borderRadius = settings.imageBorderRadius;
  const gap = settings.thumbnailGap;

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconLayoutGrid size={18} />
          Gallery ({media.length})
        </Group>
      </Title>

      {/* Responsive auto-fill grid — use min() to ensure cards scale down on mobile */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardWidth}px, calc(50% - ${gap / 2}px)), 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {media.map((item, index) => (
          <GridCard
            key={item.id}
            item={item}
            index={index}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            borderRadius={borderRadius}
            onOpen={openAt}
          />
        ))}
      </Box>

      <Lightbox
        isOpen={lightboxOpen}
        media={media}
        currentIndex={currentIndex}
        onPrev={prev}
        onNext={next}
        onClose={closeLightbox}
      />
    </Stack>
  );
}

// ─── Internal card component ────────────────────────────────────────────────

interface GridCardProps {
  item: MediaItem;
  index: number;
  cardWidth: number;
  cardHeight: number;
  borderRadius: number;
  onOpen: (index: number) => void;
}

function GridCard({ item, index, cardWidth, cardHeight, borderRadius, onOpen }: GridCardProps) {
  const [hovered, setHovered] = useState(false);
  const isVideo = item.type === 'video';
  const thumbSrc = item.thumbnail || item.url;
  const label = item.caption
    ? `${isVideo ? 'Play' : 'View'}: ${item.caption}`
    : `${isVideo ? 'Play' : 'View'} ${isVideo ? 'video' : 'image'} ${index + 1}`;

  return (
    <Box
      component="button"
      onClick={() => onOpen(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={label}
      style={{
        /* Layout */
        display: 'block',
        width: '100%',
        aspectRatio: `${cardWidth} / ${cardHeight}`,
        /* Reset button styles */
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        /* Card appearance */
        borderRadius: `${borderRadius}px`,
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--wpsg-color-surface, #1a1a2e)',
        /* Elevation on hover */
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.35)'
          : '0 2px 6px rgba(0,0,0,0.15)',
        transition: 'box-shadow 0.25s ease',
      }}
    >
      {/* Cover thumbnail */}
      <LazyImage
        src={thumbSrc}
        alt={item.caption || ''}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.3s ease, opacity 0.2s ease',
        }}
      />

      {/* Hover overlay — zoom icon for images, play icon for videos */}
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background: hovered ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.25s ease',
          pointerEvents: 'none',
        }}
      >
        {isVideo ? (
          <IconPlayerPlay
            size={32}
            color="white"
            style={{
              opacity: hovered ? 1 : 0.6,
              transition: 'opacity 0.25s ease',
              filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.7))',
            }}
          />
        ) : (
          <IconZoomIn
            size={28}
            color="white"
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.25s ease',
              filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))',
            }}
          />
        )}
      </Box>

      {/* Video badge */}
      {isVideo && (
        <Box
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            background: 'rgba(0,0,0,0.65)',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10,
            color: 'white',
            fontWeight: 600,
            letterSpacing: '0.04em',
            pointerEvents: 'none',
          }}
        >
          VIDEO
        </Box>
      )}
    </Box>
  );
}

