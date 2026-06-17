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
import { useEffect, useRef, useState } from 'react';
import { FocusTrap, Portal, ActionIcon, Box, Stack, Text } from '@mantine/core';
import { IconX, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { toCss } from '@wp-super-gallery/shared-utils';
import { useSwipe } from '@wp-super-gallery/shared-utils';
import { acquireBodyScrollLock, releaseBodyScrollLock } from '@wp-super-gallery/shared-utils';
import { KeyboardHintOverlay } from './KeyboardHintOverlay';

const TRANSITION_MS = 250;

/** Minimal media shape required by Lightbox — a structural subset of the app's MediaItem type. */
export interface LightboxMediaItem {
  id: string;
  url: string;
  /** 'video' renders a video element or iframe; anything else renders an image. */
  type: string;
  caption?: string | undefined;
  embedUrl?: string | undefined;
}

export interface LightboxProps {
  isOpen: boolean;
  media: LightboxMediaItem[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Max width for video iframes/elements (default 1100px) */
  videoMaxWidth?: number;
  /** Unit for videoMaxWidth (default 'px') */
  videoMaxWidthUnit?: string;
  /** Height for embedded video iframes (default '70dvh') */
  videoHeight?: number;
  /** Unit for videoHeight (default 'px') */
  videoHeightUnit?: string;
  /** CSS max-height for all media (default '85dvh') */
  mediaMaxHeight?: string;
}

export function Lightbox({ isOpen, media, currentIndex, onPrev, onNext, onClose, videoMaxWidth, videoMaxWidthUnit, videoHeight, videoHeightUnit, mediaMaxHeight }: LightboxProps) {
  const current = media[currentIndex];

  // Resolve lightbox sizing — settings → props → hardcoded defaults
  const resolvedVideoMaxWidth = videoMaxWidth != null
    ? toCss(videoMaxWidth, videoMaxWidthUnit ?? 'px')
    : '1100px';
  const resolvedVideoHeight = videoHeight != null
    ? toCss(videoHeight, videoHeightUnit ?? 'px')
    : '70dvh';
  const resolvedMediaMaxHeight = mediaMaxHeight || '85dvh';

  // Animation state: 'closed' → 'entering' → 'open' → 'exiting' → 'closed'
  const [phase, setPhase] = useState<'closed' | 'entering' | 'open' | 'exiting'>('closed');

  useEffect(() => {
    if (isOpen) {
      setPhase('entering');
      const raf = requestAnimationFrame(() => {
        // Force reflow, then transition to open
        requestAnimationFrame(() => setPhase('open'));
      });
      return () => cancelAnimationFrame(raf);
    } else if (phase === 'open' || phase === 'entering') {
      setPhase('exiting');
      const timer = setTimeout(() => setPhase('closed'), TRANSITION_MS);
      return () => clearTimeout(timer);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Body-scroll lock: active whenever the lightbox is not fully closed.
  // Keyed on phase (not isOpen) so the lock is held through the exit animation.
  // useLightbox consumers release on isOpen=false; this effect releases on
  // phase='closed', keeping lockCount > 0 for the full TRANSITION_MS duration.
  useEffect(() => {
    if (phase === 'closed') return;
    acquireBodyScrollLock();
    return () => releaseBodyScrollLock();
  }, [phase]);

  // Focus management: move focus into the dialog on open; restore it on close.
  useEffect(() => {
    if (phase === 'entering') {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      closeButtonRef.current?.focus();
    } else if (phase === 'closed' && previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus();
      previouslyFocusedRef.current = null;
    }
  }, [phase]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: onNext,
    onSwipeRight: onPrev,
  });

  // Keyboard navigation (Escape, arrow keys)
  useEffect(() => {
    if (phase === 'closed') return;

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
  }, [phase, onClose, onPrev, onNext]);

  if (phase === 'closed' || !current) return null;

  const visible = phase === 'open';

  return (
    <Portal>
      <FocusTrap>
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
            opacity: visible ? 1 : 0,
            transition: `opacity ${TRANSITION_MS}ms ease`,
          }}
        >
          {/* Close button */}
          <ActionIcon
            ref={closeButtonRef}
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
              transform: visible ? 'scale(1)' : 'scale(0.92)',
              transition: `transform ${TRANSITION_MS}ms ease`,
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
                    maxWidth: resolvedVideoMaxWidth,
                    height: resolvedVideoHeight,
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
                    maxWidth: resolvedVideoMaxWidth,
                    maxHeight: resolvedMediaMaxHeight,
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
                  maxHeight: resolvedMediaMaxHeight,
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
            style={{ pointerEvents: 'none', paddingBottom: 'calc(var(--mantine-spacing-lg) + env(safe-area-inset-bottom, 0px))' }}
          >
            <Stack gap="xs">
              {current.caption && (
                <Text size="lg" fw={600} c="white">
                  {current.caption}
                </Text>
              )}
              <Text size="sm" c="gray.4" aria-live="polite" aria-atomic="true">
                {currentIndex + 1} / {media.length}
              </Text>
            </Stack>
          </Box>

          {/* Keyboard hint (shown once per session) */}
          <KeyboardHintOverlay visible={isOpen} />
        </Box>
      </FocusTrap>
    </Portal>
  );
}

Lightbox.displayName = 'Lightbox';
