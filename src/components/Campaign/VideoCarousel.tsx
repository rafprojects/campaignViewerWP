import { useCallback, useMemo, useState } from 'react';
import { IconPlayerPlay } from '@tabler/icons-react';
import { Stack, Title, Group, ActionIcon, Image, Text, Box } from '@mantine/core';
import type { MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { useSwipe } from '@/hooks/useSwipe';
import { CarouselNavigation } from './CarouselNavigation';

interface VideoCarouselProps {
  videos: MediaItem[];
}

const STANDARD_PLAYER_HEIGHT = 'clamp(240px, 36vw, 420px)';

function withAutoplay(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('autoplay', '1');
    return parsed.toString();
  } catch {
    return `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
  }
}

export function VideoCarousel({ videos }: VideoCarouselProps) {
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(videos.length);
  const [isPlaying, setIsPlaying] = useState(false);

  const nextVideo = useCallback(() => {
    next();
    setIsPlaying(false);
  }, [next]);

  const prevVideo = useCallback(() => {
    prev();
    setIsPlaying(false);
  }, [prev]);

  const currentVideo = videos[currentIndex];

  const playerTitle = useMemo(
    () => `Video player: ${currentVideo.caption || 'Campaign video'}`,
    [currentVideo.caption],
  );

  const isUploadVideo = currentVideo.source === 'upload';

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
          height: STANDARD_PLAYER_HEIGHT,
          maxHeight: STANDARD_PLAYER_HEIGHT,
          minHeight: STANDARD_PLAYER_HEIGHT,
          width: '100%',
          backgroundColor: 'transparent',
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

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentVideo.caption || 'Untitled video'}
      </Text>

      <CarouselNavigation
        total={videos.length}
        currentIndex={currentIndex}
        onPrev={prevVideo}
        onNext={nextVideo}
        onSelect={(index) => {
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
        thumbnailWidth={60}
        thumbnailHeight={45}
      />
    </Stack>
  );
}
