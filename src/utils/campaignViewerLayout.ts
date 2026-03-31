import type { GalleryBehaviorSettings, GalleryConfig } from '@/types';

import { resolveGalleryMode } from './resolveAdapterId';

export interface CampaignViewerGalleryShellLayout {
  galleryMode: 'unified' | 'per-type';
  galleryGap: number;
  maxWidth: string;
  paddingLeft?: string;
  paddingRight?: string;
}

export function resolveCampaignViewerGalleryShellLayout(
  settings: GalleryBehaviorSettings,
  galleryOverrides?: Partial<GalleryConfig>,
): CampaignViewerGalleryShellLayout {
  const galleryGap = Math.max(0, Math.min(64, settings.modalGalleryGap ?? 32));
  const galleryMargin = Math.max(0, Math.min(120, settings.modalGalleryMargin ?? 0));
  const galleryMaxWidth = Math.max(0, Math.min(3000, settings.modalGalleryMaxWidth ?? 0));

  return {
    galleryMode: resolveGalleryMode(settings, galleryOverrides),
    galleryGap,
    maxWidth: galleryMaxWidth > 0 ? `${galleryMaxWidth}px` : '100%',
    paddingLeft: galleryMargin > 0 ? `${galleryMargin}px` : undefined,
    paddingRight: galleryMargin > 0 ? `${galleryMargin}px` : undefined,
  };
}