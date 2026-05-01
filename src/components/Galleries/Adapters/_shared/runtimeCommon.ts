import type { CSSProperties } from 'react';
import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfigScope,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { resolveGalleryCommonSettings } from '@/utils/resolveAdapterId';

type SharedGalleryCommonSettings = Omit<
  GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

export function resolveGalleryComponentCommonSettings(
  settings: GalleryBehaviorSettings,
  runtime?: ResolvedGallerySectionRuntime,
  fallbackScope: GalleryConfigScope = 'image',
): SharedGalleryCommonSettings {
  const common = resolveGalleryCommonSettings(
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

export function resolveAdapterShellStyle(common: SharedGalleryCommonSettings): CSSProperties {
  return common.adapterSizingMode === 'manual'
    ? { maxWidth: `${common.adapterMaxWidthPct ?? 100}%`, marginInline: 'auto' }
    : {};
}