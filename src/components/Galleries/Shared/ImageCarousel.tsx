/**
 * @deprecated Use MediaCarouselAdapter via the adapter registry instead.
 * Thin wrapper retained for backward-compatibility during migration.
 */
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { MediaCarouselInner } from '@/components/Galleries/Adapters/MediaCarouselAdapter';

interface ImageCarouselProps {
  images: MediaItem[];
  settings?: GalleryBehaviorSettings;
  breakpoint?: Breakpoint;
  maxWidth?: number;
}

/** @deprecated Use MediaCarouselAdapter directly. */
export function ImageCarousel({ images, settings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS, breakpoint = 'desktop', maxWidth = 0 }: ImageCarouselProps) {
  return (
    <MediaCarouselInner
      media={images}
      settings={settings}
      breakpoint={breakpoint}
      maxWidth={maxWidth}
    />
  );
}
