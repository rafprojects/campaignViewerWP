/**
 * @deprecated Use MediaCarouselAdapter via the adapter registry instead.
 * Thin wrapper retained for backward-compatibility during migration.
 */
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings, type MediaItem } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { MediaCarouselInner } from '@/components/Galleries/Adapters/MediaCarouselAdapter';
import { resolveGalleryComponentCommonSettings } from '@/components/Galleries/Adapters/_shared/runtimeCommon';

interface VideoCarouselProps {
  videos: MediaItem[];
  settings?: GalleryBehaviorSettings;
  breakpoint?: Breakpoint;
  maxWidth?: number;
}

/** @deprecated Use MediaCarouselAdapter directly. */
export function VideoCarousel({ videos, settings = DEFAULT_GALLERY_BEHAVIOR_SETTINGS, breakpoint = 'desktop', maxWidth = 0 }: VideoCarouselProps) {
  return (
    <MediaCarouselInner
      media={videos}
      settings={settings}
      commonSettings={resolveGalleryComponentCommonSettings(settings)}
      breakpoint={breakpoint}
      maxWidth={maxWidth}
    />
  );
}
