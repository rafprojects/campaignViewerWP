import { useCallback, useEffect, useState } from 'react';
import type { MediaItem } from '@/types';

export interface MediaLightboxState {
  lightboxOpen: boolean;
  setLightboxOpen: (open: boolean) => void;
  lightboxIndex: number;
  openLightbox: (item: MediaItem) => void;
  navigateLightbox: (direction: 'prev' | 'next') => void;
}

/** Manages lightbox open/index state and keyboard arrow navigation. */
export function useMediaLightbox(imageItems: MediaItem[]): MediaLightboxState {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (item: MediaItem) => {
    const idx = imageItems.findIndex((m) => m.id === item.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
      setLightboxOpen(true);
    }
  };

  const navigateLightbox = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setLightboxIndex((i) => (i > 0 ? i - 1 : imageItems.length - 1));
    } else {
      setLightboxIndex((i) => (i < imageItems.length - 1 ? i + 1 : 0));
    }
  }, [imageItems.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateLightbox('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateLightbox('next');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, navigateLightbox]);

  return { lightboxOpen, setLightboxOpen, lightboxIndex, openLightbox, navigateLightbox };
}
