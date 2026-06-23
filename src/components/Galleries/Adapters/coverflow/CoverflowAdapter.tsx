/**
 * P48-G: Coverflow / 3D Adapter  (adapter id = "coverflow")
 *
 * A CSS perspective carousel where the active item is centered and full-size;
 * flanking items are rotated on the Y axis and scaled down to give a 3D coverflow
 * effect. Navigation via click, keyboard arrows, and swipe gestures.
 */
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Text, Title } from '@mantine/core';
import { IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCssOrNumber, useSwipe } from '@wp-super-gallery/shared-utils';
import { useCarousel } from '@wp-super-gallery/shared-utils';
import { useLightbox } from '@wp-super-gallery/shared-utils';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import {
  resolveAdapterShellStyle,
  resolveGalleryComponentCommonSettings,
  resolveGalleryHeading,
} from '../_shared/runtimeCommon';
import { resolveBoundedSectionHeight } from '@wp-super-gallery/shared-utils';

const FALLBACK_HEIGHT_PX = 500;
/** Width of each item as a fraction of the container width */
const ITEM_WIDTH_RATIO = 0.6;
/** Horizontal stride between item centers (fraction of container width) */
const ITEM_STRIDE_RATIO = 0.28;
/** Max visible items on each side of the active item */
const MAX_VISIBLE_SIDE = 2;

interface CoverflowAdapterProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function CoverflowAdapter({
  media,
  settings,
  runtime,
  containerDimensions,
}: CoverflowAdapterProps) {
  const { t } = useTranslation('wpsg');
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const { isOpen: lightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    enableArrowNavigation: true,
    onPrev: prev,
    onNext: next,
  });

  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);
  const adapterSizing = resolveAdapterShellStyle(common);

  // Bounded height only — see _shared/sectionHeight.ts. In the default `auto`
  // height mode the section is content-sized, so adopting the measured height
  // here would feed a runaway growth loop.
  const containerHeight = resolveBoundedSectionHeight(
    common.sectionHeightMode,
    containerDimensions?.height,
    FALLBACK_HEIGHT_PX,
  );
  const containerWidth =
    containerDimensions?.width && containerDimensions.width > 0
      ? containerDimensions.width
      : 800;

  const imageBorderRadius = toCssOrNumber(
    settings.imageBorderRadius,
    settings.imageBorderRadiusUnit ?? 'px',
  );
  const videoBorderRadius = toCssOrNumber(
    settings.videoBorderRadius,
    settings.videoBorderRadiusUnit ?? 'px',
  );

  const itemWidth = containerWidth * ITEM_WIDTH_RATIO;
  const itemStride = containerWidth * ITEM_STRIDE_RATIO;

  const swipeHandlers = useSwipe({ onSwipeLeft: next, onSwipeRight: prev });

  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
    },
    [prev, next],
  );

  const handleItemClick = useCallback(
    (idx: number) => {
      if (idx === currentIndex) {
        openLightbox();
      } else {
        setCurrentIndex(idx);
      }
    },
    [currentIndex, openLightbox, setCurrentIndex],
  );

  return (
    <Stack gap="xs" style={adapterSizing} {...getWpsgDebugProps('CoverflowAdapter')}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          {heading.label}
        </Title>
      )}

      <Box
        ref={containerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        {...swipeHandlers}
        {...getWpsgDebugProps('CoverflowAdapter', 'stage')}
        style={{
          position: 'relative',
          height: containerHeight,
          overflow: 'hidden',
          perspective: '1000px',
          outline: 'none',
          cursor: 'default',
        }}
      >
        {media.length === 0 ? (
          <Box
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mantine-color-dimmed, #868e96)',
            }}
          >
            <Text size="sm">{t('gallery_no_media', 'No media')}</Text>
          </Box>
        ) : (
          media.map((item, idx) => {
            const offset = idx - currentIndex;
            const absOffset = Math.abs(offset);
            const isActive = offset === 0;
            const isVisible = absOffset <= MAX_VISIBLE_SIDE;

            // Rotation: ±45deg for ±1, ±75deg for ±2, ±90deg for further
            const rotateY = isActive ? 0 : Math.sign(offset) * Math.min(45 + (absOffset - 1) * 30, 90);
            // Scale: 1 for active, 0.8 for ±1, 0.65 for ±2
            const scale = isActive ? 1 : Math.max(1 - absOffset * 0.175, 0.5);
            const translateX = offset * itemStride;
            // Active item on top, flanking items behind
            const zIndex = MAX_VISIBLE_SIDE - absOffset + 1;

            const isVideo = item.type === 'video';
            const br = isVideo ? videoBorderRadius : imageBorderRadius;

            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={isVisible ? 0 : -1}
                aria-label={item.caption || item.title || t('gallery_item_position', 'Item {{index}} of {{total}}', { index: idx + 1, total: media.length })}
                onClick={() => handleItemClick(idx)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && isVisible) {
                    e.preventDefault();
                    handleItemClick(idx);
                  }
                }}
                {...getWpsgDebugProps('CoverflowAdapter', 'item')}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  width: itemWidth,
                  height: containerHeight,
                  marginLeft: -itemWidth / 2,
                  borderRadius: br,
                  overflow: 'hidden',
                  cursor: isVisible ? 'pointer' : 'default',
                  zIndex,
                  opacity: isVisible ? (isActive ? 1 : 0.75) : 0,
                  pointerEvents: isVisible ? 'auto' : 'none',
                  transform: `translateX(${translateX}px) rotateY(${rotateY}deg) scale(${scale})`,
                  transformOrigin: offset < 0 ? 'right center' : offset > 0 ? 'left center' : 'center center',
                  transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease',
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
                  boxShadow: isActive
                    ? '0 8px 40px rgba(0,0,0,0.45)'
                    : '0 4px 16px rgba(0,0,0,0.25)',
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

                {/* Icon overlay */}
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0)',
                    transition: 'background 0.2s ease',
                    pointerEvents: 'none',
                  }}
                  {...(isActive ? { className: 'wpsg-cf-overlay' } : {})}
                >
                  {isVideo ? (
                    <IconPlayerPlay
                      size={48}
                      color="white"
                      style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))', opacity: 0.85 }}
                    />
                  ) : isActive ? (
                    <IconZoomIn
                      size={40}
                      color="white"
                      className="wpsg-cf-zoom"
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
                      }}
                    />
                  ) : null}
                </Box>
              </Box>
            );
          })
        )}
      </Box>

      {/* Hover styles for active item */}
      <style>{`
        [data-wpsg="CoverflowAdapter"][data-wpsg-role="item"]:hover .wpsg-cf-overlay {
          background: rgba(0,0,0,0.22) !important;
        }
        [data-wpsg="CoverflowAdapter"][data-wpsg-role="item"]:hover .wpsg-cf-zoom {
          opacity: 1 !important;
        }
      `}</style>

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

setWpsgDebugDisplayName(CoverflowAdapter, 'CoverflowAdapter');
