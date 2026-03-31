import type {
  Campaign,
  GalleryConfig,
  GalleryConfigBreakpoint,
  GalleryConfigMode,
  GalleryConfigScope,
  GalleryScopeConfig,
} from '@/types';

import { cloneGalleryConfig } from './galleryConfig';

const CAMPAIGN_OVERRIDE_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];

type CampaignOverrideScope = Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>;

type CampaignGalleryOverrideSource = Pick<Campaign, 'imageAdapterId' | 'videoAdapterId' | 'galleryOverrides'>;

export interface ClearedCampaignGalleryOverrides {
  imageAdapterId: '';
  videoAdapterId: '';
  galleryOverrides: undefined;
}

export interface NormalizedCampaignLegacyAdapterOverrides {
  imageAdapterId: string;
  videoAdapterId: string;
}

function isNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function isEmptyScopeConfig(scope?: GalleryScopeConfig): boolean {
  if (!scope) {
    return true;
  }

  return !scope.adapterId && !isNonEmptyObject(scope.common) && !isNonEmptyObject(scope.adapterSettings);
}

function hasCampaignResponsiveSettingOverrides(overrides: Partial<GalleryConfig> | undefined): boolean {
  return CAMPAIGN_OVERRIDE_BREAKPOINTS.some((breakpoint) => (
    ['image', 'video', 'unified'] as const
  ).some((scope) => {
    const scopeConfig = overrides?.breakpoints?.[breakpoint]?.[scope];
    return isNonEmptyObject(scopeConfig?.common) || isNonEmptyObject(scopeConfig?.adapterSettings);
  }));
}

function pruneCampaignGalleryOverrides(overrides?: Partial<GalleryConfig>): Partial<GalleryConfig> | undefined {
  if (!overrides) {
    return undefined;
  }

  const next = cloneGalleryConfig(overrides as GalleryConfig) ?? {};

  if (next.breakpoints) {
    CAMPAIGN_OVERRIDE_BREAKPOINTS.forEach((breakpoint) => {
      const breakpointConfig = next.breakpoints?.[breakpoint];
      if (!breakpointConfig) {
        return;
      }

      (['image', 'video', 'unified'] as const).forEach((scope) => {
        if (isEmptyScopeConfig(breakpointConfig[scope])) {
          delete breakpointConfig[scope];
        }
      });

      if (!Object.keys(breakpointConfig).length) {
        delete next.breakpoints?.[breakpoint];
      }
    });

    if (!Object.keys(next.breakpoints).length) {
      delete next.breakpoints;
    }
  }

  return next.mode || next.breakpoints ? next : undefined;
}

export function hasCampaignScopeOverrides(
  overrides: Partial<GalleryConfig> | undefined,
  scope: CampaignOverrideScope,
): boolean {
  return CAMPAIGN_OVERRIDE_BREAKPOINTS.some((breakpoint) => {
    const scopeConfig = overrides?.breakpoints?.[breakpoint]?.[scope];
    return !!scopeConfig && !isEmptyScopeConfig(scopeConfig);
  });
}

function hasCampaignScopeAdapterOverrides(
  overrides: Partial<GalleryConfig> | undefined,
  scope: CampaignOverrideScope,
): boolean {
  return CAMPAIGN_OVERRIDE_BREAKPOINTS.some((breakpoint) => {
    const scopeConfig = overrides?.breakpoints?.[breakpoint]?.[scope];
    return typeof scopeConfig?.adapterId === 'string' && scopeConfig.adapterId.length > 0;
  });
}

function getNormalizedLegacyScopeAdapterId(
  source: CampaignGalleryOverrideSource,
  scope: Extract<CampaignOverrideScope, 'image' | 'video'>,
): string {
  const uniformAdapterId = getUniformCampaignScopeAdapterId(source.galleryOverrides, scope);
  if (uniformAdapterId) {
    return uniformAdapterId;
  }

  if (hasCampaignScopeAdapterOverrides(source.galleryOverrides, scope)) {
    return '';
  }

  return scope === 'image'
    ? source.imageAdapterId || ''
    : source.videoAdapterId || '';
}

export function getUniformCampaignScopeAdapterId(
  overrides: Partial<GalleryConfig> | undefined,
  scope: CampaignOverrideScope,
): string {
  const adapterIds = CAMPAIGN_OVERRIDE_BREAKPOINTS.map((breakpoint) => overrides?.breakpoints?.[breakpoint]?.[scope]?.adapterId ?? '');

  if (adapterIds.some((adapterId) => !adapterId)) {
    return '';
  }

  return adapterIds.every((adapterId) => adapterId === adapterIds[0]) ? adapterIds[0] : '';
}

export function hasMixedCampaignScopeAdapterOverrides(
  overrides: Partial<GalleryConfig> | undefined,
  scope: CampaignOverrideScope,
): boolean {
  return hasCampaignScopeAdapterOverrides(overrides, scope) && !getUniformCampaignScopeAdapterId(overrides, scope);
}

export function getCampaignGalleryOverrideMode(
  overrides: Partial<GalleryConfig> | undefined,
): GalleryConfigMode | '' {
  return overrides?.mode === 'unified' || overrides?.mode === 'per-type'
    ? overrides.mode
    : '';
}

export function buildCampaignGalleryOverrideEditorValue(
  source: CampaignGalleryOverrideSource,
): Partial<GalleryConfig> | undefined {
  if (source.galleryOverrides) {
    return cloneGalleryConfig(source.galleryOverrides as GalleryConfig);
  }

  if (!source.imageAdapterId && !source.videoAdapterId) {
    return undefined;
  }

  return pruneCampaignGalleryOverrides({
    mode: 'per-type',
    breakpoints: {
      desktop: {
        image: source.imageAdapterId ? { adapterId: source.imageAdapterId } : undefined,
        video: source.videoAdapterId ? { adapterId: source.videoAdapterId } : undefined,
      },
      tablet: {
        image: source.imageAdapterId ? { adapterId: source.imageAdapterId } : undefined,
        video: source.videoAdapterId ? { adapterId: source.videoAdapterId } : undefined,
      },
      mobile: {
        image: source.imageAdapterId ? { adapterId: source.imageAdapterId } : undefined,
        video: source.videoAdapterId ? { adapterId: source.videoAdapterId } : undefined,
      },
    },
  });
}

export function clearCampaignGalleryOverrides(): ClearedCampaignGalleryOverrides {
  return {
    imageAdapterId: '',
    videoAdapterId: '',
    galleryOverrides: undefined,
  };
}

export function normalizeCampaignLegacyAdapterOverrides(
  source: CampaignGalleryOverrideSource,
): NormalizedCampaignLegacyAdapterOverrides {
  const mode = getCampaignGalleryOverrideMode(source.galleryOverrides);

  if (mode === 'unified') {
    const unifiedAdapterId = getUniformCampaignScopeAdapterId(source.galleryOverrides, 'unified');
    return {
      imageAdapterId: unifiedAdapterId || '',
      videoAdapterId: unifiedAdapterId || '',
    };
  }

  return {
    imageAdapterId: getNormalizedLegacyScopeAdapterId(source, 'image'),
    videoAdapterId: getNormalizedLegacyScopeAdapterId(source, 'video'),
  };
}

export function syncCampaignScopeAdapterOverride(
  overrides: Partial<GalleryConfig> | undefined,
  scope: CampaignOverrideScope,
  adapterId: string,
): Partial<GalleryConfig> | undefined {
  const next = cloneGalleryConfig(overrides as GalleryConfig) ?? {};

  if (adapterId) {
    next.breakpoints = next.breakpoints ?? {};

    CAMPAIGN_OVERRIDE_BREAKPOINTS.forEach((breakpoint) => {
      const breakpointConfig = next.breakpoints?.[breakpoint] ?? {};
      const scopeConfig = breakpointConfig[scope] ?? {};

      breakpointConfig[scope] = {
        ...scopeConfig,
        adapterId,
      };

      next.breakpoints![breakpoint] = breakpointConfig;
    });

    return pruneCampaignGalleryOverrides(next);
  }

  CAMPAIGN_OVERRIDE_BREAKPOINTS.forEach((breakpoint) => {
    const breakpointConfig = next.breakpoints?.[breakpoint];
    if (!breakpointConfig?.[scope]) {
      return;
    }

    delete breakpointConfig[scope]?.adapterId;
  });

  return pruneCampaignGalleryOverrides(next);
}

export function syncCampaignGalleryOverrideMode(
  overrides: Partial<GalleryConfig> | undefined,
  mode: GalleryConfigMode | '',
): Partial<GalleryConfig> | undefined {
  const next = cloneGalleryConfig(overrides as GalleryConfig) ?? {};

  if (mode) {
    next.mode = mode;
    return pruneCampaignGalleryOverrides(next);
  }

  delete next.mode;
  return pruneCampaignGalleryOverrides(next);
}

export function hasCampaignGalleryOverrides(source: CampaignGalleryOverrideSource): boolean {
  return !!(
    source.imageAdapterId
    || source.videoAdapterId
    || source.galleryOverrides?.mode
    || hasCampaignScopeOverrides(source.galleryOverrides, 'image')
    || hasCampaignScopeOverrides(source.galleryOverrides, 'video')
    || CAMPAIGN_OVERRIDE_BREAKPOINTS.some((breakpoint) => !isEmptyScopeConfig(source.galleryOverrides?.breakpoints?.[breakpoint]?.unified))
  );
}

export function describeCampaignGalleryOverrides(source: CampaignGalleryOverrideSource): string[] {
  const descriptions: string[] = [];
  const mode = source.galleryOverrides?.mode;
  const unifiedAdapterId = getUniformCampaignScopeAdapterId(source.galleryOverrides, 'unified');
  const imageAdapterId = getUniformCampaignScopeAdapterId(source.galleryOverrides, 'image') || source.imageAdapterId || '';
  const videoAdapterId = getUniformCampaignScopeAdapterId(source.galleryOverrides, 'video') || source.videoAdapterId || '';

  if (mode === 'unified') {
    if (unifiedAdapterId) {
      descriptions.push(`Unified: ${unifiedAdapterId}`);
    } else if (hasCampaignScopeAdapterOverrides(source.galleryOverrides, 'unified')) {
      descriptions.push('Unified: breakpoint-specific override');
    }
  } else {
    if (imageAdapterId) {
      descriptions.push(`Image: ${imageAdapterId}`);
    } else if (hasCampaignScopeAdapterOverrides(source.galleryOverrides, 'image')) {
      descriptions.push('Image: breakpoint-specific override');
    }

    if (videoAdapterId) {
      descriptions.push(`Video: ${videoAdapterId}`);
    } else if (hasCampaignScopeAdapterOverrides(source.galleryOverrides, 'video')) {
      descriptions.push('Video: breakpoint-specific override');
    }
  }

  if (hasCampaignResponsiveSettingOverrides(source.galleryOverrides)) {
    descriptions.push('Responsive settings: customized');
  }

  if (mode) {
    descriptions.push(`Mode: ${mode}`);
  }

  return descriptions;
}