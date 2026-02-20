/**
 * P12-C: Reusable Portal-based Lightbox
 *
 * Renders a full-screen image lightbox via Mantine Portal at z-index 9999,
 * bypassing any Mantine Modal nesting/z-index stacking issues that occur
 * when a Modal is opened inside another fullScreen Modal (e.g. CampaignViewer).
 *
 * The Portal inherits getRootElement() from the nearest MantineProvider, so
 * it correctly targets the shadow DOM mount point in WP plugin mode.
 */
import { useEffect } from 'react';
import { Portal, ActionIcon, Box, Stack, Text } from '@mantine/core';
import { IconX, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { MediaItem } from '@/types';
import { useSwipe } from '@/hooks/useSwipe';
import { KeyboardHintOverlay } from './KeyboardHintOverlay';

export interface LightboxProps {
  isOpen: boolean;
  media: MediaItem[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function Lightbox({ isOpen, media, currentIndex, onPrev, onNext, onClose }: LightboxProps) {
  const current = media[currentIndex];

  const swipeHandlers = useSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });

  // Keyboard navigation (Escape, arrow keys)
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev();
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, onPrev, onNext]);

  if (!isOpen || !current) return null;

  return (
    <Portal>
      {/* Full-screen backdrop — clicking outside the image closes */}
      <Box
        {...swipeHandlers}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Media lightbox"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(0,0,0,0.93)',
          touchAction: 'pan-y',
        }}
      >
        {/* Close button */}
        <ActionIcon
          pos="absolute"
          top={16}
          right={16}
          size="lg"
          variant="light"
          aria-label="Close lightbox"
          style={{ zIndex: 1 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <IconX size={24} />
        </ActionIcon>

        {/* Centred image — stopPropagation prevents accidental close on img click */}
        <Box
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {current.type === 'video' ? (
            current.embedUrl ? (
              <iframe
                key={current.id}
                src={current.embedUrl}
                title={current.caption || 'Campaign video'}
                allowFullScreen
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '90vw',
                  maxWidth: 1100,
                  height: '70vh',
                  border: 'none',
                  borderRadius: 4,
                  display: 'block',
                }}
              />
            ) : (
              <video
                key={current.id}
                src={current.url}
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
                style={{
                  maxWidth: '90vw',
                  maxHeight: '85vh',
                  borderRadius: 4,
                  display: 'block',
                }}
              />
            )
          ) : (
            <img
              key={current.id}
              src={current.url}
              alt={current.caption || 'Campaign image'}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '90vw',
                maxHeight: '85vh',
                objectFit: 'contain',
                borderRadius: 4,
                display: 'block',
              }}
            />
          )}
        </Box>

        {/* Navigation arrows */}
        {media.length > 1 && (
          <>
            <ActionIcon
              pos="absolute"
              top="50%"
              left={16}
              size="xl"
              variant="light"
              aria-label="Previous image (lightbox)"
              style={{ transform: 'translateY(-50%)' }}
              onClick={(e) => {
                e.stopPropagation();
                onPrev();
              }}
            >
              <IconChevronLeft size={32} />
            </ActionIcon>
            <ActionIcon
              pos="absolute"
              top="50%"
              right={16}
              size="xl"
              variant="light"
              aria-label="Next image (lightbox)"
              style={{ transform: 'translateY(-50%)' }}
              onClick={(e) => {
                e.stopPropagation();
                onNext();
              }}
            >
              <IconChevronRight size={32} />
            </ActionIcon>
          </>
        )}

        {/* Caption & counter */}
        <Box
          pos="absolute"
          bottom={0}
          left={0}
          right={0}
          p="lg"
          style={{ pointerEvents: 'none' }}
        >
          <Stack gap="xs">
            {current.caption && (
              <Text size="lg" fw={600} c="white">
                {current.caption}
              </Text>
            )}
            <Text size="sm" c="gray.4">
              {currentIndex + 1} / {media.length}
            </Text>
          </Stack>
        </Box>

        {/* Keyboard hint (shown once per session) */}
        <KeyboardHintOverlay visible={isOpen} />
      </Box>
    </Portal>
  );
}
