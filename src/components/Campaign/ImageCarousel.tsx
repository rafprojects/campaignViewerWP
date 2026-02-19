import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconPhoto, IconZoomIn } from '@tabler/icons-react';
import { Stack, Title, Group, ActionIcon, Image, Text, Box } from '@mantine/core';
import { Lightbox } from './Lightbox';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { useLightbox } from '@/hooks/useLightbox';
import { useSwipe } from '@/hooks/useSwipe';
import { CarouselNavigation } from './CarouselNavigation';
import { OverlayArrows } from './OverlayArrows';
import { DotNavigator } from './DotNavigator';
import { applyGalleryTransition } from '@/utils/galleryAnimations';
import { resolveBoxShadow } from '@/utils/shadowPresets';

interface ImageCarouselProps {
  images: MediaItem[];
  settings?: GalleryBehaviorSettings;
}

export function ImageCarousel({ images, settings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS }: ImageCarouselProps) {
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

  const standardViewerHeight = useMemo(
    () => `${Math.max(180, Math.min(900, settings.imageViewportHeight))}px`,
    [settings.imageViewportHeight],
  );

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
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconPhoto size={18} />
          Images ({images.length})
        </Group>
      </Title>

      {/* Image viewer */}
      <Box
        pos="relative"
        data-testid="image-viewer-frame"
        role="button"
        tabIndex={0}
        aria-label={`View image ${currentIndex + 1} of ${images.length}`}
        onClick={openLightbox}
        {...swipeHandlers}
        style={{ touchAction: 'pan-y', height: standardViewerHeight, overflow: 'hidden', borderRadius: `${settings.imageBorderRadius}px`, boxShadow: resolveBoxShadow(settings.imageShadowPreset, settings.imageShadowCustom) }}
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

      <CarouselNavigation
        total={images.length}
        currentIndex={currentIndex}
        onPrev={prevImage}
        onNext={nextImage}
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
        items={images.map((image) => ({
          id: image.id,
          url: image.url,
          caption: image.caption,
        }))}
        previousLabel="Previous image"
        nextLabel="Next image"
        thumbnailScrollSpeed={settings.thumbnailScrollSpeed}
        thumbnailWidth={settings.imageThumbnailWidth}
        thumbnailHeight={settings.imageThumbnailHeight}
        thumbnailGap={settings.thumbnailGap}
        thumbnailWheelScrollEnabled={settings.thumbnailWheelScrollEnabled}
        thumbnailDragScrollEnabled={settings.thumbnailDragScrollEnabled}
        thumbnailScrollButtonsVisible={settings.thumbnailScrollButtonsVisible}
        scrollAnimationStyle={settings.scrollAnimationStyle}
        scrollAnimationDurationMs={settings.scrollAnimationDurationMs}
        scrollAnimationEasing={settings.scrollAnimationEasing}
      />

      {/* Lightbox — Portal-based, z-index 9999, bypasses CampaignViewer Modal nesting */}
      <Lightbox
        isOpen={isLightboxOpen}
        images={images}
        currentIndex={currentIndex}
        onPrev={prevImage}
        onNext={nextImage}
        onClose={closeLightbox}
      />
    </Stack>
  );
}
