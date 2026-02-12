import { Image as ImageIcon, X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { Stack, Title, Group, ActionIcon, Image, AspectRatio, Text, Box, Modal } from '@mantine/core';
import type { MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { useLightbox } from '@/hooks/useLightbox';
import { CarouselNavigation } from './CarouselNavigation';

interface ImageCarouselProps {
  images: MediaItem[];
}

export function ImageCarousel({ images }: ImageCarouselProps) {
  const { currentIndex, setCurrentIndex, next: nextImage, prev: prevImage } = useCarousel(images.length);
  const { isOpen: isLightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    onPrev: prevImage,
    onNext: nextImage,
    enableArrowNavigation: true,
  });

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
      <Box
        pos="relative"
        role="button"
        tabIndex={0}
        aria-label={`View image ${currentIndex + 1} of ${images.length}`}
        onClick={openLightbox}
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
        <AspectRatio ratio={16 / 9}>
          <Box style={{ width: '100%', height: '100%' }}>
            <Image
              src={currentImage.url}
              alt={currentImage.caption || 'Campaign image'}
              fit="contain"
              h="100%"
              style={{ cursor: 'zoom-in' }}
            />
          </Box>
        </AspectRatio>

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
          <ZoomIn size={20} />
        </ActionIcon>
      </Box>

      {/* Caption */}
      <Text size="sm" c="dimmed">
        {currentImage.caption || 'Untitled image'}
      </Text>

      <CarouselNavigation
        total={images.length}
        currentIndex={currentIndex}
        onPrev={prevImage}
        onNext={nextImage}
        onSelect={setCurrentIndex}
        items={images.map((image) => ({
          id: image.id,
          url: image.url,
          caption: image.caption,
        }))}
        previousLabel="Previous image"
        nextLabel="Next image"
      />

      {/* Lightbox Modal */}
      <Modal
        opened={isLightboxOpen}
        onClose={closeLightbox}
        fullScreen
        padding={0}
        withCloseButton={false}
        transitionProps={{ duration: 0 }}
        styles={{
          content: { background: 'rgba(0, 0, 0, 0.95)', overflow: 'hidden' },
        }}
      >
        <Box h="100vh" pos="relative" component="div">
          {isLightboxOpen && (
            <Box
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <Image
                src={currentImage.url}
                alt={currentImage.caption || 'Campaign image'}
                fit="contain"
                h="100%"
                w="100%"
              />
            </Box>
          )}

          {/* Close button */}
          <ActionIcon
            pos="absolute"
            top={16}
            right={16}
            onClick={closeLightbox}
            size="lg"
            variant="light"
            aria-label="Close lightbox"
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
                aria-label="Previous image (lightbox)"
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
                aria-label="Next image (lightbox)"
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
