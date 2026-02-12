import { useCallback, useState } from 'react';
import { Play } from 'lucide-react';
import { Stack, Title, Group, ActionIcon, Image, AspectRatio, Text, Box } from '@mantine/core';
import type { MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { CarouselNavigation } from './CarouselNavigation';

interface VideoCarouselProps {
  videos: MediaItem[];
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


  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <Play size={18} />
          Videos ({videos.length})
        </Group>
      </Title>

      {/* Player wrapper */}
      <Box
        pos="relative"
        role="region"
        tabIndex={0}
        aria-label={`Video ${currentIndex + 1} of ${videos.length}: ${currentVideo.caption || 'Untitled video'}. Use arrow keys to navigate, Enter or Space to play.`}
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
        <AspectRatio ratio={16 / 9}>
          {isPlaying ? (
            <iframe
              src={`${currentVideo.embedUrl ?? currentVideo.url}?autoplay=1`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={`Video player: ${currentVideo.caption}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div>
              <Image
                src={currentVideo.thumbnail}
                alt={currentVideo.caption || 'Campaign video'}
                h="100%"
                fit="cover"
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
                <Play size={32} fill="currentColor" />
              </ActionIcon>
            </div>
          )}
        </AspectRatio>

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
