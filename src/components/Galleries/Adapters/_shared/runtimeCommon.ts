import type { CSSProperties } from 'react';
import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfigScope,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { resolveGalleryCommonSettings } from '@/utils/resolveAdapterId';

export type SharedGalleryCommonSettings = Omit<
  GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

export type GalleryHeadingKind = 'image' | 'video' | 'mixed';

export interface ResolvedGalleryHeading {
  visible: boolean;
  label: string;
  kind: GalleryHeadingKind;
}

export function resolveGalleryComponentCommonSettings(
  settings: GalleryBehaviorSettings,
  runtime?: ResolvedGallerySectionRuntime,
  fallbackScope: GalleryConfigScope = 'image',
): SharedGalleryCommonSettings {
  const common = runtime?.common ?? resolveGalleryCommonSettings(
    settings,
    runtime?.breakpoint ?? 'desktop',
    runtime?.scope ?? fallbackScope,
  );

  return {
    sectionMaxWidth: common.sectionMaxWidth,
    sectionMaxWidthUnit: common.sectionMaxWidthUnit,
    sectionMaxHeight: common.sectionMaxHeight,
    sectionMaxHeightUnit: common.sectionMaxHeightUnit,
    sectionMinWidth: common.sectionMinWidth,
    sectionMinWidthUnit: common.sectionMinWidthUnit,
    sectionMinHeight: common.sectionMinHeight,
    sectionMinHeightUnit: common.sectionMinHeightUnit,
    sectionHeightMode: common.sectionHeightMode,
    sectionPadding: common.sectionPadding,
    sectionPaddingUnit: common.sectionPaddingUnit,
    adapterContentPadding: common.adapterContentPadding,
    adapterContentPaddingUnit: common.adapterContentPaddingUnit,
    adapterSizingMode: common.adapterSizingMode,
    adapterMaxWidthPct: common.adapterMaxWidthPct,
    adapterMaxHeightPct: common.adapterMaxHeightPct,
    adapterItemGap: common.adapterItemGap,
    adapterItemGapUnit: common.adapterItemGapUnit,
    adapterJustifyContent: common.adapterJustifyContent,
    gallerySizingMode: common.gallerySizingMode,
    galleryManualHeight: common.galleryManualHeight,
    perTypeSectionEqualHeight: common.perTypeSectionEqualHeight,
    galleryImageLabel: common.galleryImageLabel,
    galleryVideoLabel: common.galleryVideoLabel,
    galleryLabelJustification: common.galleryLabelJustification,
    showGalleryLabelIcon: common.showGalleryLabelIcon,
    showCampaignGalleryLabels: common.showCampaignGalleryLabels,
  };
}

export function resolveGalleryHeading(
  common: SharedGalleryCommonSettings,
  media: MediaItem[],
  scope?: GalleryConfigScope,
): ResolvedGalleryHeading {
  const imageCount = media.filter((item) => item.type === 'image').length;
  const videoCount = media.filter((item) => item.type === 'video').length;

  let kind: GalleryHeadingKind;
  if (imageCount > 0 && videoCount > 0) {
    kind = 'mixed';
  } else if (videoCount > 0) {
    kind = 'video';
  } else if (imageCount > 0) {
    kind = 'image';
  } else if (scope === 'video') {
    kind = 'video';
  } else if (scope === 'unified') {
    kind = 'mixed';
  } else {
    kind = 'image';
  }

  return {
    visible: common.showCampaignGalleryLabels !== false,
    label: kind === 'mixed'
      ? `Media (${media.length})`
      : kind === 'video'
        ? `${common.galleryVideoLabel || 'Videos'} (${videoCount})`
        : `${common.galleryImageLabel || 'Images'} (${imageCount})`,
    kind,
  };
}

export function resolveAdapterShellStyle(common: SharedGalleryCommonSettings): CSSProperties {
  return common.adapterSizingMode === 'manual'
    ? { width: '100%', maxWidth: `${common.adapterMaxWidthPct ?? 100}%`, marginInline: 'auto' }
    : { width: '100%' };
}