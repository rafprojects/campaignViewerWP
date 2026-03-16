import type { GalleryBehaviorSettings } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';

/**
 * Resolve the adapter ID to use for a given media type and breakpoint.
 *
 * When `gallerySelectionMode` is `'per-breakpoint'`, selects from the 6
 * per-breakpoint adapter settings. Otherwise returns the unified setting.
 */
export function resolveAdapterId(
  s: GalleryBehaviorSettings,
  mediaType: 'image' | 'video',
  breakpoint: Breakpoint,
): string {
  let id: string;
  if (s.gallerySelectionMode !== 'per-breakpoint') {
    id = mediaType === 'image' ? s.imageGalleryAdapterId : s.videoGalleryAdapterId;
  } else {
    const key = `${breakpoint}${mediaType === 'image' ? 'Image' : 'Video'}AdapterId` as keyof GalleryBehaviorSettings;
    id = (s[key] as string) || (mediaType === 'image' ? s.imageGalleryAdapterId : s.videoGalleryAdapterId);
  }

  // Layout-builder is not supported on mobile — fall back to the unified adapter or classic.
  if (id === 'layout-builder' && breakpoint === 'mobile') {
    const fallback = mediaType === 'image' ? s.imageGalleryAdapterId : s.videoGalleryAdapterId;
    return (fallback && fallback !== 'layout-builder') ? fallback : 'classic';
  }

  return id;
}
