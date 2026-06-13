/**
 * P48-H: Pinterest / Mosaic Adapter  (adapter id = "pinterest")
 *
 * A CSS Grid layout where each tile's column/row span is derived from the item's
 * aspect ratio. The browser's grid-auto-flow: dense handles gap-filling greedily —
 * no custom JS packing algorithm is needed.
 *
 * Tile buckets (width/height ratio):
 *   ratio ≥ 1.6  →  2 col × 2 row  (hero/landscape)
 *   ratio ≥ 1.2  →  2 col × 1 row  (wide)
 *   ratio ≥ 0.7  →  1 col × 1 row  (square)
 *   ratio < 0.7  →  1 col × 2 row  (portrait)
 *   unknown      →  1 col × 1 row  (fallback)
 *
 * Responsive: 4 columns ≥ 500px; 2 columns < 500px (all tiles 1×1); 1 column < 360px.
 */
import { useCallback, useState } from 'react';
import { Box, Stack, Text, Title } from '@mantine/core';
import { IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { useCarousel } from '@/hooks/useCarousel';
import { useLightbox } from '@/hooks/useLightbox';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import {
  resolveAdapterShellStyle,
  resolveGalleryComponentCommonSettings,
  resolveGalleryHeading,
} from '../_shared/runtimeCommon';

interface TileSpan {
  colSpan: number;
  rowSpan: number;
}

function classifyTile(ratio: number): TileSpan {
  if (ratio >= 1.6) return { colSpan: 2, rowSpan: 2 };
  if (ratio >= 1.2) return { colSpan: 2, rowSpan: 1 };
  if (ratio >= 0.7) return { colSpan: 1, rowSpan: 1 };
  return { colSpan: 1, rowSpan: 2 };
}

interface PinterestAdapterProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function PinterestAdapter({
  media,
  settings,
  runtime,
  containerDimensions,
}: PinterestAdapterProps) {
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const { isOpen: lightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    enableArrowNavigation: true,
    onPrev: prev,
    onNext: next,
  });

  const mediaWithDims = useMediaDimensions(media);

  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);
  const adapterSizing = resolveAdapterShellStyle(common);

  const containerWidth =
    containerDimensions?.width && containerDimensions.width > 0
      ? containerDimensions.width
      : 800;

  // Responsive column count
  const cols = containerWidth < 360 ? 1 : containerWidth < 500 ? 2 : 4;
  const isNarrow = cols < 4;

  // Row unit height: roughly square-ish cells
  const rowUnit = Math.max(Math.floor(containerWidth / cols / 1.2), 80);

  const gap = 8;

  const imageBorderRadius = toCssOrNumber(
    settings.imageBorderRadius,
    settings.imageBorderRadiusUnit ?? 'px',
  );
  const videoBorderRadius = toCssOrNumber(
    settings.videoBorderRadius,
    settings.videoBorderRadiusUnit ?? 'px',
  );

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleClick = useCallback(
    (idx: number) => {
      setCurrentIndex(idx);
      openLightbox();
    },
    [setCurrentIndex, openLightbox],
  );

  return (
    <Stack gap="xs" style={adapterSizing} {...getWpsgDebugProps('PinterestAdapter')}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          {heading.label}
        </Title>
      )}

      {media.length === 0 ? (
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 200,
            color: 'var(--mantine-color-dimmed, #868e96)',
          }}
        >
          <Text size="sm">No media</Text>
        </Box>
      ) : (
        <Box
          {...getWpsgDebugProps('PinterestAdapter', 'grid')}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridAutoRows: `${rowUnit}px`,
            gridAutoFlow: 'row dense',
            gap,
          }}
        >
          {mediaWithDims.map((item, idx) => {
            const ratio =
              item.width && item.height && item.height > 0
                ? item.width / item.height
                : null;

            const { colSpan, rowSpan } = ratio
              ? isNarrow
                ? { colSpan: 1, rowSpan: 1 }
                : classifyTile(ratio)
              : { colSpan: 1, rowSpan: 1 };

            const isVideo = item.type === 'video';
            const br = isVideo ? videoBorderRadius : imageBorderRadius;
            const isHovered = hoveredIdx === idx;

            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={item.caption || item.title || `Item ${idx + 1} of ${media.length}`}
                onClick={() => handleClick(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(idx);
                  }
                }}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                {...getWpsgDebugProps('PinterestAdapter', 'tile')}
                style={{
                  gridColumn: `span ${colSpan}`,
                  gridRow: `span ${rowSpan}`,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: br,
                  cursor: 'pointer',
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                  transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  boxShadow: isHovered
                    ? '0 6px 24px rgba(0,0,0,0.35)'
                    : '0 2px 8px rgba(0,0,0,0.18)',
                }}
              >
                <LazyImage
                  src={item.thumbnail || item.url}
                  alt={item.caption || item.title || ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />

                {/* Hover overlay */}
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isHovered ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0)',
                    transition: 'background 0.18s ease',
                    pointerEvents: 'none',
                  }}
                >
                  {isVideo ? (
                    <IconPlayerPlay
                      size={48}
                      color="white"
                      style={{
                        filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))',
                        opacity: 0.85,
                      }}
                    />
                  ) : (
                    <IconZoomIn
                      size={36}
                      color="white"
                      style={{
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.18s ease',
                        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
                      }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

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

setWpsgDebugDisplayName(PinterestAdapter, 'PinterestAdapter');
