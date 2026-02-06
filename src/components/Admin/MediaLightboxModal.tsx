import { ActionIcon, Box, Image, Modal, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import type { MediaItem } from '@/types';

interface MediaLightboxModalProps {
  opened: boolean;
  onClose: () => void;
  imageItems: MediaItem[];
  lightboxIndex: number;
  onPrev: () => void;
  onNext: () => void;
}

export function MediaLightboxModal({
  opened,
  onClose,
  imageItems,
  lightboxIndex,
  onPrev,
  onNext,
}: MediaLightboxModalProps) {
  const currentItem = imageItems[lightboxIndex];
  const ariaLabel = `Media lightbox: ${currentItem?.caption || 'Image'} (${lightboxIndex + 1} of ${imageItems.length})`;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      padding={0}
      withCloseButton={false}
      centered
      styles={{ body: { background: 'rgba(0,0,0,0.9)' } }}
      aria-label={ariaLabel}
    >
      {imageItems.length > 0 && currentItem && (
        <Box pos="relative">
          <Image
            src={currentItem.url}
            alt={currentItem.caption || 'Media preview'}
            fit="contain"
            mah="80vh"
          />
          <ActionIcon
            variant="filled"
            color="dark"
            pos="absolute"
            top={10}
            right={10}
            onClick={onClose}
            aria-label="Close lightbox"
          >
            <IconX size={18} />
          </ActionIcon>
          {imageItems.length > 1 && (
            <>
              <ActionIcon
                variant="filled"
                color="dark"
                pos="absolute"
                left={10}
                top="50%"
                style={{ transform: 'translateY(-50%)' }}
                onClick={onPrev}
                aria-label="Previous image"
              >
                <IconChevronLeft size={20} />
              </ActionIcon>
              <ActionIcon
                variant="filled"
                color="dark"
                pos="absolute"
                right={10}
                top="50%"
                style={{ transform: 'translateY(-50%)' }}
                onClick={onNext}
                aria-label="Next image"
              >
                <IconChevronRight size={20} />
              </ActionIcon>
            </>
          )}
          <Box
            pos="absolute"
            bottom={0}
            left={0}
            right={0}
            p="md"
            style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}
          >
            <Text c="white" size="sm">{currentItem.caption || 'Untitled'}</Text>
            <Text c="dimmed" size="xs">{lightboxIndex + 1} / {imageItems.length}</Text>
          </Box>
        </Box>
      )}
    </Modal>
  );
}
