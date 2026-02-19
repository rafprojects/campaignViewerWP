/**
 * P12-C: Compact Grid Gallery Adapter
 *
 * Responsive CSS grid with playing-card–proportioned image tiles
 * (configurable width/height, default 160×224 px — a 5:7 ratio).
 * Click any card to open the shared Portal-based Lightbox.
 *
 * Registered as adapter id="compact-grid", mediaType="image".
 */
import { useState, useCallback } from 'react';
import { Box, Group, Stack, Title } from '@mantine/core';
import { IconLayoutGrid, IconZoomIn } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';

interface CompactGridGalleryProps {
  images: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function CompactGridGallery({ images, settings }: CompactGridGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(images.length);

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
          Images ({images.length})
        </Group>
      </Title>

      {/* Responsive auto-fill grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${cardWidth}px, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {images.map((image, index) => (
          <GridCard
            key={image.id}
            image={image}
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
        images={images}
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
  image: MediaItem;
  index: number;
  cardWidth: number;
  cardHeight: number;
  borderRadius: number;
  onOpen: (index: number) => void;
}

function GridCard({ image, index, cardWidth, cardHeight, borderRadius, onOpen }: GridCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      component="button"
      onClick={() => onOpen(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={image.caption ? `View: ${image.caption}` : `View image ${index + 1} of ${index + 1}`}
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
      {/* Cover image */}
      <img
        src={image.thumbnail || image.url}
        alt={image.caption || ''}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: hovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.3s ease',
        }}
      />

      {/* Hover overlay */}
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background: hovered ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.25s ease',
          pointerEvents: 'none',
        }}
      >
        <IconZoomIn
          size={28}
          color="white"
          style={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.25s ease',
            filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))',
          }}
        />
      </Box>
    </Box>
  );
}
