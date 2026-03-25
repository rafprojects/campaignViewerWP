import type {
  BreakpointGalleryConfig,
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfig,
  GalleryConfigBreakpoint,
  GalleryConfigScope,
  GalleryScopeConfig,
} from '@/types';

const GALLERY_BREAKPOINTS: GalleryConfigBreakpoint[] = ['desktop', 'tablet', 'mobile'];
const GALLERY_SCOPES: GalleryConfigScope[] = ['unified', 'image', 'video'];

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
    | 'perTypeSectionEqualHeight'
  >,
): GalleryCommonSettings {
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
    perTypeSectionEqualHeight: settings.perTypeSectionEqualHeight,
  };
}

function buildLegacyScopeConfig(adapterId: string, common: GalleryCommonSettings): GalleryScopeConfig {
  return {
    adapterId,
    common: { ...common },
  };
}

function getLegacyPerTypeAdapterId(
  settings: Pick<
    GalleryBehaviorSettings,
    | 'gallerySelectionMode'
    | 'imageGalleryAdapterId'
    | 'videoGalleryAdapterId'
    | 'desktopImageAdapterId'
    | 'desktopVideoAdapterId'
    | 'tabletImageAdapterId'
    | 'tabletVideoAdapterId'
    | 'mobileImageAdapterId'
    | 'mobileVideoAdapterId'
  >,
  breakpoint: GalleryConfigBreakpoint,
  scope: 'image' | 'video',
): string {
  if (settings.gallerySelectionMode !== 'per-breakpoint') {
    return scope === 'image' ? settings.imageGalleryAdapterId : settings.videoGalleryAdapterId;
  }

  const breakpointKey = `${breakpoint}${scope === 'image' ? 'Image' : 'Video'}AdapterId` as const;
  const perBreakpointId = settings[breakpointKey];

  if (perBreakpointId) {
    return perBreakpointId;
  }

  return scope === 'image' ? settings.imageGalleryAdapterId : settings.videoGalleryAdapterId;
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
    | 'perTypeSectionEqualHeight'
  >,
): GalleryConfig {
  const common = buildGalleryCommonSettingsFromLegacy(settings);

  return {
    mode: settings.unifiedGalleryEnabled ? 'unified' : 'per-type',
    breakpoints: {
      desktop: {
        unified: buildLegacyScopeConfig(settings.unifiedGalleryAdapterId, common),
        image: buildLegacyScopeConfig(getLegacyPerTypeAdapterId(settings, 'desktop', 'image'), common),
        video: buildLegacyScopeConfig(getLegacyPerTypeAdapterId(settings, 'desktop', 'video'), common),
      },
      tablet: {
        unified: buildLegacyScopeConfig(settings.unifiedGalleryAdapterId, common),
        image: buildLegacyScopeConfig(getLegacyPerTypeAdapterId(settings, 'tablet', 'image'), common),
        video: buildLegacyScopeConfig(getLegacyPerTypeAdapterId(settings, 'tablet', 'video'), common),
      },
      mobile: {
        unified: buildLegacyScopeConfig(settings.unifiedGalleryAdapterId, common),
        image: buildLegacyScopeConfig(getLegacyPerTypeAdapterId(settings, 'mobile', 'image'), common),
        video: buildLegacyScopeConfig(getLegacyPerTypeAdapterId(settings, 'mobile', 'video'), common),
      },
    },
  };
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