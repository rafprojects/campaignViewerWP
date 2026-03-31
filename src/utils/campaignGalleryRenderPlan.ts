import type {
  Campaign,
  GalleryBehaviorSettings,
  GalleryConfigScope,
  MediaItem,
} from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { normalizeAdapterId } from '@/components/Galleries/Adapters/adapterRegistry';

import {
  resolveAdapterId,
  resolveEffectiveGallerySettings,
  resolveUnifiedAdapterId,
} from './resolveAdapterId';

type CampaignGalleryRenderScope = Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>;

interface CampaignGalleryWrapperPlan {
  bgType: string;
  bgColor: string;
  bgGradient: string;
  bgImageUrl: string;
  borderRadius: number;
}

export interface CampaignGallerySectionRenderPlan {
  scope: CampaignGalleryRenderScope;
  media: MediaItem[];
  adapterId: string;
  settings: GalleryBehaviorSettings;
  wrapper: CampaignGalleryWrapperPlan;
}

function sortCampaignMedia(media: MediaItem[]): MediaItem[] {
  return [...media].sort((left, right) => left.order - right.order);
}

function buildWrapperPlan(
  scope: CampaignGalleryRenderScope,
  settings: GalleryBehaviorSettings,
): CampaignGalleryWrapperPlan {
  if (scope === 'unified') {
    return {
      bgType: settings.unifiedBgType,
      bgColor: settings.unifiedBgColor,
      bgGradient: settings.unifiedBgGradient,
      bgImageUrl: settings.unifiedBgImageUrl,
      borderRadius: Math.max(settings.imageBorderRadius ?? 0, settings.videoBorderRadius ?? 0),
    };
  }

  if (scope === 'image') {
    return {
      bgType: settings.imageBgType,
      bgColor: settings.imageBgColor,
      bgGradient: settings.imageBgGradient,
      bgImageUrl: settings.imageBgImageUrl,
      borderRadius: settings.imageBorderRadius ?? 0,
    };
  }

  return {
    bgType: settings.videoBgType,
    bgColor: settings.videoBgColor,
    bgGradient: settings.videoBgGradient,
    bgImageUrl: settings.videoBgImageUrl,
    borderRadius: settings.videoBorderRadius ?? 0,
  };
}

function applyScopeSpecificSettings(
  scope: CampaignGalleryRenderScope,
  settings: GalleryBehaviorSettings,
): GalleryBehaviorSettings {
  if (scope === 'image') {
    return {
      ...settings,
      tileSize: settings.imageTileSize ?? settings.tileSize,
    };
  }

  if (scope === 'video') {
    return {
      ...settings,
      tileSize: settings.videoTileSize ?? settings.tileSize,
    };
  }

  return settings;
}

export function resolveUnifiedCampaignGalleryRenderPlan(
  campaign: Campaign,
  settings: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
): CampaignGallerySectionRenderPlan | null {
  const media = sortCampaignMedia([...campaign.videos, ...campaign.images]);
  if (!media.length) {
    return null;
  }

  const resolvedSettings = resolveEffectiveGallerySettings(settings, breakpoint, 'unified', campaign.galleryOverrides);

  return {
    scope: 'unified',
    media,
    adapterId: normalizeAdapterId(
      resolveUnifiedAdapterId(settings, breakpoint, {
        galleryOverrides: campaign.galleryOverrides,
      }),
    ),
    settings: resolvedSettings,
    wrapper: buildWrapperPlan('unified', resolvedSettings),
  };
}

export function resolvePerTypeCampaignGalleryRenderPlan(
  campaign: Campaign,
  settings: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
  scope: Extract<CampaignGalleryRenderScope, 'image' | 'video'>,
): CampaignGallerySectionRenderPlan | null {
  const media = sortCampaignMedia(scope === 'image' ? campaign.images : campaign.videos);
  if (!media.length) {
    return null;
  }

  const resolvedSettings = applyScopeSpecificSettings(
    scope,
    resolveEffectiveGallerySettings(settings, breakpoint, scope, campaign.galleryOverrides),
  );

  return {
    scope,
    media,
    adapterId: normalizeAdapterId(
      resolveAdapterId(settings, scope, breakpoint, {
        galleryOverrides: campaign.galleryOverrides,
        legacyOverrideId: scope === 'image' ? campaign.imageAdapterId : campaign.videoAdapterId,
      }),
    ),
    settings: resolvedSettings,
    wrapper: buildWrapperPlan(scope, resolvedSettings),
  };
}

export function shouldUseEqualHeightPerTypeLayout(
  ...plans: Array<CampaignGallerySectionRenderPlan | null>
): boolean {
  return plans.some((plan) => Boolean(plan?.settings.perTypeSectionEqualHeight));
}