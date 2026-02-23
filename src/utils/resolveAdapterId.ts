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
  if (s.gallerySelectionMode !== 'per-breakpoint') {
    return mediaType === 'image' ? s.imageGalleryAdapterId : s.videoGalleryAdapterId;
  }
  const key = `${breakpoint}${mediaType === 'image' ? 'Image' : 'Video'}AdapterId` as keyof GalleryBehaviorSettings;
  return (s[key] as string) || (mediaType === 'image' ? s.imageGalleryAdapterId : s.videoGalleryAdapterId);
}
