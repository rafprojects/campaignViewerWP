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
import {
  getAdapterRegistration,
  getRegisteredAdapters,
  getSettingGroupDefinition,
  isAdapterSupportedAtBreakpoint,
  normalizeAdapterId,
} from '@/components/Galleries/Adapters/adapterRegistry';
import { getLegacyFlatAdapterId, getLegacyPerTypeAdapterId, LEGACY_BREAKPOINT_SCOPE_KEYS } from './galleryAdapterSelection';

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

const LEGACY_COMMON_SETTING_FIELD_MAP = {
  gallerySectionMaxWidth: 'sectionMaxWidth',
  gallerySectionMaxHeight: 'sectionMaxHeight',
  gallerySectionMinWidth: 'sectionMinWidth',
  gallerySectionMinHeight: 'sectionMinHeight',
  gallerySectionHeightMode: 'sectionHeightMode',
  gallerySectionPadding: 'sectionPadding',
  adapterContentPadding: 'adapterContentPadding',
  adapterSizingMode: 'adapterSizingMode',
  adapterMaxWidthPct: 'adapterMaxWidthPct',
  adapterMaxHeightPct: 'adapterMaxHeightPct',
  adapterItemGap: 'adapterItemGap',
  adapterJustifyContent: 'adapterJustifyContent',
  gallerySizingMode: 'gallerySizingMode',
  galleryManualHeight: 'galleryManualHeight',
  perTypeSectionEqualHeight: 'perTypeSectionEqualHeight',
  galleryImageLabel: 'galleryImageLabel',
  galleryVideoLabel: 'galleryVideoLabel',
  galleryLabelJustification: 'galleryLabelJustification',
  showGalleryLabelIcon: 'showGalleryLabelIcon',
  showCampaignGalleryLabels: 'showCampaignGalleryLabels',
} as const satisfies Partial<Record<keyof GalleryBehaviorSettings, keyof GalleryCommonSettings>>;

const LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP = {
  imageBgType: { scope: 'image', commonKey: 'viewportBgType' },
  imageBgColor: { scope: 'image', commonKey: 'viewportBgColor' },
  imageBgGradient: { scope: 'image', commonKey: 'viewportBgGradient' },
  imageBgImageUrl: { scope: 'image', commonKey: 'viewportBgImageUrl' },
  videoBgType: { scope: 'video', commonKey: 'viewportBgType' },
  videoBgColor: { scope: 'video', commonKey: 'viewportBgColor' },
  videoBgGradient: { scope: 'video', commonKey: 'viewportBgGradient' },
  videoBgImageUrl: { scope: 'video', commonKey: 'viewportBgImageUrl' },
  unifiedBgType: { scope: 'unified', commonKey: 'viewportBgType' },
  unifiedBgColor: { scope: 'unified', commonKey: 'viewportBgColor' },
  unifiedBgGradient: { scope: 'unified', commonKey: 'viewportBgGradient' },
  unifiedBgImageUrl: { scope: 'unified', commonKey: 'viewportBgImageUrl' },
} as const satisfies Partial<Record<keyof GalleryBehaviorSettings, { scope: GalleryConfigScope; commonKey: keyof GalleryCommonSettings }>>;

const LEGACY_UNIFIED_ADAPTER_SETTING_KEYS = [
  'unifiedGalleryEnabled',
  'unifiedGalleryAdapterId',
] as const satisfies readonly (keyof GalleryBehaviorSettings)[];

const LEGACY_PER_TYPE_ADAPTER_SETTING_KEYS = [
  'gallerySelectionMode',
  'imageGalleryAdapterId',
  'videoGalleryAdapterId',
  'desktopImageAdapterId',
  'desktopVideoAdapterId',
  'tabletImageAdapterId',
  'tabletVideoAdapterId',
  'mobileImageAdapterId',
  'mobileVideoAdapterId',
] as const satisfies readonly (keyof GalleryBehaviorSettings)[];

const LEGACY_ADAPTER_SETTING_KEYS = Array.from(
  new Set(
    getRegisteredAdapters().flatMap((adapter) => (
      adapter.settingGroups.flatMap((group) => (
        getSettingGroupDefinition(group)?.fields.map((field) => field.key) ?? []
      ))
    )),
  ),
) as Array<keyof GalleryBehaviorSettings>;

export const LEGACY_GALLERY_SETTING_KEYS: Array<keyof GalleryBehaviorSettings> = Array.from(
  new Set<keyof GalleryBehaviorSettings>([
    ...(Object.keys(LEGACY_COMMON_SETTING_FIELD_MAP) as Array<keyof GalleryBehaviorSettings>),
    ...(Object.keys(LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP) as Array<keyof GalleryBehaviorSettings>),
    ...LEGACY_UNIFIED_ADAPTER_SETTING_KEYS,
    ...LEGACY_PER_TYPE_ADAPTER_SETTING_KEYS,
    ...LEGACY_ADAPTER_SETTING_KEYS,
  ]),
);

type RepresentativeGalleryCommonSettingKey = Exclude<
  keyof GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

export function getLegacyViewportBackgroundFieldMap(
  scope: GalleryConfigScope,
): LegacyViewportBackgroundFieldMap {
  return LEGACY_VIEWPORT_BACKGROUND_FIELD_MAP[scope];
}

function getCollectionScopesForMode(mode?: GalleryConfig['mode']): GalleryConfigScope[] {
  return mode === 'unified'
    ? ['unified', 'image', 'video']
    : ['image', 'video', 'unified'];
}

function getOrCreateScopeConfig(
  config: GalleryConfig,
  breakpoint: GalleryConfigBreakpoint,
  scope: GalleryConfigScope,
): GalleryScopeConfig {
  config.breakpoints ??= {};
  const breakpointConfig = config.breakpoints[breakpoint] ?? {};
  config.breakpoints[breakpoint] = breakpointConfig;

  const scopeConfig = breakpointConfig[scope] ?? {};
  breakpointConfig[scope] = scopeConfig;

  return scopeConfig;
}

function syncSharedCommonSettingAcrossScopes<K extends keyof GalleryCommonSettings>(
  config: GalleryConfig,
  key: K,
  value: GalleryCommonSettings[K],
) {
  for (const breakpoint of GALLERY_BREAKPOINTS) {
    for (const scope of GALLERY_SCOPES) {
      const scopeConfig = getOrCreateScopeConfig(config, breakpoint, scope);
      scopeConfig.common ??= {};
      scopeConfig.common[key] = value;
    }
  }
}

function syncScopedCommonSettingAcrossBreakpoints<K extends keyof GalleryCommonSettings>(
  config: GalleryConfig,
  scope: GalleryConfigScope,
  key: K,
  value: GalleryCommonSettings[K],
) {
  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const scopeConfig = getOrCreateScopeConfig(config, breakpoint, scope);
    scopeConfig.common ??= {};
    scopeConfig.common[key] = value;
  }
}

function syncUnifiedScopeAdapters(
  config: GalleryConfig,
  adapterId: string,
) {
  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const scopeConfig = getOrCreateScopeConfig(config, breakpoint, 'unified');
    scopeConfig.adapterId = adapterId;
  }
}

function syncPerTypeScopeAdapters(
  config: GalleryConfig,
  settings: GalleryBehaviorSettings,
) {
  for (const breakpoint of GALLERY_BREAKPOINTS) {
    getOrCreateScopeConfig(config, breakpoint, 'image').adapterId = getLegacyPerTypeAdapterId(settings, breakpoint, 'image');
    getOrCreateScopeConfig(config, breakpoint, 'video').adapterId = getLegacyPerTypeAdapterId(settings, breakpoint, 'video');
  }
}

function scopeUsesAdapterSettingKey(
  adapterId: string | undefined,
  scope: GalleryConfigScope,
  key: keyof GalleryBehaviorSettings,
): boolean {
  const registration = getAdapterRegistration(adapterId ?? '');
  if (!registration) {
    return false;
  }

  return registration.settingGroups.some((group) => {
    const definition = getSettingGroupDefinition(group);
    if (!definition) {
      return false;
    }

    return definition.fields.some((field) => field.key === key && isAdapterSettingFieldApplicableToScope(field, scope));
  });
}

function isAdapterSettingFieldApplicableToScope(
  field: AdapterSettingFieldDefinition,
  scope: GalleryConfigScope,
): boolean {
  if (field.appliesTo === undefined || field.appliesTo === 'always') {
    return true;
  }

  if (Array.isArray(field.appliesTo)) {
    return field.appliesTo.includes(scope);
  }

  return field.appliesTo === scope;
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

function resolveLegacyBreakpointAdapterId(
  settings: Pick<
    GalleryBehaviorSettings,
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
  >,
  breakpoint: GalleryConfigBreakpoint,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
): string {
  if (scope === 'unified') {
    const normalizedUnifiedId = normalizeAdapterId(settings.unifiedGalleryAdapterId);
    return isAdapterSupportedAtBreakpoint(normalizedUnifiedId, breakpoint) ? normalizedUnifiedId : 'classic';
  }

  const perBreakpointAdapterId = settings.gallerySelectionMode === 'per-breakpoint'
    ? settings[LEGACY_BREAKPOINT_SCOPE_KEYS[scope][breakpoint]]
    : getLegacyFlatAdapterId(settings, scope);
  const fallbackAdapterId = getLegacyFlatAdapterId(settings, scope);

  for (const adapterId of [perBreakpointAdapterId, fallbackAdapterId]) {
    if (!adapterId) {
      continue;
    }

    const normalizedAdapterId = normalizeAdapterId(adapterId);
    if (isAdapterSupportedAtBreakpoint(normalizedAdapterId, breakpoint)) {
      return normalizedAdapterId;
    }
  }

  return 'classic';
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
        unified: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'desktop', 'unified'), 'unified'),
        image: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'desktop', 'image'), 'image'),
        video: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'desktop', 'video'), 'video'),
      },
      tablet: {
        unified: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'tablet', 'unified'), 'unified'),
        image: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'tablet', 'image'), 'image'),
        video: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'tablet', 'video'), 'video'),
      },
      mobile: {
        unified: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'mobile', 'unified'), 'unified'),
        image: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'mobile', 'image'), 'image'),
        video: buildLegacyScopeConfig(settings, resolveLegacyBreakpointAdapterId(settings, 'mobile', 'video'), 'video'),
      },
    },
  };
}

export function collectGalleryAdapterSettingValues(
  config: GalleryConfig,
): Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>> {
  const collected: Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>> = {};
  const scopes = getCollectionScopesForMode(config.mode);

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    for (const scope of scopes) {
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

export function getRepresentativeScopeAdapterId(
  config: GalleryConfig,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
): string {
  return config.breakpoints?.desktop?.[scope]?.adapterId
    ?? config.breakpoints?.tablet?.[scope]?.adapterId
    ?? config.breakpoints?.mobile?.[scope]?.adapterId
    ?? '';
}

export function getRepresentativeGalleryCommonSetting(
  config: GalleryConfig,
  key: RepresentativeGalleryCommonSettingKey,
): number | string | boolean | undefined {
  const scopes = config.mode === 'unified'
    ? ['unified'] as const
    : ['image', 'video'] as const;

  for (const scope of scopes) {
    const value = config.breakpoints?.desktop?.[scope]?.common?.[key]
      ?? config.breakpoints?.tablet?.[scope]?.common?.[key]
      ?? config.breakpoints?.mobile?.[scope]?.common?.[key];

    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }
  }

  return undefined;
}

export function getScopeGalleryCommonSetting(
  config: GalleryConfig,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
  key: 'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl',
): string | undefined {
  const value = config.breakpoints?.desktop?.[scope]?.common?.[key]
    ?? config.breakpoints?.tablet?.[scope]?.common?.[key]
    ?? config.breakpoints?.mobile?.[scope]?.common?.[key];

  return typeof value === 'string' ? value : undefined;
}

export function collectLegacyGallerySettingValues(
  config: GalleryConfig,
): Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>> {
  const mode = config.mode === 'unified' ? 'unified' : 'per-type';
  const projected: Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>> = {
    ...collectGalleryAdapterSettingValues(config),
    unifiedGalleryEnabled: mode === 'unified',
    unifiedGalleryAdapterId: getRepresentativeScopeAdapterId(config, 'unified'),
    gallerySelectionMode: mode === 'per-type' ? 'per-breakpoint' : 'unified',
    imageGalleryAdapterId: getRepresentativeScopeAdapterId(config, 'image'),
    videoGalleryAdapterId: getRepresentativeScopeAdapterId(config, 'video'),
    desktopImageAdapterId: config.breakpoints?.desktop?.image?.adapterId ?? '',
    desktopVideoAdapterId: config.breakpoints?.desktop?.video?.adapterId ?? '',
    tabletImageAdapterId: config.breakpoints?.tablet?.image?.adapterId ?? '',
    tabletVideoAdapterId: config.breakpoints?.tablet?.video?.adapterId ?? '',
    mobileImageAdapterId: config.breakpoints?.mobile?.image?.adapterId ?? '',
    mobileVideoAdapterId: config.breakpoints?.mobile?.video?.adapterId ?? '',
  };

  const legacyCommonValues = {
    gallerySectionMaxWidth: getRepresentativeGalleryCommonSetting(config, 'sectionMaxWidth'),
    gallerySectionMaxHeight: getRepresentativeGalleryCommonSetting(config, 'sectionMaxHeight'),
    gallerySectionMinWidth: getRepresentativeGalleryCommonSetting(config, 'sectionMinWidth'),
    gallerySectionMinHeight: getRepresentativeGalleryCommonSetting(config, 'sectionMinHeight'),
    gallerySectionHeightMode: getRepresentativeGalleryCommonSetting(config, 'sectionHeightMode'),
    gallerySectionPadding: getRepresentativeGalleryCommonSetting(config, 'sectionPadding'),
    adapterContentPadding: getRepresentativeGalleryCommonSetting(config, 'adapterContentPadding'),
    adapterSizingMode: getRepresentativeGalleryCommonSetting(config, 'adapterSizingMode'),
    adapterMaxWidthPct: getRepresentativeGalleryCommonSetting(config, 'adapterMaxWidthPct'),
    adapterMaxHeightPct: getRepresentativeGalleryCommonSetting(config, 'adapterMaxHeightPct'),
    adapterItemGap: getRepresentativeGalleryCommonSetting(config, 'adapterItemGap'),
    adapterJustifyContent: getRepresentativeGalleryCommonSetting(config, 'adapterJustifyContent'),
    gallerySizingMode: getRepresentativeGalleryCommonSetting(config, 'gallerySizingMode'),
    galleryManualHeight: getRepresentativeGalleryCommonSetting(config, 'galleryManualHeight'),
    perTypeSectionEqualHeight: getRepresentativeGalleryCommonSetting(config, 'perTypeSectionEqualHeight'),
    galleryImageLabel: getRepresentativeGalleryCommonSetting(config, 'galleryImageLabel'),
    galleryVideoLabel: getRepresentativeGalleryCommonSetting(config, 'galleryVideoLabel'),
    galleryLabelJustification: getRepresentativeGalleryCommonSetting(config, 'galleryLabelJustification'),
    showGalleryLabelIcon: getRepresentativeGalleryCommonSetting(config, 'showGalleryLabelIcon'),
    showCampaignGalleryLabels: getRepresentativeGalleryCommonSetting(config, 'showCampaignGalleryLabels'),
    imageBgType: getScopeGalleryCommonSetting(config, 'image', 'viewportBgType'),
    imageBgColor: getScopeGalleryCommonSetting(config, 'image', 'viewportBgColor'),
    imageBgGradient: getScopeGalleryCommonSetting(config, 'image', 'viewportBgGradient'),
    imageBgImageUrl: getScopeGalleryCommonSetting(config, 'image', 'viewportBgImageUrl'),
    videoBgType: getScopeGalleryCommonSetting(config, 'video', 'viewportBgType'),
    videoBgColor: getScopeGalleryCommonSetting(config, 'video', 'viewportBgColor'),
    videoBgGradient: getScopeGalleryCommonSetting(config, 'video', 'viewportBgGradient'),
    videoBgImageUrl: getScopeGalleryCommonSetting(config, 'video', 'viewportBgImageUrl'),
    unifiedBgType: getScopeGalleryCommonSetting(config, 'unified', 'viewportBgType'),
    unifiedBgColor: getScopeGalleryCommonSetting(config, 'unified', 'viewportBgColor'),
    unifiedBgGradient: getScopeGalleryCommonSetting(config, 'unified', 'viewportBgGradient'),
    unifiedBgImageUrl: getScopeGalleryCommonSetting(config, 'unified', 'viewportBgImageUrl'),
  } satisfies Partial<Record<keyof GalleryBehaviorSettings, GalleryBehaviorSettings[keyof GalleryBehaviorSettings]>>;

  for (const [key, value] of Object.entries(legacyCommonValues)) {
    if (value !== undefined) {
      projected[key as keyof GalleryBehaviorSettings] = value as GalleryBehaviorSettings[keyof GalleryBehaviorSettings];
    }
  }

  return projected;
}

export function syncLegacyGallerySettingToConfig<K extends keyof GalleryBehaviorSettings>(
  config: GalleryConfig | undefined,
  settings: GalleryBehaviorSettings,
  key: K,
  value: GalleryBehaviorSettings[K],
): GalleryConfig | undefined {
  const commonKey = LEGACY_COMMON_SETTING_FIELD_MAP[key as keyof typeof LEGACY_COMMON_SETTING_FIELD_MAP];
  const scopedCommonKey = LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP[key as keyof typeof LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP];
  const isUnifiedAdapterSetting = (LEGACY_UNIFIED_ADAPTER_SETTING_KEYS as readonly string[]).includes(key);
  const isPerTypeAdapterSetting = (LEGACY_PER_TYPE_ADAPTER_SETTING_KEYS as readonly string[]).includes(key);

  if (!commonKey && !scopedCommonKey && !isUnifiedAdapterSetting && !isPerTypeAdapterSetting) {
    let usesAdapterSetting = false;
    for (const breakpoint of GALLERY_BREAKPOINTS) {
      for (const scope of GALLERY_SCOPES) {
        const adapterId = config?.breakpoints?.[breakpoint]?.[scope]?.adapterId;
        if (scopeUsesAdapterSettingKey(adapterId, scope, key)) {
          usesAdapterSetting = true;
          break;
        }
      }
      if (usesAdapterSetting) {
        break;
      }
    }

    if (!usesAdapterSetting) {
      return undefined;
    }
  }

  const nextConfig = cloneGalleryConfig(config) ?? buildGalleryConfigFromLegacySettings(settings);

  if (commonKey) {
    syncSharedCommonSettingAcrossScopes(nextConfig, commonKey, value as GalleryCommonSettings[typeof commonKey]);
    return nextConfig;
  }

  if (scopedCommonKey) {
    syncScopedCommonSettingAcrossBreakpoints(
      nextConfig,
      scopedCommonKey.scope,
      scopedCommonKey.commonKey,
      value as GalleryCommonSettings[typeof scopedCommonKey.commonKey],
    );
    return nextConfig;
  }

  if (isUnifiedAdapterSetting) {
    nextConfig.mode = settings.unifiedGalleryEnabled ? 'unified' : 'per-type';
    syncUnifiedScopeAdapters(nextConfig, settings.unifiedGalleryAdapterId);
    syncPerTypeScopeAdapters(nextConfig, settings);
    return nextConfig;
  }

  if (isPerTypeAdapterSetting) {
    syncPerTypeScopeAdapters(nextConfig, settings);
    return nextConfig;
  }

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    for (const scope of GALLERY_SCOPES) {
      const scopeConfig = getOrCreateScopeConfig(nextConfig, breakpoint, scope);
      if (!scopeUsesAdapterSettingKey(scopeConfig.adapterId, scope, key)) {
        continue;
      }

      scopeConfig.adapterSettings ??= {};
      scopeConfig.adapterSettings[key] = value;
    }
  }

  return nextConfig;
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