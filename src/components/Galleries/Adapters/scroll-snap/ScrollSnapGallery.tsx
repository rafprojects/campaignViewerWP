/**
 * P31-F: Vertical Scroll Snap Gallery Adapter  (adapter id = "scroll-snap")
 *
 * A bounded, section-scoped gallery where items are arranged vertically inside
 * a CSS scroll-snap container. Each item fills the container height and snaps
 * into place on scroll.
 *
 * Contract:
 *  - The snap container occupies the gallery section bounds — it does NOT claim
 *    the full browser viewport. Section height is derived from the measured
 *    container dimensions (GallerySectionWrapper) or falls back to 500 px.
 *  - Click/lightbox interaction remains authoritative; no inline video playback
 *    or autoplay is introduced in this pass.
 *  - Body-scroll locking, lightbox entry/exit, and keyboard navigation all
 *    delegate to the shared `useLightbox` hook unchanged.
 *  - In per-type layouts, selecting this adapter triggers the side-by-side
 *    equal-height opt-out in `PerTypeGallerySection` so two competing snap
 *    containers are never presented side-by-side.
 *
 * Settings:
 *  - `scrollSnapAlignment`: CSS snap-align value for each slide ('start' | 'center' | 'end').
 *  - `scrollSnapPageIndicator`: whether to render an "n / total" slide counter.
 */
import { useCallback, useRef } from 'react';
import { Box, Stack, Text, Title } from '@mantine/core';
import { IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCss, toCssOrNumber } from '@wp-super-gallery/shared-utils';
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

/** Fallback snap container height when the section has no measured height. */
const FALLBACK_HEIGHT_PX = 500;

interface ScrollSnapGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function ScrollSnapGallery({
  media,
  settings,
  runtime,
  containerDimensions,
}: ScrollSnapGalleryProps) {
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const { isOpen: lightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    enableArrowNavigation: true,
    onPrev: prev,
    onNext: next,
  });

  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  // ── Settings resolution ───────────────────────────────────────────────────
  const snapAlignment = settings.scrollSnapAlignment ?? 'start';
  const showPageIndicator = settings.scrollSnapPageIndicator ?? true;
  const snapMaxWidth = settings.scrollSnapMaxWidth ?? 0;
  const snapMaxWidthUnit = settings.scrollSnapMaxWidthUnit ?? 'px';

  // Bounded height only — see _shared/sectionHeight.ts. Adopting the measured
  // section height in the default `auto` mode would feed a runaway growth loop.
  const snapHeight = resolveBoundedSectionHeight(
    common.sectionHeightMode,
    containerDimensions?.height,
    FALLBACK_HEIGHT_PX,
  );
  const snapHeightCss = `${snapHeight}px`;

  const imageBorderRadius = toCssOrNumber(
    settings.imageBorderRadius,
    settings.imageBorderRadiusUnit ?? 'px',
  );
  const videoBorderRadius = toCssOrNumber(
    settings.videoBorderRadius,
    settings.videoBorderRadiusUnit ?? 'px',
  );

  const adapterSizing = resolveAdapterShellStyle(common);

  // ── Scroll synchronisation ────────────────────────────────────────────────
  // Keep currentIndex in sync with programmatic scroll (prev/next from lightbox).
  // We do NOT auto-scroll on index change here because the snap container handles
  // its own position; syncing only updates the page indicator and lightbox index.
  const snapContainerRef = useRef<HTMLDivElement | null>(null);

  const handleSlideClick = useCallback(
    (idx: number) => {
      setCurrentIndex(idx);
      openLightbox();
    },
    [setCurrentIndex, openLightbox],
  );

  const handleScroll = useCallback(() => {
    const el = snapContainerRef.current;
    if (!el || snapHeight <= 0) return;
    const newIndex = Math.round(el.scrollTop / snapHeight);
    if (newIndex !== currentIndex) {
      setCurrentIndex(Math.max(0, Math.min(newIndex, media.length - 1)));
    }
  }, [currentIndex, media.length, setCurrentIndex, snapHeight]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Stack
      gap="xs"
      style={{
        ...adapterSizing,
        ...(snapMaxWidth > 0 ? { maxWidth: toCss(snapMaxWidth, snapMaxWidthUnit), marginInline: 'auto' } : {}),
      }}
      {...getWpsgDebugProps('ScrollSnapGallery')}
    >
      {/* Optional gallery heading */}
      {heading.visible && (
        <Title
          order={3}
          size="h5"
          ta={common.galleryLabelJustification || 'left'}
        >
          {heading.label}
        </Title>
      )}

      {/* Snap container */}
      <Box
        ref={snapContainerRef}
        onScroll={handleScroll}
        {...getWpsgDebugProps('ScrollSnapGallery', 'snap-container')}
        style={{
          height: snapHeightCss,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          position: 'relative',
          // Prevent momentum scroll from overshooting on iOS
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {media.length === 0 ? (
          /* Empty state: show a centred placeholder at full snap height */
          <Box
            style={{
              height: snapHeightCss,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--mantine-color-dimmed, #868e96)',
            }}
          >
            <Text size="sm">No media</Text>
          </Box>
        ) : (
          media.map((item, idx) => {
            const isVideo = item.type === 'video';
            const br = isVideo ? videoBorderRadius : imageBorderRadius;

            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={item.caption || item.title || `Slide ${idx + 1} of ${media.length}`}
                onClick={() => handleSlideClick(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); // Space must not scroll the container/page on role="button"
                    handleSlideClick(idx);
                  }
                }}
                {...getWpsgDebugProps('ScrollSnapGallery', 'slide')}
                style={{
                  height: snapHeightCss,
                  scrollSnapAlign: snapAlignment,
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: br,
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
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
                  className="wpsg-snap-overlay"
                >
                  {isVideo ? (
                    <IconPlayerPlay
                      size={48}
                      color="white"
                      style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))', opacity: 0.85 }}
                    />
                  ) : (
                    <IconZoomIn
                      size={40}
                      color="white"
                      className="wpsg-snap-zoom"
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
                      }}
                    />
                  )}
                </Box>

                {/* Page indicator */}
                {showPageIndicator && (
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: 12,
                      right: 12,
                      background: 'rgba(0,0,0,0.55)',
                      color: 'white',
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      borderRadius: 4,
                      padding: '3px 8px',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  >
                    {idx + 1} / {media.length}
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Hover styles */}
      <style>{`
        [data-wpsg="ScrollSnapGallery"][data-wpsg-role="slide"]:hover .wpsg-snap-overlay {
          background: rgba(0,0,0,0.22) !important;
        }
        [data-wpsg="ScrollSnapGallery"][data-wpsg-role="slide"]:hover .wpsg-snap-zoom {
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

setWpsgDebugDisplayName(ScrollSnapGallery, 'ScrollSnapGallery');
