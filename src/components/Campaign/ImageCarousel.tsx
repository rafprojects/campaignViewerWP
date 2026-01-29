import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Image as ImageIcon, X, ZoomIn } from 'lucide-react';
import { Stack, Title, Group, ActionIcon, Image, AspectRatio, Text, Box, Modal, Badge } from '@mantine/core';
import type { MediaItem } from '@/types';

interface ImageCarouselProps {
  images: MediaItem[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const currentImage = images[currentIndex];

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <ImageIcon size={18} />
          Images ({images.length})
        </Group>
      </Title>

      {/* Image viewer */}
      <Box pos="relative">
        <AspectRatio ratio={16 / 9}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              style={{ width: '100%', height: '100%' }}
            >
              <Image
                src={currentImage.url}
                alt={currentImage.caption}
                fit="contain"
                h="100%"
                style={{ cursor: 'zoom-in' }}
                onClick={() => setIsLightboxOpen(true)}
              />
            </motion.div>
          </AnimatePresence>
        </AspectRatio>

        {/* Zoom button */}
        <ActionIcon
          pos="absolute"
          bottom={12}
          right={12}
          onClick={() => setIsLightboxOpen(true)}
          size="lg"
          variant="light"
        >
          <ZoomIn size={20} />
        </ActionIcon>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <ActionIcon
              pos="absolute"
              top="50%"
              left={8}
              style={{ transform: 'translateY(-50%)' }}
              onClick={prevImage}
              variant="light"
              size="lg"
            >
              <ChevronLeft size={24} />
            </ActionIcon>
            <ActionIcon
              pos="absolute"
              top="50%"
              right={8}
              style={{ transform: 'translateY(-50%)' }}
              onClick={nextImage}
              variant="light"
              size="lg"
            >
              <ChevronRight size={24} />
            </ActionIcon>
          </>
        )}

        {/* Image counter */}
        <Badge pos="absolute" bottom={12} left={12}>
          {currentIndex + 1} / {images.length}
        </Badge>
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentImage.caption}
      </Text>

      {/* Thumbnail Strip */}
      <Group gap={6}>
        {images.map((image, index) => (
          <ActionIcon
            key={image.id}
            onClick={() => setCurrentIndex(index)}
            variant={index === currentIndex ? 'light' : 'subtle'}
            size="lg"
            p={0}
            style={{
              border: index === currentIndex ? '2px solid var(--mantine-color-blue-5)' : 'none',
              overflow: 'hidden',
            }}
          >
            <Image
              src={image.url}
              alt={image.caption}
              w={60}
              h={60}
              fit="cover"
            />
          </ActionIcon>
        ))}
      </Group>

      {/* Lightbox Modal */}
      <Modal
        opened={isLightboxOpen}
        onClose={() => setIsLightboxOpen(false)}
        fullScreen
        padding={0}
        withCloseButton={false}
        styles={{
          content: { background: 'rgba(0, 0, 0, 0.95)', overflow: 'hidden' },
        }}
      >
        <Box h="100vh" pos="relative" component="div">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={currentImage.url}
              alt={currentImage.caption}
              fit="contain"
              h="100%"
              w="100%"
            />
          </motion.div>

          {/* Close button */}
          <ActionIcon
            pos="absolute"
            top={16}
            right={16}
            onClick={() => setIsLightboxOpen(false)}
            size="lg"
            variant="light"
          >
            <X size={24} />
          </ActionIcon>

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <ActionIcon
                pos="absolute"
                top="50%"
                left={16}
                style={{ transform: 'translateY(-50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                variant="light"
                size="xl"
              >
                <ChevronLeft size={32} />
              </ActionIcon>
              <ActionIcon
                pos="absolute"
                top="50%"
                right={16}
                style={{ transform: 'translateY(-50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                variant="light"
                size="xl"
              >
                <ChevronRight size={32} />
              </ActionIcon>
            </>
          )}

          {/* Caption and counter */}
          <Box pos="absolute" bottom={0} left={0} right={0} p="lg">
            <Stack gap="xs">
              <Text size="lg" fw={600} c="white">
                {currentImage.caption}
              </Text>
              <Text size="sm" c="gray.4">
                {currentIndex + 1} / {images.length}
              </Text>
            </Stack>
          </Box>
        </Box>
      </Modal>
    </Stack>
  );
}
