import type {
  Campaign,
  GalleryBehaviorSettings,
  GalleryConfigScope,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { normalizeAdapterId } from '@/components/Galleries/Adapters/adapterRegistry';

import {
  buildCampaignGalleryOverrideEditorValue,
} from './campaignGalleryOverrides';

import {
  applyResolvedGalleryAdapterSettings,
  resolveAdapterId,
  resolveGallerySectionRuntime,
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
  runtime: ResolvedGallerySectionRuntime;
  wrapper: CampaignGalleryWrapperPlan;
}

function sortCampaignMedia(media: MediaItem[]): MediaItem[] {
  return [...media].sort((left, right) => left.order - right.order);
}

function resolveCampaignGalleryOverrides(campaign: Campaign) {
  return buildCampaignGalleryOverrideEditorValue(campaign);
}

function buildWrapperPlan(
  scope: CampaignGalleryRenderScope,
  settings: GalleryBehaviorSettings,
  runtime: ResolvedGallerySectionRuntime,
): CampaignGalleryWrapperPlan {
  return {
    bgType: runtime.background.type,
    bgColor: runtime.background.color,
    bgGradient: runtime.background.gradient,
    bgImageUrl: runtime.background.imageUrl,
    borderRadius: scope === 'unified'
      ? Math.max(settings.imageBorderRadius ?? 0, settings.videoBorderRadius ?? 0)
      : scope === 'image'
        ? settings.imageBorderRadius ?? 0
        : settings.videoBorderRadius ?? 0,
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
      tileSizeUnit: settings.imageTileSizeUnit ?? settings.tileSizeUnit,
    };
  }

  if (scope === 'video') {
    return {
      ...settings,
      tileSize: settings.videoTileSize ?? settings.tileSize,
      tileSizeUnit: settings.videoTileSizeUnit ?? settings.tileSizeUnit,
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
  const galleryOverrides = resolveCampaignGalleryOverrides(campaign);
  if (!media.length) {
    return null;
  }

  const runtime = resolveGallerySectionRuntime(settings, breakpoint, 'unified', galleryOverrides);
  const resolvedSettings = applyResolvedGalleryAdapterSettings(settings, runtime);

  return {
    scope: 'unified',
    media,
    adapterId: normalizeAdapterId(
      resolveUnifiedAdapterId(settings, breakpoint, {
        galleryOverrides,
      }),
    ),
    settings: resolvedSettings,
    runtime,
    wrapper: buildWrapperPlan('unified', resolvedSettings, runtime),
  };
}

export function resolvePerTypeCampaignGalleryRenderPlan(
  campaign: Campaign,
  settings: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
  scope: Extract<CampaignGalleryRenderScope, 'image' | 'video'>,
): CampaignGallerySectionRenderPlan | null {
  const media = sortCampaignMedia(scope === 'image' ? campaign.images : campaign.videos);
  const galleryOverrides = resolveCampaignGalleryOverrides(campaign);
  if (!media.length) {
    return null;
  }

  const runtime = resolveGallerySectionRuntime(settings, breakpoint, scope, galleryOverrides);
  const resolvedSettings = applyScopeSpecificSettings(
    scope,
    applyResolvedGalleryAdapterSettings(settings, runtime),
  );

  return {
    scope,
    media,
    adapterId: normalizeAdapterId(
      resolveAdapterId(settings, scope, breakpoint, {
        galleryOverrides,
      }),
    ),
    settings: resolvedSettings,
    runtime,
    wrapper: buildWrapperPlan(scope, resolvedSettings, runtime),
  };
}

export function shouldUseEqualHeightPerTypeLayout(
  ...plans: Array<CampaignGallerySectionRenderPlan | null>
): boolean {
  return plans.some((plan) => Boolean(plan?.runtime.common.perTypeSectionEqualHeight));
}