import type { CSSProperties } from 'react';
import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  ResolvedGallerySectionRuntime,
} from '@/types';

type SharedGalleryCommonSettings = Omit<
  GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

export function resolveGalleryComponentCommonSettings(
  settings: GalleryBehaviorSettings,
  runtime?: ResolvedGallerySectionRuntime,
): SharedGalleryCommonSettings {
  return {
    sectionMaxWidth: runtime?.common.sectionMaxWidth ?? settings.gallerySectionMaxWidth,
    sectionMaxWidthUnit: runtime?.common.sectionMaxWidthUnit ?? settings.gallerySectionMaxWidthUnit,
    sectionMaxHeight: runtime?.common.sectionMaxHeight ?? settings.gallerySectionMaxHeight,
    sectionMaxHeightUnit: runtime?.common.sectionMaxHeightUnit ?? settings.gallerySectionMaxHeightUnit,
    sectionMinWidth: runtime?.common.sectionMinWidth ?? settings.gallerySectionMinWidth,
    sectionMinWidthUnit: runtime?.common.sectionMinWidthUnit ?? settings.gallerySectionMinWidthUnit,
    sectionMinHeight: runtime?.common.sectionMinHeight ?? settings.gallerySectionMinHeight,
    sectionMinHeightUnit: runtime?.common.sectionMinHeightUnit ?? settings.gallerySectionMinHeightUnit,
    sectionHeightMode: runtime?.common.sectionHeightMode ?? settings.gallerySectionHeightMode,
    sectionPadding: runtime?.common.sectionPadding ?? settings.gallerySectionPadding,
    sectionPaddingUnit: runtime?.common.sectionPaddingUnit ?? settings.gallerySectionPaddingUnit,
    adapterContentPadding: runtime?.common.adapterContentPadding ?? settings.adapterContentPadding,
    adapterContentPaddingUnit: runtime?.common.adapterContentPaddingUnit ?? settings.adapterContentPaddingUnit,
    adapterSizingMode: runtime?.common.adapterSizingMode ?? settings.adapterSizingMode,
    adapterMaxWidthPct: runtime?.common.adapterMaxWidthPct ?? settings.adapterMaxWidthPct,
    adapterMaxHeightPct: runtime?.common.adapterMaxHeightPct ?? settings.adapterMaxHeightPct,
    adapterItemGap: runtime?.common.adapterItemGap ?? settings.adapterItemGap,
    adapterItemGapUnit: runtime?.common.adapterItemGapUnit ?? settings.adapterItemGapUnit,
    adapterJustifyContent: runtime?.common.adapterJustifyContent ?? settings.adapterJustifyContent,
    gallerySizingMode: runtime?.common.gallerySizingMode ?? settings.gallerySizingMode,
    galleryManualHeight: runtime?.common.galleryManualHeight ?? settings.galleryManualHeight,
    perTypeSectionEqualHeight: runtime?.common.perTypeSectionEqualHeight ?? settings.perTypeSectionEqualHeight,
    galleryImageLabel: runtime?.common.galleryImageLabel ?? settings.galleryImageLabel,
    galleryVideoLabel: runtime?.common.galleryVideoLabel ?? settings.galleryVideoLabel,
    galleryLabelJustification: runtime?.common.galleryLabelJustification ?? settings.galleryLabelJustification,
    showGalleryLabelIcon: runtime?.common.showGalleryLabelIcon ?? settings.showGalleryLabelIcon,
    showCampaignGalleryLabels: runtime?.common.showCampaignGalleryLabels ?? settings.showCampaignGalleryLabels,
  };
}

export function resolveAdapterShellStyle(common: SharedGalleryCommonSettings): CSSProperties {
  return common.adapterSizingMode === 'manual'
    ? { maxWidth: `${common.adapterMaxWidthPct ?? 100}%`, marginInline: 'auto' }
    : {};
}