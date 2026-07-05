import { ActionIcon, Box, Image, Modal, Text } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { MediaItem } from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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
  const { t } = useTranslation('wpsg');
  const currentItem = imageItems[lightboxIndex];
  const ariaLabel = t('admin_media_lb_aria', 'Media lightbox: {{caption}} ({{index}} of {{total}})', { caption: currentItem?.caption || t('admin_media_type_image', 'Image'), index: lightboxIndex + 1, total: imageItems.length });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="xl"
      padding={0}
      withCloseButton={false}
      centered
      styles={{ body: { background: 'color-mix(in srgb, var(--wpsg-color-background) 90%, transparent)' } }}
      aria-label={ariaLabel}
    >
      {imageItems.length > 0 && currentItem && (
        <Box pos="relative">
          <Image
            src={currentItem.url}
            alt={currentItem.caption || t('admin_media_lb_alt', 'Media preview')}
            fit="contain"
            mah="80dvh"
          />
          <ActionIcon
            variant="filled"
            color="dark"
            pos="absolute"
            top={10}
            right={10}
            onClick={onClose}
            aria-label={t('admin_media_lb_close', 'Close lightbox')}
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
                aria-label={t('admin_media_lb_prev', 'Previous image')}
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
                aria-label={t('admin_media_lb_next', 'Next image')}
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
            style={{ background: 'linear-gradient(transparent, color-mix(in srgb, var(--wpsg-color-background) 80%, transparent))' }}
          >
            <Text c="white" size="sm">{currentItem.caption || t('admin_untitled', 'Untitled')}</Text>
            <Text c="dimmed" size="xs">{lightboxIndex + 1} / {imageItems.length}</Text>
          </Box>
        </Box>
      )}
    </Modal>
  );
}

setWpsgDebugDisplayName(MediaLightboxModal, 'AdminPanel:MediaLightboxModal');