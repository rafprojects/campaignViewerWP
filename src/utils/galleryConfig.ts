import type {
  BreakpointGalleryConfig,
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfig,
  GalleryConfigBreakpoint,
  GalleryConfigScope,
  GalleryScopeConfig,
} from '@/types';
import type { AdapterSettingFieldDefinition } from '@/components/Galleries/Adapters/GalleryAdapter';
import { getAdapterRegistration, getSettingGroupDefinition } from '@/components/Galleries/Adapters/adapterRegistry';
import { getLegacyPerTypeAdapterId } from './galleryAdapterSelection';

export const GALLERY_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];
const GALLERY_SCOPES: GalleryConfigScope[] = ['unified', 'image', 'video'];

type LegacyViewportBackgroundFieldMap = {
  viewportBgType: 'imageBgType' | 'videoBgType' | 'unifiedBgType';
  viewportBgColor: 'imageBgColor' | 'videoBgColor' | 'unifiedBgColor';
  viewportBgGradient: 'imageBgGradient' | 'videoBgGradient' | 'unifiedBgGradient';
  viewportBgImageUrl: 'imageBgImageUrl' | 'videoBgImageUrl' | 'unifiedBgImageUrl';
};

const LEGACY_VIEWPORT_BACKGROUND_FIELD_MAP: Record<GalleryConfigScope, LegacyViewportBackgroundFieldMap> = {
  unified: {
    viewportBgType: 'unifiedBgType',
    viewportBgColor: 'unifiedBgColor',
    viewportBgGradient: 'unifiedBgGradient',
    viewportBgImageUrl: 'unifiedBgImageUrl',
  },
  image: {
    viewportBgType: 'imageBgType',
    viewportBgColor: 'imageBgColor',
    viewportBgGradient: 'imageBgGradient',
    viewportBgImageUrl: 'imageBgImageUrl',
  },
  video: {
    viewportBgType: 'videoBgType',
    viewportBgColor: 'videoBgColor',
    viewportBgGradient: 'videoBgGradient',
    viewportBgImageUrl: 'videoBgImageUrl',
  },
};

export function getLegacyViewportBackgroundFieldMap(
  scope: GalleryConfigScope,
): LegacyViewportBackgroundFieldMap {
  return LEGACY_VIEWPORT_BACKGROUND_FIELD_MAP[scope];
}

function isAdapterSettingFieldApplicableToScope(
  field: AdapterSettingFieldDefinition,
  scope: GalleryConfigScope,
): boolean {
  return field.appliesTo === undefined || field.appliesTo === 'always' || field.appliesTo === scope;
}

function buildLegacyAdapterSettingsForScope(
  settings: Partial<GalleryBehaviorSettings>,
  adapterId: string,
  scope: GalleryConfigScope,
): Record<string, unknown> | undefined {
  const registration = getAdapterRegistration(adapterId);
  if (!registration) {
    return undefined;
  }

  const adapterSettings: Record<string, unknown> = {};

  registration.settingGroups.forEach((group) => {
    const definition = getSettingGroupDefinition(group);
    definition?.fields.forEach((field) => {
      if (!isAdapterSettingFieldApplicableToScope(field, scope)) {
        return;
      }

      const value = settings[field.key];
      if (value !== undefined) {
        adapterSettings[field.key] = value;
      }
    });
  });

  return Object.keys(adapterSettings).length ? adapterSettings : undefined;
}

function cloneCommonSettings(common?: GalleryCommonSettings): GalleryCommonSettings | undefined {
  return common ? { ...common } : undefined;
}

function cloneScopeConfig(scope?: GalleryScopeConfig): GalleryScopeConfig | undefined {
  if (!scope) {
    return undefined;
  }

  return {
    adapterId: scope.adapterId,
    common: cloneCommonSettings(scope.common),
    adapterSettings: scope.adapterSettings ? { ...scope.adapterSettings } : undefined,
  };
}

function cloneBreakpointConfig(config?: BreakpointGalleryConfig): BreakpointGalleryConfig | undefined {
  if (!config) {
    return undefined;
  }

  return {
    unified: cloneScopeConfig(config.unified),
    image: cloneScopeConfig(config.image),
    video: cloneScopeConfig(config.video),
  };
}

export function cloneGalleryConfig(config?: GalleryConfig): GalleryConfig | undefined {
  if (!config) {
    return undefined;
  }

  const breakpoints: Partial<Record<GalleryConfigBreakpoint, BreakpointGalleryConfig>> = {};
  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const cloned = cloneBreakpointConfig(config.breakpoints?.[breakpoint]);
    if (cloned) {
      breakpoints[breakpoint] = cloned;
    }
  }

  return {
    mode: config.mode,
    breakpoints,
  };
}

export function buildGalleryCommonSettingsFromLegacy(
  settings: Pick<
    GalleryBehaviorSettings,
    | 'gallerySectionMaxWidth'
    | 'gallerySectionMaxHeight'
    | 'gallerySectionMinWidth'
    | 'gallerySectionMinHeight'
    | 'gallerySectionHeightMode'
    | 'gallerySectionPadding'
    | 'adapterContentPadding'
    | 'adapterSizingMode'
    | 'adapterMaxWidthPct'
    | 'adapterMaxHeightPct'
    | 'adapterItemGap'
    | 'adapterJustifyContent'
    | 'gallerySizingMode'
    | 'galleryManualHeight'
    | 'imageBgType'
    | 'imageBgColor'
    | 'imageBgGradient'
    | 'imageBgImageUrl'
    | 'videoBgType'
    | 'videoBgColor'
    | 'videoBgGradient'
    | 'videoBgImageUrl'
    | 'unifiedBgType'
    | 'unifiedBgColor'
    | 'unifiedBgGradient'
    | 'unifiedBgImageUrl'
    | 'perTypeSectionEqualHeight'
    | 'galleryImageLabel'
    | 'galleryVideoLabel'
    | 'galleryLabelJustification'
    | 'showGalleryLabelIcon'
    | 'showCampaignGalleryLabels'
  >,
  scope?: GalleryConfigScope,
): GalleryCommonSettings {
  const viewportBackgroundFields = scope ? getLegacyViewportBackgroundFieldMap(scope) : null;

  return {
    sectionMaxWidth: settings.gallerySectionMaxWidth,
    sectionMaxHeight: settings.gallerySectionMaxHeight,
    sectionMinWidth: settings.gallerySectionMinWidth,
    sectionMinHeight: settings.gallerySectionMinHeight,
    sectionHeightMode: settings.gallerySectionHeightMode,
    sectionPadding: settings.gallerySectionPadding,
    adapterContentPadding: settings.adapterContentPadding,
    adapterSizingMode: settings.adapterSizingMode,
    adapterMaxWidthPct: settings.adapterMaxWidthPct,
    adapterMaxHeightPct: settings.adapterMaxHeightPct,
    adapterItemGap: settings.adapterItemGap,
    adapterJustifyContent: settings.adapterJustifyContent,
    gallerySizingMode: settings.gallerySizingMode,
    galleryManualHeight: settings.galleryManualHeight,
    ...(viewportBackgroundFields ? {
      viewportBgType: settings[viewportBackgroundFields.viewportBgType],
      viewportBgColor: settings[viewportBackgroundFields.viewportBgColor],
      viewportBgGradient: settings[viewportBackgroundFields.viewportBgGradient],
      viewportBgImageUrl: settings[viewportBackgroundFields.viewportBgImageUrl],
    } : {}),
    perTypeSectionEqualHeight: settings.perTypeSectionEqualHeight,
    galleryImageLabel: settings.galleryImageLabel,
    galleryVideoLabel: settings.galleryVideoLabel,
    galleryLabelJustification: settings.galleryLabelJustification,
    showGalleryLabelIcon: settings.showGalleryLabelIcon,
    showCampaignGalleryLabels: settings.showCampaignGalleryLabels,
  };
}

function buildLegacyScopeConfig(
  settings: Partial<GalleryBehaviorSettings>,
  adapterId: string,
  scope: GalleryConfigScope,
): GalleryScopeConfig {
  return {
    adapterId,
    common: buildGalleryCommonSettingsFromLegacy(settings as GalleryBehaviorSettings, scope),
    adapterSettings: buildLegacyAdapterSettingsForScope(settings, adapterId, scope),
  };
}

export function buildGalleryConfigFromLegacySettings(
  settings: Pick<
    GalleryBehaviorSettings,
    | 'unifiedGalleryEnabled'
    | 'unifiedGalleryAdapterId'
    | 'gallerySelectionMode'
    | 'imageGalleryAdapterId'
    | 'videoGalleryAdapterId'
    | 'desktopImageAdapterId'
    | 'desktopVideoAdapterId'
    | 'tabletImageAdapterId'
    | 'tabletVideoAdapterId'
    | 'mobileImageAdapterId'
    | 'mobileVideoAdapterId'
    | 'gallerySectionMaxWidth'
    | 'gallerySectionMaxHeight'
    | 'gallerySectionMinWidth'
    | 'gallerySectionMinHeight'
    | 'gallerySectionHeightMode'
    | 'gallerySectionPadding'
    | 'adapterContentPadding'
    | 'adapterSizingMode'
    | 'adapterMaxWidthPct'
    | 'adapterMaxHeightPct'
    | 'adapterItemGap'
    | 'adapterJustifyContent'
    | 'gallerySizingMode'
    | 'galleryManualHeight'
    | 'imageBgType'
    | 'imageBgColor'
    | 'imageBgGradient'
    | 'imageBgImageUrl'
    | 'videoBgType'
    | 'videoBgColor'
    | 'videoBgGradient'
    | 'videoBgImageUrl'
    | 'unifiedBgType'
    | 'unifiedBgColor'
    | 'unifiedBgGradient'
    | 'unifiedBgImageUrl'
    | 'perTypeSectionEqualHeight'
    | 'galleryImageLabel'
    | 'galleryVideoLabel'
    | 'galleryLabelJustification'
    | 'showGalleryLabelIcon'
    | 'showCampaignGalleryLabels'
  >,
): GalleryConfig {
  return {
    mode: settings.unifiedGalleryEnabled ? 'unified' : 'per-type',
    breakpoints: {
      desktop: {
        unified: buildLegacyScopeConfig(settings, settings.unifiedGalleryAdapterId, 'unified'),
        image: buildLegacyScopeConfig(settings, getLegacyPerTypeAdapterId(settings, 'desktop', 'image'), 'image'),
        video: buildLegacyScopeConfig(settings, getLegacyPerTypeAdapterId(settings, 'desktop', 'video'), 'video'),
      },
      tablet: {
        unified: buildLegacyScopeConfig(settings, settings.unifiedGalleryAdapterId, 'unified'),
        image: buildLegacyScopeConfig(settings, getLegacyPerTypeAdapterId(settings, 'tablet', 'image'), 'image'),
        video: buildLegacyScopeConfig(settings, getLegacyPerTypeAdapterId(settings, 'tablet', 'video'), 'video'),
      },
      mobile: {
        unified: buildLegacyScopeConfig(settings, settings.unifiedGalleryAdapterId, 'unified'),
        image: buildLegacyScopeConfig(settings, getLegacyPerTypeAdapterId(settings, 'mobile', 'image'), 'image'),
        video: buildLegacyScopeConfig(settings, getLegacyPerTypeAdapterId(settings, 'mobile', 'video'), 'video'),
      },
    },
  };
}

export function collectGalleryAdapterSettingValues(
  config: GalleryConfig,
): Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>> {
  const collected: Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>> = {};

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    for (const scope of GALLERY_SCOPES) {
      const adapterSettings = config.breakpoints?.[breakpoint]?.[scope]?.adapterSettings;
      if (!adapterSettings) {
        continue;
      }

      for (const [key, value] of Object.entries(adapterSettings)) {
        if (value === undefined) {
          continue;
        }

        const typedKey = key as keyof GalleryBehaviorSettings;
        if (collected[typedKey] === undefined) {
          collected[typedKey] = value as GalleryBehaviorSettings[keyof GalleryBehaviorSettings];
        }
      }
    }
  }

  return collected;
}

function parseGalleryScopeConfig(input: unknown): GalleryScopeConfig | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  const value = input as Record<string, unknown>;
  return {
    adapterId: typeof value.adapterId === 'string' ? value.adapterId : undefined,
    common: value.common && typeof value.common === 'object' && !Array.isArray(value.common)
      ? { ...(value.common as Record<string, unknown>) }
      : undefined,
    adapterSettings: value.adapterSettings && typeof value.adapterSettings === 'object' && !Array.isArray(value.adapterSettings)
      ? { ...(value.adapterSettings as Record<string, unknown>) }
      : undefined,
  };
}

function parseBreakpointGalleryConfig(input: unknown): BreakpointGalleryConfig | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  const value = input as Record<string, unknown>;
  return {
    unified: parseGalleryScopeConfig(value.unified),
    image: parseGalleryScopeConfig(value.image),
    video: parseGalleryScopeConfig(value.video),
  };
}

export function parseGalleryConfig(input: unknown): GalleryConfig | undefined {
  if (input === undefined || input === null || input === '') {
    return undefined;
  }

  let value = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input);
    } catch {
      return undefined;
    }
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const parsed: GalleryConfig = {};

  if (record.mode === 'unified' || record.mode === 'per-type') {
    parsed.mode = record.mode;
  }

  if (record.breakpoints && typeof record.breakpoints === 'object' && !Array.isArray(record.breakpoints)) {
    const breakpoints: Partial<Record<GalleryConfigBreakpoint, BreakpointGalleryConfig>> = {};
    const breakpointRecord = record.breakpoints as Record<string, unknown>;
    for (const breakpoint of GALLERY_BREAKPOINTS) {
      const config = parseBreakpointGalleryConfig(breakpointRecord[breakpoint]);
      if (config) {
        breakpoints[breakpoint] = config;
      }
    }
    parsed.breakpoints = breakpoints;
  }

  return parsed;
}

function mergeScopeConfig(base?: GalleryScopeConfig, override?: GalleryScopeConfig): GalleryScopeConfig | undefined {
  if (!base && !override) {
    return undefined;
  }

  return {
    adapterId: override?.adapterId ?? base?.adapterId,
    common: {
      ...(base?.common ?? {}),
      ...(override?.common ?? {}),
    },
    adapterSettings: {
      ...(base?.adapterSettings ?? {}),
      ...(override?.adapterSettings ?? {}),
    },
  };
}

export function mergeGalleryConfig(base: GalleryConfig, override?: GalleryConfig): GalleryConfig {
  const merged: GalleryConfig = {
    mode: override?.mode ?? base.mode,
    breakpoints: {},
  };

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const baseBreakpoint = base.breakpoints?.[breakpoint];
    const overrideBreakpoint = override?.breakpoints?.[breakpoint];
    const breakpointConfig: BreakpointGalleryConfig = {};

    for (const scope of GALLERY_SCOPES) {
      const mergedScope = mergeScopeConfig(baseBreakpoint?.[scope], overrideBreakpoint?.[scope]);
      if (mergedScope) {
        breakpointConfig[scope] = mergedScope;
      }
    }

    if (Object.keys(breakpointConfig).length > 0) {
      merged.breakpoints![breakpoint] = breakpointConfig;
    }
  }

  return merged;
}