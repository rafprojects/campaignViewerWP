/**
 * P50-C: Stacked / Deck Adapter  (adapter id = "stacked")
 *
 * A card-deck layout where the top card is fully visible and centered while
 * the cards beneath it peek out with alternating translateX/rotate offsets.
 * Swiping (touch/pen) or pressing ArrowRight dismisses the top card to the
 * back of the stack with a fly-out transition; ArrowLeft brings the back
 * card forward again. Clicking the top card opens the lightbox; clicking a
 * peeking card promotes it to the top.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Text, Title } from '@mantine/core';
import { IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { useCarousel } from '@wp-super-gallery/shared-utils';
import { useLightbox } from '@wp-super-gallery/shared-utils';
import { useSwipe } from '@wp-super-gallery/shared-utils';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import {
  resolveAdapterShellStyle,
  resolveGalleryComponentCommonSettings,
  resolveGalleryHeading,
} from '../_shared/runtimeCommon';
import { resolveBoundedSectionHeight } from '@wp-super-gallery/shared-utils';

const FALLBACK_HEIGHT_PX = 480;
const FALLBACK_WIDTH_PX = 800;
/** Width of the card as a fraction of the container width */
const CARD_WIDTH_RATIO = 0.62;
/** Height of the card as a fraction of the container height */
const CARD_HEIGHT_RATIO = 0.92;
/** Horizontal peek offset per depth level; sign alternates per level */
const PEEK_OFFSET_X_PX = 4;
/** Rotation per depth level; sign alternates per level */
const PEEK_ROTATE_DEG = 1.5;
/** Cards deeper than this are fully hidden (still mounted for transitions) */
const MAX_PEEK_DEPTH = 4;
/** Duration of the dismiss fly-out before the card settles at the back */
const FLY_OUT_MS = 320;

interface StackedDeckAdapterProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function StackedDeckAdapter({
  media,
  settings,
  runtime,
  containerDimensions,
}: StackedDeckAdapterProps) {
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
      : FALLBACK_WIDTH_PX;

  const imageBorderRadius = toCssOrNumber(
    settings.imageBorderRadius,
    settings.imageBorderRadiusUnit ?? 'px',
  );
  const videoBorderRadius = toCssOrNumber(
    settings.videoBorderRadius,
    settings.videoBorderRadiusUnit ?? 'px',
  );

  const cardWidth = containerWidth * CARD_WIDTH_RATIO;
  const cardHeight = containerHeight * CARD_HEIGHT_RATIO;
  const cardTop = (containerHeight - cardHeight) / 2;

  // Dismissed card currently flying out; held briefly so it animates over the
  // stack before settling into its back-of-stack pose.
  const [flying, setFlying] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const flyTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (flyTimer.current !== null) window.clearTimeout(flyTimer.current);
  }, []);

  const dismissTop = useCallback(
    (flyDir: 1 | -1) => {
      if (media.length < 2) return;
      const topItem = media[currentIndex];
      if (!topItem) return;
      if (flyTimer.current !== null) window.clearTimeout(flyTimer.current);
      setFlying({ id: topItem.id, dir: flyDir });
      next();
      flyTimer.current = window.setTimeout(() => {
        setFlying(null);
        flyTimer.current = null;
      }, FLY_OUT_MS);
    },
    [media, currentIndex, next],
  );

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => dismissTop(-1),
    onSwipeRight: () => dismissTop(1),
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); dismissTop(-1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault();
        openLightbox();
      }
    },
    [dismissTop, prev, openLightbox],
  );

  const handleCardClick = useCallback(
    (idx: number) => {
      if (idx === currentIndex) {
        openLightbox();
      } else {
        setCurrentIndex(idx);
      }
    },
    [currentIndex, openLightbox, setCurrentIndex],
  );

  const count = media.length;

  return (
    <Stack gap="xs" style={adapterSizing} {...getWpsgDebugProps('StackedDeckAdapter')}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          {heading.label}
        </Title>
      )}

      <Box
        tabIndex={0}
        onKeyDown={handleKeyDown}
        {...swipeHandlers}
        {...getWpsgDebugProps('StackedDeckAdapter', 'stage')}
        style={{
          position: 'relative',
          height: containerHeight,
          overflow: 'hidden',
          outline: 'none',
          touchAction: 'pan-y',
        }}
      >
        {count === 0 ? (
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
            const depth = (idx - currentIndex + count) % count;
            const isTop = depth === 0;
            const isVisible = depth <= MAX_PEEK_DEPTH;
            const isFlying = flying?.id === item.id;

            // Alternate peek direction per depth level with increasing magnitude.
            const dirSign = depth % 2 === 1 ? 1 : -1;
            const translateX = dirSign * depth * PEEK_OFFSET_X_PX;
            const rotate = dirSign * depth * PEEK_ROTATE_DEG;
            const zIndex = isFlying ? count + 1 : count - depth;

            const isVideo = item.type === 'video';
            const br = isVideo ? videoBorderRadius : imageBorderRadius;

            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={isVisible ? 0 : -1}
                aria-label={item.caption || item.title || t('gallery_item_position', 'Item {{index}} of {{total}}', { index: idx + 1, total: count })}
                className={`wpsg-stacked-card${isTop ? ' wpsg-stacked-top' : ''}`}
                onClick={() => handleCardClick(idx)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && isVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCardClick(idx);
                  }
                }}
                {...getWpsgDebugProps('StackedDeckAdapter', 'card')}
                style={{
                  position: 'absolute',
                  top: cardTop,
                  left: '50%',
                  width: cardWidth,
                  height: cardHeight,
                  marginLeft: -cardWidth / 2,
                  borderRadius: br,
                  overflow: 'hidden',
                  cursor: isVisible ? 'pointer' : 'default',
                  zIndex,
                  opacity: isFlying ? 0 : isVisible ? 1 : 0,
                  pointerEvents: isVisible && !isFlying ? 'auto' : 'none',
                  transform: isFlying
                    ? `translateX(${flying.dir * 130}%) rotate(${flying.dir * 14}deg)`
                    : `translateX(${translateX}px) rotate(${rotate}deg)`,
                  transformOrigin: 'center center',
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
                  boxShadow: isTop
                    ? '0 8px 32px rgba(0,0,0,0.4)'
                    : '0 2px 12px rgba(0,0,0,0.25)',
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
                  className="wpsg-sd-overlay"
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
                >
                  {isVideo ? (
                    <IconPlayerPlay
                      size={48}
                      color="white"
                      style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))', opacity: 0.85 }}
                    />
                  ) : isTop ? (
                    <IconZoomIn
                      size={40}
                      color="white"
                      className="wpsg-sd-zoom"
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

      {/* Card transitions + top-card hover affordance */}
      <style>{`
        .wpsg-stacked-card {
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease, box-shadow 0.35s ease;
        }
        .wpsg-stacked-card.wpsg-stacked-top:hover .wpsg-sd-overlay {
          background: rgba(0,0,0,0.22) !important;
        }
        .wpsg-stacked-card.wpsg-stacked-top:hover .wpsg-sd-zoom {
          opacity: 1 !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .wpsg-stacked-card {
            transition: none;
          }
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

setWpsgDebugDisplayName(StackedDeckAdapter, 'StackedDeckAdapter');
