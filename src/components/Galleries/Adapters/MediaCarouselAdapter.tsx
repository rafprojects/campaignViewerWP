/**
 * P22-P8d: Unified Media Carousel Adapter (Embla)
 *
 * Replaces the custom useCarousel + useMediaTransition implementation
 * with embla-carousel-react for proper multi-slide carousels,
 * autoplay, drag, loop, and more.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  getCarouselAlign,
  getClosestSyntheticFocusIndex,
  getCarouselContainScroll,
  getCarouselFocusIndex,
  getCarouselSnapIndexForFocus,
  getSyntheticLoopRecenterIndex,
  normalizeCarouselVisibleCards,
  shouldLoopCarousel,
  shouldUseSyntheticCarouselLoop,
} from './carouselBehavior';

const Lightbox = lazy(() =>
  import('@/components/Galleries/Shared/Lightbox').then((m) => ({ default: m.Lightbox })),
);

// ── Constants ────────────────────────────────────────────────────────

const IMAGE_ASPECT_RATIO = '3 / 2';
const IMAGE_ASPECT_RATIO_MULTIPLIER = 1.5;
const VIDEO_ASPECT_RATIO = '16 / 9';
const VIDEO_ASPECT_RATIO_MULTIPLIER = 16 / 9;

const VIEWPORT_HEIGHT_OFFSETS: Record<Breakpoint, string> = {
  desktop: '16rem',
  tablet: '10rem',
  mobile: '6rem',
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

function clampViewportRatio(value: number | undefined, fallback: number): number {
  return Math.max(0.3, Math.min(1, value ?? fallback));
}

function formatRatioDvh(value: number): string {
  return `${Number((value * 100).toFixed(2))}dvh`;
}

function resolveViewportMaxHeight(breakpoint: Breakpoint, settings: GalleryBehaviorSettings): string {
  const viewportBudget = `calc(100dvh - ${resolveBreakpointValue(breakpoint, VIEWPORT_HEIGHT_OFFSETS)})`;

  if (breakpoint === 'mobile') {
    return `min(${viewportBudget}, ${formatRatioDvh(clampViewportRatio(
      settings.viewportHeightMobileRatio,
      DEFAULT_GALLERY_BEHAVIOR_SETTINGS.viewportHeightMobileRatio,
    ))})`;
  }

  if (breakpoint === 'tablet') {
    return `min(${viewportBudget}, ${formatRatioDvh(clampViewportRatio(
      settings.viewportHeightTabletRatio,
      DEFAULT_GALLERY_BEHAVIOR_SETTINGS.viewportHeightTabletRatio,
    ))})`;
  }

  return `min(${viewportBudget}, 68dvh)`;
}

interface RenderedSlide {
  key: string;
  item: MediaItem;
  originalIndex: number;
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

  const visibleCards = normalizeCarouselVisibleCards(settings.carouselVisibleCards);
  const gap = settings.carouselGap;
  const requestedLoopEnabled = shouldLoopCarousel(settings.carouselLoop, media.length, visibleCards);
  const [forceSyntheticLoop, setForceSyntheticLoop] = useState(false);
  const syntheticLoopEnabled = shouldUseSyntheticCarouselLoop(settings.carouselLoop, media.length, visibleCards)
    || forceSyntheticLoop;
  const loopEnabled = requestedLoopEnabled && !syntheticLoopEnabled;
  const renderedSlides = useMemo<RenderedSlide[]>(() => {
    if (!syntheticLoopEnabled) {
      return media.map((item, index) => ({
        key: item.id,
        item,
        originalIndex: index,
      }));
    }

    return Array.from({ length: 3 }, (_unused, copyIndex) => {
      return media.map((item, index) => ({
        key: `${item.id}-${copyIndex}-${index}`,
        item,
        originalIndex: index,
      }));
    }).flat();
  }, [media, syntheticLoopEnabled]);
  const autoplayEnabled = settings.carouselAutoplay && media.length > 1;

  useEffect(() => {
    setForceSyntheticLoop(false);
  }, [media.length, settings.carouselLoop, visibleCards]);

  const autoplayPlugin = useMemo(() => {
    if (!autoplayEnabled) return [];
    return [
      Autoplay({
        delay: settings.carouselAutoplaySpeed,
        // P25-K: stopOnInteraction stays true — autoplay should stop permanently after
        // user drag/click rather than resuming, which would fight manual navigation.
        stopOnInteraction: true,
        stopOnMouseEnter: settings.carouselAutoplayPauseOnHover,
      }),
    ];
  }, [autoplayEnabled, settings.carouselAutoplayPauseOnHover, settings.carouselAutoplaySpeed]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: loopEnabled,
      dragFree: false,
      slidesToScroll: 1,
      startIndex: syntheticLoopEnabled ? media.length : 0,
      align: getCarouselAlign(visibleCards),
      containScroll: syntheticLoopEnabled ? false : getCarouselContainScroll(loopEnabled, visibleCards),
      watchDrag: settings.carouselDragEnabled,
      direction: settings.carouselAutoplayDirection === 'rtl' ? 'rtl' : 'ltr',
    },
    autoplayPlugin,
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [slidesInView, setSlidesInView] = useState<number[]>([]);
  const [playingSlides, setPlayingSlides] = useState<Set<number>>(new Set());
  const pendingSyntheticRecenterRef = useRef<number | null>(null);

  useEffect(() => {
    pendingSyntheticRecenterRef.current = null;
  }, [media.length, syntheticLoopEnabled, visibleCards]);

  useEffect(() => {
    if (!emblaApi || syntheticLoopEnabled || !requestedLoopEnabled || visibleCards <= 1) return;

    const syncLoopMode = () => {
      if (!emblaApi.internalEngine().options.loop) {
        setForceSyntheticLoop(true);
      }
    };

    syncLoopMode();
    emblaApi.on('reInit', syncLoopMode);

    return () => {
      emblaApi.off('reInit', syncLoopMode);
    };
  }, [emblaApi, requestedLoopEnabled, syntheticLoopEnabled, visibleCards]);

  // Track selected index and visible slides
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const snapIndex = emblaApi.selectedScrollSnap();

      if (syntheticLoopEnabled) {
        pendingSyntheticRecenterRef.current = getSyntheticLoopRecenterIndex(snapIndex, media.length);
      } else {
        pendingSyntheticRecenterRef.current = null;
      }

      setSelectedIndex(snapIndex);
      setSlidesInView(
        emblaApi.slidesInView().map((index) => renderedSlides[index]?.originalIndex ?? 0),
      );
    };
    const onSlidesInView = () => {
      setSlidesInView(
        emblaApi.slidesInView().map((index) => renderedSlides[index]?.originalIndex ?? 0),
      );
    };
    const onSettle = () => {
      const recenteredIndex = pendingSyntheticRecenterRef.current;

      if (recenteredIndex === null) {
        return;
      }

      pendingSyntheticRecenterRef.current = null;
      // P25-K: Stop autoplay during invisible recenter so its timer does not
      // fire mid-jump and cause a visual glitch.
      const autoplay = typeof emblaApi.plugins === 'function'
        ? emblaApi.plugins()?.autoplay as { isPlaying?: () => boolean; stop?: () => void; play?: () => void } | undefined
        : undefined;
      const wasPlaying = autoplay?.isPlaying?.() ?? false;
      if (wasPlaying) autoplay?.stop?.();
      emblaApi.scrollTo(recenteredIndex, true);
      if (wasPlaying) autoplay?.play?.();
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('slidesInView', onSlidesInView);
    emblaApi.on('settle', onSettle);

    // Initialize
    onSelect();
    onSlidesInView();

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('slidesInView', onSlidesInView);
      emblaApi.off('settle', onSettle);
    };
  }, [emblaApi, media.length, renderedSlides, syntheticLoopEnabled]);

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

  const focusedRenderedIndex = getCarouselFocusIndex(selectedIndex, visibleCards, renderedSlides.length, loopEnabled);
  const focusedIndex = renderedSlides[focusedRenderedIndex]?.originalIndex ?? 0;
  const currentItem = media[focusedIndex];

  // Navigation
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number, jump?: boolean) => emblaApi?.scrollTo(index, jump), [emblaApi]);

  // ── Lightbox ─────────────────────────────────────────────────────

  const { isOpen: isLightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    onPrev: scrollPrev,
    onNext: scrollNext,
  });

  // P25-K: Pause autoplay when lightbox opens, resume on close (only if it was running)
  const autoplayWasRunningRef = useRef(false);
  useEffect(() => {
    if (!emblaApi || typeof emblaApi.plugins !== 'function') return;
    const autoplay = emblaApi.plugins()?.autoplay as { isPlaying?: () => boolean; stop?: () => void; play?: () => void } | undefined;
    if (!autoplay) return;
    if (isLightboxOpen) {
      autoplayWasRunningRef.current = autoplay.isPlaying?.() ?? false;
      autoplay.stop?.();
    } else if (autoplayWasRunningRef.current) {
      autoplay.play?.();
      autoplayWasRunningRef.current = false;
    }
  }, [emblaApi, isLightboxOpen]);

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

  const viewportMaxHeight = resolveViewportMaxHeight(breakpoint, settings);
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
      const targetFocusIndex = syntheticLoopEnabled
        ? getClosestSyntheticFocusIndex(index, focusedRenderedIndex, media.length)
        : index;

      scrollTo(getCarouselSnapIndexForFocus(targetFocusIndex, visibleCards, renderedSlides.length, loopEnabled));
    },
    [focusedRenderedIndex, loopEnabled, media.length, renderedSlides.length, scrollTo, syntheticLoopEnabled, visibleCards],
  );

  // ── Slide flex basis ─────────────────────────────────────────────

  const slideBasis = useMemo(() => {
    if (visibleCards <= 1) return '100%';
    return `calc(100% / ${visibleCards})`;
  }, [visibleCards]);
  const slideSpacing = `${gap}px`;

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
        const item = media[focusedIndex];
        if (item?.type === 'video') {
          setPlayingSlides((prev) => new Set(prev).add(focusedIndex));
        } else {
          openLightbox();
        }
      }
    },
    [focusedIndex, media, openLightbox, scrollNext, scrollPrev],
  );

  // ── Render slide ─────────────────────────────────────────────────

  const renderSlide = (slide: RenderedSlide, renderedIndex: number) => {
    const { item, originalIndex } = slide;
    const isSlideVideo = item.type === 'video';
    const isSlideUploadVideo = isSlideVideo && item.source === 'upload';
    const isSlidePlaying = playingSlides.has(originalIndex);
    const playerTitle = `Video player: ${item.caption || 'Campaign video'}`;
    const showDarken = settings.carouselDarkenUnfocused && renderedIndex !== focusedRenderedIndex;

    return (
      <div
        key={slide.key}
        role="group"
        aria-roledescription="slide"
        aria-label={`Slide ${originalIndex + 1} of ${media.length}`}
        style={{
          flex: `0 0 ${slideBasis}`,
          minWidth: 0,
          paddingInlineStart: slideSpacing,
          boxSizing: 'border-box',
          height: '100%',
        }}
      >
        <div
          style={{
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
              onClick={() => setPlayingSlides((prev) => new Set(prev).add(originalIndex))}
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
                  setPlayingSlides((prev) => new Set(prev).add(originalIndex));
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
      </div>
    );
  };

  // ── Main render ──────────────────────────────────────────────────

  const isCurrentVideo = currentItem?.type === 'video';
  const testId = isCurrentVideo ? 'video-player-frame' : 'image-viewer-frame';
  const ariaLabel = isCurrentVideo
    ? `Video ${focusedIndex + 1} of ${media.length}: ${currentItem.caption || 'Untitled video'}. Use arrow keys to navigate, Enter or Space to play.`
    : `View image ${focusedIndex + 1} of ${media.length}`;

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
              touchAction: 'pan-y pinch-zoom',
              marginInlineStart: gap > 0 ? `-${slideSpacing}` : undefined,
              height: '100%',
            }}
          >
            {renderedSlides.map((slide, index) => renderSlide(slide, index))}
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
            currentIndex={focusedIndex}
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
          currentIndex={focusedIndex}
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
