import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconPhoto, IconZoomIn } from '@tabler/icons-react';
import { Stack, Title, Group, ActionIcon, Image, Text, Box } from '@mantine/core';
import { Lightbox } from './Lightbox';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { useCarousel } from '@/hooks/useCarousel';
import { useLightbox } from '@/hooks/useLightbox';
import { useSwipe } from '@/hooks/useSwipe';
import { OverlayArrows } from './OverlayArrows';
import { DotNavigator } from './DotNavigator';
import { applyGalleryTransition } from '@/utils/galleryAnimations';
import { resolveBoxShadow } from '@/utils/shadowPresets';
import { combineMaxWidthConstraints, resolveBreakpointValue } from '@/utils/resolveBreakpointValue';

const IMAGE_ASPECT_RATIO = '3 / 2';
const IMAGE_ASPECT_RATIO_MULTIPLIER = 1.5;
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

function resolveManualHeight(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim() ?? '';
  return CSS_HEIGHT_VALUE_RE.test(trimmed) ? trimmed : fallback;
}

interface ImageCarouselProps {
  images: MediaItem[];
  settings?: GalleryBehaviorSettings;
  breakpoint?: Breakpoint;
  maxWidth?: number;
}

export function ImageCarousel({ images, settings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS, breakpoint = 'desktop', maxWidth = 0 }: ImageCarouselProps) {
  const { currentIndex, direction, setCurrentIndex, next: nextRaw, prev: prevRaw } = useCarousel(images.length);
  const [previousImage, setPreviousImage] = useState<MediaItem | null>(null);
  const exitTimerRef = useRef<number>(0);
  const enterRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(currentIndex);

  const currentImage = images[currentIndex];

  const mediaTransitionDuration = useMemo(
    () => (settings.scrollAnimationStyle === 'instant' ? 0 : settings.scrollAnimationDurationMs),
    [settings.scrollAnimationStyle, settings.scrollAnimationDurationMs],
  );

  const transitionType = settings.scrollTransitionType ?? 'slide-fade';

  const beginTransition = (navigate: () => void) => {
    window.clearTimeout(exitTimerRef.current);
    if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
      setPreviousImage(images[currentIndex]);
      exitTimerRef.current = window.setTimeout(
        () => setPreviousImage(null),
        mediaTransitionDuration + 100,
      );
    }
    navigate();
  };

  const nextImage = () => beginTransition(nextRaw);
  const prevImage = () => beginTransition(prevRaw);

  useEffect(() => () => window.clearTimeout(exitTimerRef.current), []);

  // useLightbox manages open state and body-scroll lock; keyboard handled by <Lightbox>
  const { isOpen: isLightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    onPrev: prevImage,
    onNext: nextImage,
  });

  const swipeHandlers = useSwipe({
    onSwipeLeft: nextImage,
    onSwipeRight: prevImage,
  });

  const heightMultiplier = breakpoint === 'mobile' ? 0.55 : breakpoint === 'tablet' ? 0.75 : 1.0;
  const heightConstraint = settings.gallerySizingMode ?? 'auto';
  const standardViewerHeight = useMemo(() => {
    const base = Math.max(180, Math.min(900, settings.imageViewportHeight));
    return `${Math.round(base * heightMultiplier)}px`;
  }, [settings.imageViewportHeight, heightMultiplier]);
  const manualHeight = useMemo(
    () => resolveManualHeight(settings.galleryManualHeight, standardViewerHeight),
    [settings.galleryManualHeight, standardViewerHeight],
  );
  const viewportMaxHeight = resolveBreakpointValue(breakpoint, VIEWPORT_MAX_HEIGHTS);
  const viewportWidthCap = resolveBreakpointValue(breakpoint, VIEWPORT_MAX_WIDTHS);
  const viewportFrameMaxWidth = useMemo(
    () => `calc(${viewportMaxHeight} * ${IMAGE_ASPECT_RATIO_MULTIPLIER})`,
    [viewportMaxHeight],
  );
  const configuredMaxWidth = maxWidth > 0 ? `${maxWidth}px` : undefined;
  const frameMaxWidth =
    heightConstraint === 'viewport'
      ? combineMaxWidthConstraints(configuredMaxWidth, viewportFrameMaxWidth, viewportWidthCap)
      : configuredMaxWidth;

  // Imperative CSS transition — runs before browser paint
  useLayoutEffect(() => {
    if (prevIndexRef.current === currentIndex) return;
    prevIndexRef.current = currentIndex;
    if (mediaTransitionDuration <= 0 || direction === 0 || settings.scrollAnimationStyle === 'instant') return;

    const opts = {
      direction: direction as 1 | -1,
      transitionType: transitionType as 'fade' | 'slide' | 'slide-fade',
      durationMs: mediaTransitionDuration,
      easing: settings.scrollAnimationEasing,
      transitionFadeEnabled: settings.transitionFadeEnabled,
    };

    applyGalleryTransition(enterRef.current, exitRef.current, opts);
  }, [currentIndex, direction, mediaTransitionDuration, transitionType, settings.scrollAnimationEasing, settings.scrollAnimationStyle, settings.transitionFadeEnabled]);

  return (
    <Stack gap="md" style={{ width: '100%', maxWidth: configuredMaxWidth }}>
      {settings.showCampaignGalleryLabels !== false && (
      <Title order={3} size="h5" ta={settings.galleryLabelJustification || 'left'}>
        <Group gap={8} component="span" justify={settings.galleryLabelJustification || 'left'}>
          {settings.showGalleryLabelIcon && <IconPhoto size={18} />}
          {settings.galleryImageLabel || 'Images'} ({images.length})
        </Group>
      </Title>
      )}

      {/* Image viewer */}
      <Box
        pos="relative"
        data-testid="image-viewer-frame"
        role="button"
        tabIndex={0}
        aria-label={`View image ${currentIndex + 1} of ${images.length}`}
        onClick={openLightbox}
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
          aspectRatio: heightConstraint === 'manual' ? undefined : IMAGE_ASPECT_RATIO,
          overflow: 'hidden',
          borderRadius: `${settings.imageBorderRadius}px`,
          boxShadow: resolveBoxShadow(settings.imageShadowPreset, settings.imageShadowCustom),
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openLightbox();
          }
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            prevImage();
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            nextImage();
          }
        }}
      >
        {previousImage && (
          <Box
            ref={exitRef}
            onTransitionEnd={() => {
              setPreviousImage(null);
              window.clearTimeout(exitTimerRef.current);
            }}
            style={{
              position: 'absolute',
              inset: 0,
              willChange: 'transform, opacity',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <Image
              src={previousImage.url}
              alt=""
              aria-hidden
              fit="contain"
              h="100%"
            />
          </Box>
        )}

        <Box
          key={currentImage.id}
          ref={enterRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            willChange: 'transform, opacity',
            zIndex: 2,
          }}
        >
          <Image
            src={currentImage.url}
            alt={currentImage.caption || 'Campaign image'}
            fit="contain"
            h="100%"
            style={{ cursor: 'zoom-in' }}
          />
        </Box>

        {/* Zoom button */}
        <ActionIcon
          pos="absolute"
          bottom={12}
          right={12}
          onClick={openLightbox}
          size="lg"
          variant="light"
          aria-label="Open lightbox"
        >
          <IconZoomIn size={20} />
        </ActionIcon>

        {/* Overlay navigation arrows */}
        <OverlayArrows
          onPrev={prevImage}
          onNext={nextImage}
          total={images.length}
          settings={settings}
          previousLabel="Previous image (overlay)"
          nextLabel="Next image (overlay)"
        />

        {/* Overlay dot navigator (inside viewport) */}
        {settings.dotNavPosition !== 'below' && (
          <DotNavigator
            total={images.length}
            currentIndex={currentIndex}
            onSelect={(index) => {
              if (index !== currentIndex) {
                window.clearTimeout(exitTimerRef.current);
                if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
                  setPreviousImage(currentImage);
                  exitTimerRef.current = window.setTimeout(
                    () => setPreviousImage(null),
                    mediaTransitionDuration + 100,
                  );
                }
              }
              setCurrentIndex(index);
            }}
            settings={settings}
          />
        )}
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentImage.caption || 'Untitled image'}
      </Text>

      {/* Dot navigator (below viewport) */}
      {settings.dotNavPosition === 'below' && (
        <DotNavigator
          total={images.length}
          currentIndex={currentIndex}
          onSelect={(index) => {
            if (index !== currentIndex) {
              window.clearTimeout(exitTimerRef.current);
              if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
                setPreviousImage(currentImage);
                exitTimerRef.current = window.setTimeout(
                  () => setPreviousImage(null),
                  mediaTransitionDuration + 100,
                );
              }
            }
            setCurrentIndex(index);
          }}
          settings={settings}
        />
      )}

      {/* Lightbox — Portal-based, z-index 9999, bypasses CampaignViewer Modal nesting */}
      <Lightbox
        isOpen={isLightboxOpen}
        media={images}
        currentIndex={currentIndex}
        onPrev={prevImage}
        onNext={nextImage}
        onClose={closeLightbox}
      />
    </Stack>
  );
}
