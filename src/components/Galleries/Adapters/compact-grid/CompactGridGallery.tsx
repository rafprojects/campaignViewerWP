/**
 * P12-C: Compact Grid Gallery Adapter
 *
 * Responsive flex-wrap grid with playing-card–proportioned media tiles
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
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCss, toCssOrNumber } from '@/utils/cssUnits';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Galleries/Shared/Lightbox';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from '../_shared/runtimeCommon';

function resolveCompactGridAspectRatio(settings: GalleryBehaviorSettings, cardWidth: number, itemScale: number): string {
  if (settings.gridCardAspectRatio && settings.gridCardAspectRatio !== 'auto') {
    return settings.gridCardAspectRatio.replace(':', ' / ');
  }

  const legacyCardHeight = Math.max(1, Math.round((settings.gridCardHeight ?? 224) * itemScale));
  return `${Math.max(1, cardWidth)} / ${legacyCardHeight}`;
}

interface CompactGridGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function CompactGridGallery({ media, settings, runtime, containerDimensions: _containerDimensions }: CompactGridGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  const openAt = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLightboxOpen(true);
    },
    [setCurrentIndex],
  );

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const itemSc = settings.itemScale ?? 1;
  const cardWidth = Math.round((settings.gridCardWidth ?? 160) * itemSc);
  const cardWidthUnit = settings.gridCardWidthUnit ?? 'px';
  const aspectRatio = resolveCompactGridAspectRatio(settings, cardWidth, itemSc);
  const maxColumns = Math.max(0, Math.min(8, settings.gridCardMaxColumns ?? 0));
  const minCardHeight = Math.max(0, settings.gridCardMinHeight ?? 0);
  const borderRadius = toCssOrNumber(settings.imageBorderRadius, settings.imageBorderRadiusUnit);
  const gap = common.adapterItemGap ?? 16;
  const gapUnit = common.adapterItemGapUnit ?? 'px';
  const cardWidthCss = toCss(cardWidth, cardWidthUnit);
  const gridMaxWidth = maxColumns > 0
    ? `min(100%, calc((${cardWidthCss} * ${maxColumns}) + ${toCss(gap * Math.max(0, maxColumns - 1), gapUnit)}))`
    : undefined;

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack {...getWpsgDebugProps('CompactGridGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconLayoutGrid size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      {/* Flex-wrap grid — justify-content distributes items per-row, so
          partially filled last rows can be center/space-between/etc. */}
      <Box
        {...getWpsgDebugProps('CompactGridGallery', 'grid')}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: gridMaxWidth,
          marginInline: gridMaxWidth ? 'auto' : undefined,
          gap: toCss(gap, gapUnit),
          justifyContent: common.adapterJustifyContent || 'center',
        }}
      >
        {media.map((item, index) => (
          <Box
            key={item.id}
            style={{
              flexBasis: `min(${cardWidthCss}, calc(50% - ${toCss(gap / 2, gapUnit)}))`,
              maxWidth: cardWidthCss,
              minWidth: 0,
            }}
          >
            <GridCard
              item={item}
              index={index}
              aspectRatio={aspectRatio}
              minHeight={minCardHeight > 0 ? toCssOrNumber(minCardHeight, 'px') : undefined}
              borderRadius={item.type === 'video' ? toCssOrNumber(settings.videoBorderRadius, settings.videoBorderRadiusUnit) : borderRadius}
              onOpen={openAt}
            />
          </Box>
        ))}
      </Box>

      <Lightbox
        isOpen={lightboxOpen}
        media={media}
        currentIndex={currentIndex}
        onPrev={prev}
        onNext={next}
        onClose={closeLightbox}
        videoMaxWidth={settings.lightboxVideoMaxWidth}
        videoMaxWidthUnit={settings.lightboxVideoMaxWidthUnit}
        videoHeight={settings.lightboxVideoHeight}
        videoHeightUnit={settings.lightboxVideoHeightUnit}
        mediaMaxHeight={settings.lightboxMediaMaxHeight}
      />
    </Stack>
  );
}

setWpsgDebugDisplayName(CompactGridGallery, 'CompactGridGallery');

// ─── Internal card component ────────────────────────────────────────────────

interface GridCardProps {
  item: MediaItem;
  index: number;
  aspectRatio: string;
  minHeight?: number | string | undefined;
  borderRadius: number | string;
  onOpen: (index: number) => void;
}

function GridCard({ item, index, aspectRatio, minHeight, borderRadius, onOpen }: GridCardProps) {
  const [hovered, setHovered] = useState(false);
  const isVideo = item.type === 'video';
  const thumbSrc = item.thumbnail || item.url;
  const label = item.caption
    ? `${isVideo ? 'Play' : 'View'}: ${item.caption}`
    : `${isVideo ? 'Play' : 'View'} ${isVideo ? 'video' : 'image'} ${index + 1}`;

  return (
    <Box
      {...getWpsgDebugProps('CompactGridGallery', 'card')}
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
        aspectRatio,
        minHeight,
        /* Reset button styles */
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        /* Card appearance */
        borderRadius,
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--wpsg-color-surface, #1a1a2e)',
        /* Elevation + pop on hover */
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.35)'
          : '0 2px 6px rgba(0,0,0,0.15)',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.3s ease, box-shadow 0.25s ease',
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
          transition: 'opacity 0.2s ease',
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
            background: OVERLAY_BG,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10,
            color: OVERLAY_TEXT,
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

setWpsgDebugDisplayName(GridCard, 'GridCard');
