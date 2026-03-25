/**
 * P22-P8d: Unified Media Carousel Adapter (Embla)
 *
 * Replaces the custom useCarousel + useMediaTransition implementation
 * with embla-carousel-react for proper multi-slide carousels,
 * autoplay, drag, loop, and more.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { IconPhoto, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { Stack, Title, Group, ActionIcon, Image, Text, Box } from '@mantine/core';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import type { GalleryAdapterProps } from './GalleryAdapter';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { useLightbox } from '@/hooks/useLightbox';
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
  // ── Embla setup ──────────────────────────────────────────────────

  const visibleCards = Math.max(1, settings.carouselVisibleCards);
  const gap = settings.carouselGap;

  const autoplayPlugin = useMemo(() => {
    if (!settings.carouselAutoplay) return [];
    return [
      Autoplay({
        delay: settings.carouselAutoplaySpeed,
        stopOnInteraction: true,
        stopOnMouseEnter: settings.carouselAutoplayPauseOnHover,
      }),
    ];
  }, [settings.carouselAutoplay, settings.carouselAutoplaySpeed, settings.carouselAutoplayPauseOnHover]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: settings.carouselLoop,
      dragFree: false,
      slidesToScroll: 1,
      align: visibleCards > 1 ? 'start' : 'center',
      containScroll: 'trimSnaps',
      watchDrag: settings.carouselDragEnabled,
      direction: settings.carouselAutoplayDirection === 'rtl' ? 'rtl' : 'ltr',
    },
    autoplayPlugin,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slidesInView, setSlidesInView] = useState<number[]>([]);
  const [playingSlides, setPlayingSlides] = useState<Set<number>>(new Set());

  // Track selected index and visible slides
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
      setSlidesInView(emblaApi.slidesInView());
    };
    const onSlidesInView = () => {
      setSlidesInView(emblaApi.slidesInView());
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('slidesInView', onSlidesInView);

    // Initialize
    onSelect();
    onSlidesInView();

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('slidesInView', onSlidesInView);
    };
  }, [emblaApi]);

  // Pause videos when they scroll out of view
  useEffect(() => {
    if (playingSlides.size === 0) return;
    setPlayingSlides((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (slidesInView.includes(idx)) next.add(idx);
      }
      return next.size === prev.size ? prev : next;
    });
  }, [slidesInView, playingSlides.size]);

  const currentItem = media[selectedIndex];

  // Navigation
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  // ── Lightbox ─────────────────────────────────────────────────────

  const { isOpen: isLightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    onPrev: scrollPrev,
    onNext: scrollNext,
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

  // ── Height calculation ───────────────────────────────────────────

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
      scrollTo(index);
    },
    [scrollTo],
  );

  // ── Slide flex basis ─────────────────────────────────────────────

  const slideBasis = useMemo(() => {
    if (visibleCards <= 1) return '100%';
    const totalGap = (visibleCards - 1) * gap;
    return `calc((100% - ${totalGap}px) / ${visibleCards})`;
  }, [visibleCards, gap]);

  // ── Keyboard nav ─────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollNext();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const item = media[selectedIndex];
        if (item?.type === 'video') {
          setPlayingSlides((prev) => new Set(prev).add(selectedIndex));
        } else {
          openLightbox();
        }
      }
    },
    [media, selectedIndex, scrollPrev, scrollNext, openLightbox],
  );

  // ── Render slide ─────────────────────────────────────────────────

  const renderSlide = (item: MediaItem, index: number) => {
    const isSlideVideo = item.type === 'video';
    const isSlideUploadVideo = isSlideVideo && item.source === 'upload';
    const isSlidePlaying = playingSlides.has(index);
    const playerTitle = `Video player: ${item.caption || 'Campaign video'}`;
    const showDarken = settings.carouselDarkenUnfocused && index !== selectedIndex;

    return (
      <div
        key={item.id}
        role="group"
        aria-roledescription="slide"
        aria-label={`Slide ${index + 1} of ${media.length}`}
        style={{
          flex: `0 0 ${slideBasis}`,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
          borderRadius,
          height: '100%',
        }}
      >
        {isSlideVideo && isSlidePlaying ? (
          isSlideUploadVideo ? (
            <Box
              data-testid="video-player-surface"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
              }}
            >
              <video
                src={item.url}
                controls
                autoPlay
                playsInline
                poster={item.thumbnail}
                aria-label={playerTitle}
                style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'transparent' }}
              />
            </Box>
          ) : (
            <Box
              data-testid="video-player-surface"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
              }}
            >
              <iframe
                src={withAutoplay(item.embedUrl ?? item.url)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={playerTitle}
                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
              />
            </Box>
          )
        ) : isSlideVideo ? (
          <div
            style={{ width: '100%', height: '100%', backgroundColor: 'transparent', position: 'relative', cursor: 'pointer' }}
            onClick={() => setPlayingSlides((prev) => new Set(prev).add(index))}
          >
            <Image
              src={item.thumbnail}
              alt={item.caption || 'Campaign video'}
              h="100%"
              fit="contain"
            />
            <ActionIcon
              pos="absolute"
              top="50%"
              left="50%"
              style={{ transform: 'translate(-50%, -50%)' }}
              size="xl"
              radius="xl"
              onClick={(e) => {
                e.stopPropagation();
                setPlayingSlides((prev) => new Set(prev).add(index));
              }}
              aria-label="Play video"
            >
              <IconPlayerPlay size={32} fill="currentColor" />
            </ActionIcon>
          </div>
        ) : (
          <div
            style={{ width: '100%', height: '100%', cursor: 'zoom-in' }}
            onClick={openLightbox}
          >
            <Image
              src={item.url}
              alt={item.caption || 'Campaign image'}
              fit="contain"
              h="100%"
            />
          </div>
        )}

        {/* Darken overlay for unfocused slides */}
        {showDarken && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: `rgba(0, 0, 0, ${settings.carouselDarkenOpacity})`,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────

  const isCurrentVideo = currentItem?.type === 'video';
  const testId = isCurrentVideo ? 'video-player-frame' : 'image-viewer-frame';
  const ariaLabel = isCurrentVideo
    ? `Video ${selectedIndex + 1} of ${media.length}: ${currentItem.caption || 'Untitled video'}. Use arrow keys to navigate, Enter or Space to play.`
    : `View image ${selectedIndex + 1} of ${media.length}`;

  // Edge fade mask
  const edgeFadeMask = settings.carouselEdgeFade
    ? 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
    : undefined;

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
        role="region"
        tabIndex={0}
        aria-label={ariaLabel}
        aria-roledescription="carousel"
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
          boxShadow,
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Embla viewport */}
        <div
          ref={emblaRef}
          style={{
            overflow: 'hidden',
            width: '100%',
            height: '100%',
            borderRadius,
            WebkitMaskImage: edgeFadeMask,
            maskImage: edgeFadeMask,
          }}
        >
          {/* Embla container */}
          <div
            style={{
              display: 'flex',
              gap: `${gap}px`,
              height: '100%',
            }}
          >
            {media.map((item, index) => renderSlide(item, index))}
          </div>
        </div>

        {/* Zoom button — images only, single-slide mode */}
        {!isCurrentVideo && visibleCards <= 1 && (
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
          onPrev={scrollPrev}
          onNext={scrollNext}
          total={media.length}
          settings={settings}
          previousLabel={isCurrentVideo ? 'Previous video (overlay)' : 'Previous image (overlay)'}
          nextLabel={isCurrentVideo ? 'Next video (overlay)' : 'Next image (overlay)'}
        />

        {/* Overlay dot navigator (inside viewport) */}
        {settings.dotNavPosition !== 'below' && (
          <DotNavigator
            total={media.length}
            currentIndex={selectedIndex}
            onSelect={handleDotSelect}
            settings={settings}
          />
        )}
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentItem?.caption || (isCurrentVideo ? 'Untitled video' : 'Untitled image')}
      </Text>

      {/* Dot navigator (below viewport) */}
      {settings.dotNavPosition === 'below' && (
        <DotNavigator
          total={media.length}
          currentIndex={selectedIndex}
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
            onPrev={scrollPrev}
            onNext={scrollNext}
            onClose={closeLightbox}
          />
        </Suspense>
      )}
    </Stack>
  );
}
