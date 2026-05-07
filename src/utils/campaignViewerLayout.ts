import type { GalleryBehaviorSettings, GalleryConfig } from '@/types';
import { toCss, toCssOrNumber } from '@/utils/cssUnits';

import { resolveGalleryMode } from './resolveAdapterId';

export interface CampaignViewerGalleryShellLayout {
  galleryMode: 'unified' | 'per-type';
  galleryGap: number | string;
  maxWidth: string;
  paddingLeft?: string;
  paddingRight?: string;
}

export function resolveCampaignViewerGalleryShellLayout(
  settings: GalleryBehaviorSettings,
  galleryOverrides?: Partial<GalleryConfig>,
): CampaignViewerGalleryShellLayout {
  const galleryGap = Math.max(0, Math.min(64, settings.modalGalleryGap ?? 32));
  const galleryGapUnit = settings.modalGalleryGapUnit ?? 'px';
  const galleryMargin = Math.max(0, Math.min(120, settings.modalGalleryMargin ?? 0));
  const galleryMarginUnit = settings.modalGalleryMarginUnit ?? 'px';
  const galleryMaxWidth = Math.max(0, Math.min(3000, settings.modalGalleryMaxWidth ?? 0));
  const galleryMaxWidthUnit = settings.modalGalleryMaxWidthUnit ?? 'px';

  return {
    galleryMode: resolveGalleryMode(settings, galleryOverrides),
    galleryGap: toCssOrNumber(galleryGap, galleryGapUnit),
    maxWidth: galleryMaxWidth > 0 ? toCss(galleryMaxWidth, galleryMaxWidthUnit) : '100%',
    paddingLeft: galleryMargin > 0 ? toCss(galleryMargin, galleryMarginUnit) : undefined,
    paddingRight: galleryMargin > 0 ? toCss(galleryMargin, galleryMarginUnit) : undefined,
  };
}