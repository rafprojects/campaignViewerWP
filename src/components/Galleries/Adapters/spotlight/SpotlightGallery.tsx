/**
 * P31-E: Spotlight / Hero Gallery Adapter  (adapter id = "spotlight")
 *
 * One dominant hero item with a supporting thumbnail strip. The active
 * index is the single source of truth: thumbnail selection, prev/next
 * navigation, and the lightbox entry point all derive from it.
 *
 * Strip orientation is controlled by `spotlightStripPosition`:
 *   - 'below' — horizontal strip below the hero (default, all widths)
 *   - 'right'  — vertical strip to the right of the hero when the
 *                container is wide enough (≥ 480 px); falls back to
 *                'below' on narrow containers automatically.
 *
 * Video items appear in the hero area as a thumbnail + play overlay.
 * Full playback continues to flow through the existing Lightbox rather
 * than introducing a second inline playback model.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Title } from '@mantine/core';
import { IconPlayerPlay, IconZoomIn, IconPhoto } from '@tabler/icons-react';
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

interface SpotlightGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

/** Minimum container width (px) at which the strip moves to the right side. */
const RIGHT_STRIP_MIN_WIDTH = 480;

export function SpotlightGallery({
  media,
  settings,
  runtime,
  containerDimensions,
}: SpotlightGalleryProps) {
  const { t } = useTranslation('wpsg');
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const { isOpen: lightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    enableArrowNavigation: true,
    onPrev: prev,
    onNext: next,
  });

  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  // ── Settings resolution ───────────────────────────────────────────────────
  const heroAspectRatio = settings.spotlightHeroAspectRatio ?? '16:9';
  const thumbSize = settings.spotlightThumbnailSize ?? 80;
  const thumbSizeUnit = settings.spotlightThumbnailSizeUnit ?? 'px';
  const transitionMs = settings.spotlightTransitionDuration ?? 250;
  const stripPositionSetting = settings.spotlightStripPosition ?? 'below';
  const heroMaxWidth = settings.spotlightHeroMaxWidth ?? 0;
  const heroMaxWidthUnit = settings.spotlightHeroMaxWidthUnit ?? 'px';
  // Dedicated hero justification (independent of the shared adapterJustifyContent
  // grid-item-distribution setting). Maps to flexbox justify-content values.
  const heroJustifyContent =
    { start: 'flex-start', center: 'center', end: 'flex-end' }[
      settings.spotlightHeroJustification ?? 'center'
    ] ?? 'center';

  // Strip placement: honour 'right' only when container is wide enough.
  const containerWidth = containerDimensions?.width ?? 0;
  const stripOnRight =
    stripPositionSetting === 'right' && containerWidth >= RIGHT_STRIP_MIN_WIDTH;

  const activeItem = media[currentIndex] ?? null;
  const isActiveVideo = activeItem?.type === 'video';

  const heroAspectCss = heroAspectRatio.replace(':', ' / ');
  const thumbSizeCss = toCss(thumbSize, thumbSizeUnit);

  const imageBorderRadius = toCssOrNumber(
    settings.imageBorderRadius,
    settings.imageBorderRadiusUnit ?? 'px',
  );
  const videoBorderRadius = toCssOrNumber(
    settings.videoBorderRadius,
    settings.videoBorderRadiusUnit ?? 'px',
  );

  const heroBorderRadius = isActiveVideo ? videoBorderRadius : imageBorderRadius;
  const adapterSizing = resolveAdapterShellStyle(common);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectThumbnail = useCallback(
    (idx: number) => { setCurrentIndex(idx); },
    [setCurrentIndex],
  );

  const handleHeroClick = useCallback(() => {
    if (media.length > 0) openLightbox();
  }, [media.length, openLightbox]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Stack
      gap="xs"
      style={adapterSizing}
      {...getWpsgDebugProps('SpotlightGallery')}
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

      {/* Justification wrapper: positions the (optionally max-width-capped)
          hero+strip block within the full adapter width, via the dedicated
          `spotlightHeroJustification` setting. */}
      <Box style={{ display: 'flex', justifyContent: heroJustifyContent, width: '100%' }}>
        {/* Hero + strip layout container. `spotlightHeroMaxWidth` caps this
            block; `alignItems: 'stretch'` in below mode makes the hero fill the
            block width, so raising Hero Max Width actually enlarges the hero
            (previously the block shrink-wrapped and the hero was pinned left). */}
        <Box
          style={{
            display: 'flex',
            flexDirection: stripOnRight ? 'row' : 'column',
            gap: 8,
            alignItems: stripOnRight ? 'flex-start' : 'stretch',
            width: '100%',
            ...(heroMaxWidth > 0 ? { maxWidth: toCss(heroMaxWidth, heroMaxWidthUnit) } : {}),
          }}
        >
        {/* ── Hero area ─────────────────────────────────────────────────── */}
        <Box
          role="button"
          tabIndex={0}
          aria-label={
            activeItem?.caption ||
            activeItem?.title ||
            t('gallery_open_lightbox', 'Open in lightbox')
          }
          onClick={handleHeroClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); // Space must not scroll the page on role="button"
              handleHeroClick();
            }
          }}
          {...getWpsgDebugProps('SpotlightGallery', 'hero')}
          style={{
            flex: 1,
            minWidth: 0,
            position: 'relative',
            aspectRatio: heroAspectCss,
            overflow: 'hidden',
            borderRadius: heroBorderRadius,
            background: 'var(--wpsg-color-surface, #1a1a2e)',
            cursor: media.length > 0 ? 'pointer' : 'default',
          }}
        >
          {activeItem ? (
            <>
              <LazyImage
                src={activeItem.thumbnail || activeItem.url}
                alt={activeItem.caption || activeItem.title || ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  transition: `opacity ${transitionMs}ms ease`,
                }}
              />
              {/* Video: play overlay */}
              {isActiveVideo && (
                <Box
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.28)',
                    pointerEvents: 'none',
                  }}
                >
                  <IconPlayerPlay
                    size={56}
                    color="white"
                    style={{ filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.9))' }}
                  />
                </Box>
              )}
              {/* Image: hover zoom icon hint */}
              {!isActiveVideo && (
                <Box
                  className="wpsg-spotlight-hero-hint"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0)',
                    transition: `background ${transitionMs}ms ease`,
                    pointerEvents: 'none',
                  }}
                >
                  <IconZoomIn
                    size={40}
                    color="white"
                    className="wpsg-spotlight-hero-zoom"
                    style={{
                      opacity: 0,
                      transition: `opacity ${transitionMs}ms ease`,
                      filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
                    }}
                  />
                </Box>
              )}
            </>
          ) : (
            /* Empty state */
            <Box
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--mantine-color-dimmed, #868e96)',
                gap: 8,
              }}
            >
              <IconPhoto size={32} opacity={0.4} />
            </Box>
          )}
        </Box>

        {/* ── Thumbnail strip ────────────────────────────────────────────── */}
        <Box
          style={{
            display: 'flex',
            flexDirection: stripOnRight ? 'column' : 'row',
            gap: 8,
            overflowX: stripOnRight ? 'hidden' : 'auto',
            overflowY: stripOnRight ? 'auto' : 'hidden',
            flexShrink: 0,
            // Horizontal strip: limit height to thumbSizeCss + scrollbar room
            ...(stripOnRight
              ? { maxHeight: '100%' }
              : { paddingBottom: 4 }),
          }}
        >
          {media.map((item, idx) => {
            const isActive = idx === currentIndex;
            const isVid = item.type === 'video';
            const thumbBr = toCssOrNumber(
              isVid ? settings.videoBorderRadius : settings.imageBorderRadius,
              (isVid
                ? settings.videoBorderRadiusUnit
                : settings.imageBorderRadiusUnit) ?? 'px',
            );

            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.caption || item.title || t('gallery_item_index', 'Item {{index}}', { index: idx + 1 })}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => selectThumbnail(idx)}
                {...getWpsgDebugProps('SpotlightGallery', 'thumbnail')}
                style={{
                  width: thumbSizeCss,
                  height: thumbSizeCss,
                  flexShrink: 0,
                  padding: 0,
                  border: isActive
                    ? '2px solid var(--wpsg-color-primary, #7c9ef8)'
                    : '2px solid transparent',
                  borderRadius: thumbBr,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  position: 'relative',
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
                  transition: `border-color ${transitionMs}ms ease`,
                  opacity: isActive ? 1 : 0.7,
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
                {isVid && (
                  <Box
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                    }}
                  >
                    <IconPlayerPlay size={16} color="white" />
                  </Box>
                )}
              </button>
            );
          })}
        </Box>
        </Box>
      </Box>

      {/* Hover styles for the hero area */}
      <style>{`
        [data-wpsg="SpotlightGallery"][data-wpsg-role="hero"]:hover .wpsg-spotlight-hero-hint {
          background: rgba(0,0,0,0.28) !important;
        }
        [data-wpsg="SpotlightGallery"][data-wpsg-role="hero"]:hover .wpsg-spotlight-hero-zoom {
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

setWpsgDebugDisplayName(SpotlightGallery, 'SpotlightGallery');
