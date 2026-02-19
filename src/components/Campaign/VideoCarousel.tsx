import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconPlayerPlay } from '@tabler/icons-react';
import { Stack, Title, Group, ActionIcon, Image, Text, Box } from '@mantine/core';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { useSwipe } from '@/hooks/useSwipe';
import { CarouselNavigation } from './CarouselNavigation';
import { OverlayArrows } from './OverlayArrows';
import { DotNavigator } from './DotNavigator';
import { applyGalleryTransition } from '@/utils/galleryAnimations';
import { resolveBoxShadow } from '@/utils/shadowPresets';

interface VideoCarouselProps {
  videos: MediaItem[];
  settings?: GalleryBehaviorSettings;
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

export function VideoCarousel({ videos, settings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS }: VideoCarouselProps) {
  const { currentIndex, direction, setCurrentIndex, next, prev } = useCarousel(videos.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previousVideo, setPreviousVideo] = useState<MediaItem | null>(null);
  const exitTimerRef = useRef<number>(0);
  const enterRef = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLDivElement>(null);
  const prevIndexRef = useRef(currentIndex);

  const currentVideo = videos[currentIndex];

  const mediaTransitionDuration = useMemo(
    () => (settings.scrollAnimationStyle === 'instant' ? 0 : settings.scrollAnimationDurationMs),
    [settings.scrollAnimationStyle, settings.scrollAnimationDurationMs],
  );

  const transitionType = settings.scrollTransitionType ?? 'slide-fade';

  const beginTransition = useCallback(
    (navigate: () => void) => {
      window.clearTimeout(exitTimerRef.current);
      if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
        setPreviousVideo(videos[currentIndex]);
        exitTimerRef.current = window.setTimeout(
          () => setPreviousVideo(null),
          mediaTransitionDuration + 100,
        );
      }
      navigate();
      setIsPlaying(false);
    },
    [videos, currentIndex, mediaTransitionDuration, settings.scrollAnimationStyle],
  );

  const nextVideo = useCallback(() => beginTransition(next), [beginTransition, next]);
  const prevVideo = useCallback(() => beginTransition(prev), [beginTransition, prev]);

  useEffect(() => () => window.clearTimeout(exitTimerRef.current), []);

  const playerTitle = useMemo(
    () => `Video player: ${currentVideo.caption || 'Campaign video'}`,
    [currentVideo.caption],
  );

  const isUploadVideo = currentVideo.source === 'upload';
  const standardPlayerHeight = useMemo(
    () => `${Math.max(180, Math.min(900, settings.videoViewportHeight))}px`,
    [settings.videoViewportHeight],
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

  const swipeHandlers = useSwipe({
    onSwipeLeft: nextVideo,
    onSwipeRight: prevVideo,
  });

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconPlayerPlay size={18} />
          Videos ({videos.length})
        </Group>
      </Title>

      {/* Player wrapper */}
      <Box
        pos="relative"
        data-testid="video-player-frame"
        role="region"
        tabIndex={0}
        aria-label={`Video ${currentIndex + 1} of ${videos.length}: ${currentVideo.caption || 'Untitled video'}. Use arrow keys to navigate, Enter or Space to play.`}
        {...swipeHandlers}
        style={{
          touchAction: 'pan-y',
          height: standardPlayerHeight,
          maxHeight: standardPlayerHeight,
          minHeight: standardPlayerHeight,
          width: '100%',
          backgroundColor: 'transparent',
          overflow: 'hidden',
          borderRadius: `${settings.videoBorderRadius}px`,
          boxShadow: resolveBoxShadow(settings.videoShadowPreset, settings.videoShadowCustom),
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            prevVideo();
          }
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            nextVideo();
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setIsPlaying(true);
          }
        }}
      >
        {previousVideo && (
          <Box
            ref={exitRef}
            onTransitionEnd={() => {
              setPreviousVideo(null);
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
              src={previousVideo.thumbnail || previousVideo.url}
              alt=""
              aria-hidden
              h="100%"
              fit="contain"
            />
          </Box>
        )}

        <Box
          key={`${currentVideo.id}-${isPlaying ? 'playing' : 'preview'}`}
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
          {isPlaying ? (
            isUploadVideo ? (
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
                  src={currentVideo.url}
                  controls
                  autoPlay
                  playsInline
                  poster={currentVideo.thumbnail}
                  aria-label={playerTitle}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    backgroundColor: 'transparent',
                  }}
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
                  src={withAutoplay(currentVideo.embedUrl ?? currentVideo.url)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={playerTitle}
                  style={{ width: '100%', height: '100%', border: 'none', backgroundColor: 'transparent' }}
                />
              </Box>
            )
          ) : (
            <div style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}>
              <Image
                src={currentVideo.thumbnail}
                alt={currentVideo.caption || 'Campaign video'}
                h="100%"
                fit="contain"
                style={{ cursor: 'pointer' }}
                onClick={() => setIsPlaying(true)}
              />
              <ActionIcon
                pos="absolute"
                top="50%"
                left="50%"
                style={{
                  transform: 'translate(-50%, -50%)',
                }}
                size="xl"
                radius="xl"
                onClick={() => setIsPlaying(true)}
                aria-label="Play video"
              >
                <IconPlayerPlay size={32} fill="currentColor" />
              </ActionIcon>
            </div>
          )}
        </Box>

        {/* Overlay navigation arrows */}
        <OverlayArrows
          onPrev={prevVideo}
          onNext={nextVideo}
          total={videos.length}
          settings={settings}
          previousLabel="Previous video (overlay)"
          nextLabel="Next video (overlay)"
        />

        {/* Overlay dot navigator (inside viewport) */}
        {settings.dotNavPosition !== 'below' && (
          <DotNavigator
            total={videos.length}
            currentIndex={currentIndex}
            onSelect={(index) => {
              if (index !== currentIndex) {
                window.clearTimeout(exitTimerRef.current);
                if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
                  setPreviousVideo(currentVideo);
                  exitTimerRef.current = window.setTimeout(
                    () => setPreviousVideo(null),
                    mediaTransitionDuration + 100,
                  );
                }
              }
              setCurrentIndex(index);
              setIsPlaying(false);
            }}
            settings={settings}
          />
        )}
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentVideo.caption || 'Untitled video'}
      </Text>

      {/* Dot navigator (below or overlay — overlay is rendered inside the player Box separately) */}
      {settings.dotNavPosition === 'below' && (
        <DotNavigator
          total={videos.length}
          currentIndex={currentIndex}
          onSelect={(index) => {
            if (index !== currentIndex) {
              window.clearTimeout(exitTimerRef.current);
              if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
                setPreviousVideo(currentVideo);
                exitTimerRef.current = window.setTimeout(
                  () => setPreviousVideo(null),
                  mediaTransitionDuration + 100,
                );
              }
            }
            setCurrentIndex(index);
            setIsPlaying(false);
          }}
          settings={settings}
        />
      )}

      <CarouselNavigation
        total={videos.length}
        currentIndex={currentIndex}
        onPrev={prevVideo}
        onNext={nextVideo}
        onSelect={(index) => {
          if (index !== currentIndex) {
            window.clearTimeout(exitTimerRef.current);
            if (mediaTransitionDuration > 0 && settings.scrollAnimationStyle !== 'instant') {
              setPreviousVideo(currentVideo);
              exitTimerRef.current = window.setTimeout(
                () => setPreviousVideo(null),
                mediaTransitionDuration + 100,
              );
            }
          }
          setCurrentIndex(index);
          setIsPlaying(false);
        }}
        items={videos.map((video) => ({
          id: video.id,
          url: video.url,
          thumbnail: video.thumbnail,
          caption: video.caption,
        }))}
        previousLabel="Previous video"
        nextLabel="Next video"
        thumbnailWidth={settings.videoThumbnailWidth}
        thumbnailHeight={settings.videoThumbnailHeight}
        thumbnailScrollSpeed={settings.thumbnailScrollSpeed}
        thumbnailGap={settings.thumbnailGap}
        thumbnailWheelScrollEnabled={settings.thumbnailWheelScrollEnabled}
        thumbnailDragScrollEnabled={settings.thumbnailDragScrollEnabled}
        thumbnailScrollButtonsVisible={settings.thumbnailScrollButtonsVisible}
        scrollAnimationStyle={settings.scrollAnimationStyle}
        scrollAnimationDurationMs={settings.scrollAnimationDurationMs}
        scrollAnimationEasing={settings.scrollAnimationEasing}
      />
    </Stack>
  );
}
