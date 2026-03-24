/**
 * P22-P3: Unified Media Carousel Adapter
 *
 * Replaces ImageCarousel + VideoCarousel with a single adapter-system
 * component that handles both images and videos via shared navigation,
 * transition, and swipe logic.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { IconPhoto, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { Stack, Title, Group, ActionIcon, Image, Text, Box } from '@mantine/core';
import type { GalleryAdapterProps } from './GalleryAdapter';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { useCarousel } from '@/hooks/useCarousel';
import { useMediaTransition } from '@/hooks/useMediaTransition';
import { useLightbox } from '@/hooks/useLightbox';
import { useSwipe } from '@/hooks/useSwipe';
import { OverlayArrows } from '@/components/Galleries/Shared/OverlayArrows';
import { DotNavigator } from '@/components/Galleries/Shared/DotNavigator';
import { resolveBoxShadow } from '@/utils/shadowPresets';
import { combineMaxWidthConstraints, resolveBreakpointValue } from '@/utils/resolveBreakpointValue';

const Lightbox = lazy(() =>
  import('@/components/Galleries/Shared/Lightbox').then((m) => ({ default: m.Lightbox })),
);

// ── Constants ────────────────────────────────────────────────────────

const IMAGE_ASPECT_RATIO = '3 / 2';
const IMAGE_ASPECT_RATIO_MULTIPLIER = 1.5;
const VIDEO_ASPECT_RATIO = '16 / 9';
const VIDEO_ASPECT_RATIO_MULTIPLIER = 16 / 9;

const VIEWPORT_MAX_HEIGHTS: Record<Breakpoint, string> = {
  desktop: 'min(calc(100dvh - 16rem), 68dvh)',
  tablet: 'min(calc(100dvh - 10rem), 74dvh)',
  mobile: 'min(calc(100dvh - 6rem), 82dvh)',
};
const VIEWPORT_MAX_WIDTHS: Record<Breakpoint, string> = {
  desktop: '72vw',
  tablet: '88vw',
  mobile: '94vw',
};

const CSS_HEIGHT_VALUE_RE = /^\s*\d+(?:\.\d+)?\s*(px|em|rem|vh|dvh|svh|lvh|vw|%)\s*$/i;

// Breakpoint thresholds (matches useBreakpoint / Mantine defaults)
const BP_MOBILE_MAX = 768;
const BP_TABLET_MAX = 1200;

// ── Helpers ──────────────────────────────────────────────────────────

function resolveManualHeight(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  return CSS_HEIGHT_VALUE_RE.test(trimmed) ? trimmed : fallback;
}

function withAutoplay(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('autoplay', '1');
    return parsed.toString();
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
  }
}

function deriveBreakpoint(containerWidth: number | undefined): Breakpoint {
  if (!containerWidth || containerWidth >= BP_TABLET_MAX) return 'desktop';
  if (containerWidth >= BP_MOBILE_MAX) return 'tablet';
  return 'mobile';
}

// ── Component ────────────────────────────────────────────────────────

export function MediaCarouselAdapter({
  media,
  settings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  containerDimensions,
}: GalleryAdapterProps) {
  if (media.length === 0) return null;

  return (
    <MediaCarouselInner
      media={media}
      settings={settings}
      breakpoint={deriveBreakpoint(containerDimensions?.width)}
      maxWidth={containerDimensions?.width ?? 0}
    />
  );
}

/** Props for direct usage (deprecation wrappers). */
export interface MediaCarouselInnerProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  breakpoint: Breakpoint;
  maxWidth: number;
}

/** @internal Exported for backward-compat wrappers — prefer MediaCarouselAdapter. */
export function MediaCarouselInner({ media, settings, breakpoint, maxWidth }: MediaCarouselInnerProps) {
  const { currentIndex, direction, setCurrentIndex, next: nextRaw, prev: prevRaw } = useCarousel(media.length);
  const { previousItem, enterRef, exitRef, beginTransition, setPreviousForJump, clearPrevious } =
    useMediaTransition(settings, currentIndex, direction, media);

  const [isPlaying, setIsPlaying] = useState(false);

  const currentItem = media[currentIndex];
  const isVideo = currentItem.type === 'video';
  const isUploadVideo = isVideo && currentItem.source === 'upload';

  // Reset play state on navigation
  useEffect(() => setIsPlaying(false), [currentIndex]);

  const navigate = useCallback(
    (fn: () => void) => {
      beginTransition(fn);
    },
    [beginTransition],
  );

  const nextItem = useCallback(() => navigate(nextRaw), [navigate, nextRaw]);
  const prevItem = useCallback(() => navigate(prevRaw), [navigate, prevRaw]);

  // Lightbox: only images use it
  const { isOpen: isLightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    onPrev: prevItem,
    onNext: nextItem,
  });

  const swipeHandlers = useSwipe({
    onSwipeLeft: nextItem,
    onSwipeRight: prevItem,
  });

  // ── Media type analysis ──────────────────────────────────────────

  const images = useMemo(() => media.filter((m) => m.type === 'image'), [media]);
  const videos = useMemo(() => media.filter((m) => m.type === 'video'), [media]);
  const isMixed = images.length > 0 && videos.length > 0;
  const dominantType = images.length >= videos.length ? 'image' : 'video';

  const aspectRatio = dominantType === 'image' ? IMAGE_ASPECT_RATIO : VIDEO_ASPECT_RATIO;
  const aspectMultiplier = dominantType === 'image' ? IMAGE_ASPECT_RATIO_MULTIPLIER : VIDEO_ASPECT_RATIO_MULTIPLIER;

  // ── Section label ────────────────────────────────────────────────

  const sectionLabel = isMixed
    ? `Media (${media.length})`
    : videos.length > 0
      ? `${settings.galleryVideoLabel || 'Videos'} (${videos.length})`
      : `${settings.galleryImageLabel || 'Images'} (${images.length})`;
  const LabelIcon = videos.length > 0 && images.length === 0 ? IconPlayerPlay : IconPhoto;

  // ── Height calculation (unified from both carousels) ─────────────

  const heightMultiplier = breakpoint === 'mobile' ? 0.55 : breakpoint === 'tablet' ? 0.75 : 1.0;
  const heightConstraint = settings.gallerySizingMode ?? 'auto';

  const baseHeight = dominantType === 'image' ? settings.imageViewportHeight : settings.videoViewportHeight;
  const standardHeight = useMemo(() => {
    const base = Math.max(180, Math.min(900, baseHeight));
    return `${Math.round(base * heightMultiplier)}px`;
  }, [baseHeight, heightMultiplier]);

  const manualHeight = useMemo(
    () => resolveManualHeight(settings.galleryManualHeight, standardHeight),
    [settings.galleryManualHeight, standardHeight],
  );

  const viewportMaxHeight = resolveBreakpointValue(breakpoint, VIEWPORT_MAX_HEIGHTS);
  const viewportWidthCap = resolveBreakpointValue(breakpoint, VIEWPORT_MAX_WIDTHS);
  const viewportFrameMaxWidth = useMemo(
    () => `calc(${viewportMaxHeight} * ${aspectMultiplier})`,
    [viewportMaxHeight, aspectMultiplier],
  );

  const configuredMaxWidth = maxWidth > 0 ? `${maxWidth}px` : undefined;
  const frameMaxWidth =
    heightConstraint === 'viewport'
      ? combineMaxWidthConstraints(configuredMaxWidth, viewportFrameMaxWidth, viewportWidthCap)
      : configuredMaxWidth;

  // ── Style based on dominant type ─────────────────────────────────

  const borderRadius = dominantType === 'image'
    ? `${settings.imageBorderRadius}px`
    : `${settings.videoBorderRadius}px`;
  const boxShadow = dominantType === 'image'
    ? resolveBoxShadow(settings.imageShadowPreset, settings.imageShadowCustom)
    : resolveBoxShadow(settings.videoShadowPreset, settings.videoShadowCustom);

  // ── Dot navigator handler ────────────────────────────────────────

  const handleDotSelect = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        setPreviousForJump(media[currentIndex]);
      }
      setCurrentIndex(index);
      setIsPlaying(false);
    },
    [currentIndex, media, setPreviousForJump, setCurrentIndex],
  );

  // ── Render helpers ───────────────────────────────────────────────

  const playerTitle = useMemo(
    () => `Video player: ${currentItem.caption || 'Campaign video'}`,
    [currentItem.caption],
  );

  const renderCurrentMedia = () => {
    if (isVideo) {
      if (isPlaying) {
        return isUploadVideo ? (
          <Box
            data-testid="video-player-surface"
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
          >
            <video
              src={currentItem.url}
              controls
              autoPlay
              playsInline
              poster={currentItem.thumbnail}
              aria-label={playerTitle}
              style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'transparent' }}
            />
          </Box>
        ) : (
          <Box
            data-testid="video-player-surface"
            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}
          >
            <iframe
              src={withAutoplay(currentItem.embedUrl ?? currentItem.url)}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={playerTitle}
              style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
            />
          </Box>
        );
      }

      // Video thumbnail + play button
      return (
        <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}>
          <Image
            src={currentItem.thumbnail}
            alt={currentItem.caption || 'Campaign video'}
            h="100%"
            fit="contain"
            style={{ cursor: 'pointer' }}
            onClick={() => setIsPlaying(true)}
          />
          <ActionIcon
            pos="absolute"
            top="50%"
            left="50%"
            style={{ transform: 'translate(-50%, -50%)' }}
            size="xl"
            radius="xl"
            onClick={() => setIsPlaying(true)}
            aria-label="Play video"
          >
            <IconPlayerPlay size={32} fill="currentColor" />
          </ActionIcon>
        </div>
      );
    }

    // Image
    return (
      <Image
        src={currentItem.url}
        alt={currentItem.caption || 'Campaign image'}
        fit="contain"
        h="100%"
        style={{ cursor: 'zoom-in' }}
      />
    );
  };

  const renderPreviousOverlay = () => {
    if (!previousItem) return null;
    const src = previousItem.type === 'video'
      ? (previousItem.thumbnail || previousItem.url)
      : previousItem.url;
    return (
      <Box
        ref={exitRef as React.RefObject<HTMLDivElement>}
        onTransitionEnd={() => clearPrevious()}
        style={{
          position: 'absolute',
          inset: 0,
          willChange: 'transform, opacity',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <Image src={src} alt="" aria-hidden fit="contain" h="100%" />
      </Box>
    );
  };

  // ── Frame event handlers ─────────────────────────────────────────

  const handleFrameClick = useCallback(() => {
    if (!isVideo) openLightbox();
  }, [isVideo, openLightbox]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevItem();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextItem();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (isVideo) setIsPlaying(true);
        else openLightbox();
      }
    },
    [isVideo, nextItem, prevItem, openLightbox],
  );

  // ── Main render ──────────────────────────────────────────────────

  const testId = isVideo ? 'video-player-frame' : 'image-viewer-frame';
  const ariaLabel = isVideo
    ? `Video ${currentIndex + 1} of ${media.length}: ${currentItem.caption || 'Untitled video'}. Use arrow keys to navigate, Enter or Space to play.`
    : `View image ${currentIndex + 1} of ${media.length}`;

  return (
    <Stack gap="md" style={{ width: '100%', maxWidth: configuredMaxWidth }}>
      {settings.showCampaignGalleryLabels !== false && (
        <Title order={3} size="h5" ta={settings.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={settings.galleryLabelJustification || 'left'}>
            {settings.showGalleryLabelIcon && <LabelIcon size={18} />}
            {sectionLabel}
          </Group>
        </Title>
      )}

      {/* Frame container */}
      <Box
        pos="relative"
        data-testid={testId}
        role={isVideo ? 'region' : 'button'}
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={handleFrameClick}
        {...swipeHandlers}
        style={{
          width: '100%',
          maxWidth: frameMaxWidth,
          marginLeft: 'auto',
          marginRight: 'auto',
          touchAction: 'pan-y',
          height: heightConstraint === 'manual' ? manualHeight : 'auto',
          maxHeight: heightConstraint === 'viewport' ? viewportMaxHeight : (heightConstraint === 'manual' ? manualHeight : undefined),
          minHeight: heightConstraint === 'manual' ? manualHeight : undefined,
          aspectRatio: heightConstraint === 'manual' ? undefined : aspectRatio,
          overflow: 'hidden',
          borderRadius,
          boxShadow,
        }}
        onKeyDown={handleKeyDown}
      >
        {renderPreviousOverlay()}

        <Box
          key={`${currentItem.id}-${isVideo && isPlaying ? 'playing' : 'preview'}`}
          ref={enterRef as React.RefObject<HTMLDivElement>}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            willChange: 'transform, opacity',
            zIndex: 2,
          }}
        >
          {renderCurrentMedia()}
        </Box>

        {/* Zoom button — images only */}
        {!isVideo && (
          <ActionIcon
            pos="absolute"
            bottom={12}
            right={12}
            onClick={openLightbox}
            size="lg"
            variant="light"
            aria-label="Open lightbox"
            style={{ zIndex: 3 }}
          >
            <IconZoomIn size={20} />
          </ActionIcon>
        )}

        {/* Overlay navigation arrows */}
        <OverlayArrows
          onPrev={prevItem}
          onNext={nextItem}
          total={media.length}
          settings={settings}
          previousLabel={isVideo ? 'Previous video (overlay)' : 'Previous image (overlay)'}
          nextLabel={isVideo ? 'Next video (overlay)' : 'Next image (overlay)'}
        />

        {/* Overlay dot navigator (inside viewport) */}
        {settings.dotNavPosition !== 'below' && (
          <DotNavigator
            total={media.length}
            currentIndex={currentIndex}
            onSelect={handleDotSelect}
            settings={settings}
          />
        )}
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentItem.caption || (isVideo ? 'Untitled video' : 'Untitled image')}
      </Text>

      {/* Dot navigator (below viewport) */}
      {settings.dotNavPosition === 'below' && (
        <DotNavigator
          total={media.length}
          currentIndex={currentIndex}
          onSelect={handleDotSelect}
          settings={settings}
        />
      )}

      {/* Lightbox — images only */}
      {images.length > 0 && (
        <Suspense fallback={null}>
          <Lightbox
            isOpen={isLightboxOpen}
            media={images}
            currentIndex={Math.max(0, images.indexOf(currentItem))}
            onPrev={prevItem}
            onNext={nextItem}
            onClose={closeLightbox}
          />
        </Suspense>
      )}
    </Stack>
  );
}
