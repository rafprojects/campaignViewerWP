import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { Stack, Title, Group, ActionIcon, Image, AspectRatio, Text, Box } from '@mantine/core';
import type { MediaItem } from '@/types';

interface VideoCarouselProps {
  videos: MediaItem[];
}

export function VideoCarousel({ videos }: VideoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const nextVideo = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
    setIsPlaying(false);
  };

  const prevVideo = () => {
    setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    setIsPlaying(false);
  };

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
      <Box pos="relative">
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
                alt={currentVideo.caption}
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

        {/* Navigation Arrows */}
        {videos.length > 1 && (
          <>
            <ActionIcon
              pos="absolute"
              top="50%"
              left={8}
              style={{ transform: 'translateY(-50%)' }}
              onClick={prevVideo}
              variant="light"
              size="lg"
              aria-label="Previous video"
            >
              <ChevronLeft size={24} />
            </ActionIcon>
            <ActionIcon
              pos="absolute"
              top="50%"
              right={8}
              style={{ transform: 'translateY(-50%)' }}
              onClick={nextVideo}
              variant="light"
              size="lg"
              aria-label="Next video"
            >
              <ChevronRight size={24} />
            </ActionIcon>
          </>
        )}
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentVideo.caption}
      </Text>

      {/* Thumbnail Strip */}
      {videos.length > 1 && (
        <Group gap={6}>
          {videos.map((video, index) => (
            <ActionIcon
              key={video.id}
              onClick={() => {
                setCurrentIndex(index);
                setIsPlaying(false);
              }}
              variant={index === currentIndex ? 'light' : 'subtle'}
              size="lg"
              p={0}
              style={{
                border: index === currentIndex ? '2px solid var(--mantine-color-blue-5)' : 'none',
                overflow: 'hidden',
              }}
            >
              <Image
                src={video.thumbnail}
                alt={video.caption}
                w={60}
                h={45}
                fit="cover"
              />
            </ActionIcon>
          ))}
        </Group>
      )}
    </Stack>
  );
}
