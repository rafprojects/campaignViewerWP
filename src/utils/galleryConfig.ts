import type {
  BreakpointGalleryConfig,
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfig,
  GalleryConfigBreakpoint,
  GalleryConfigScope,
  GalleryScopeConfig,
} from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { AdapterSettingFieldDefinition } from '@/components/Galleries/Adapters/GalleryAdapter';
import {
  getAdapterRegistration,
  getRegisteredAdapters,
  getSettingGroupDefinition,
} from '@/components/Galleries/Adapters/adapterRegistry';
import { parseGalleryConfigInput } from '@/types/settingsSchemas';

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
  gallerySectionMaxWidthUnit: 'sectionMaxWidthUnit',
  gallerySectionMaxHeight: 'sectionMaxHeight',
  gallerySectionMaxHeightUnit: 'sectionMaxHeightUnit',
  gallerySectionMinWidth: 'sectionMinWidth',
  gallerySectionMinWidthUnit: 'sectionMinWidthUnit',
  gallerySectionMinHeight: 'sectionMinHeight',
  gallerySectionMinHeightUnit: 'sectionMinHeightUnit',
  gallerySectionHeightMode: 'sectionHeightMode',
  gallerySectionPadding: 'sectionPadding',
  gallerySectionPaddingUnit: 'sectionPaddingUnit',
  adapterContentPadding: 'adapterContentPadding',
  adapterContentPaddingUnit: 'adapterContentPaddingUnit',
  adapterSizingMode: 'adapterSizingMode',
  adapterMaxWidthPct: 'adapterMaxWidthPct',
  adapterMaxHeightPct: 'adapterMaxHeightPct',
  adapterItemGap: 'adapterItemGap',
  adapterItemGapUnit: 'adapterItemGapUnit',
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

const LEGACY_ADAPTER_SETTING_KEYS = Array.from(
  new Set(
    getRegisteredAdapters().flatMap((adapter) => (
      adapter.settingGroups.flatMap((group) => (
        getSettingGroupDefinition(group)?.fields.flatMap((field) => {
          const keys: Array<keyof GalleryBehaviorSettings> = [field.key];
          if (field.control === 'dimension') keys.push(field.unitKey);
          return keys;
        }) ?? []
      ))
    )),
  ),
) as Array<keyof GalleryBehaviorSettings>;

export const LEGACY_GALLERY_SETTING_KEYS: Array<keyof GalleryBehaviorSettings> = Array.from(
  new Set<keyof GalleryBehaviorSettings>([
    ...(Object.keys(LEGACY_COMMON_SETTING_FIELD_MAP) as Array<keyof GalleryBehaviorSettings>),
    ...(Object.keys(LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP) as Array<keyof GalleryBehaviorSettings>),
    ...LEGACY_ADAPTER_SETTING_KEYS,
  ]),
);

type RepresentativeGalleryCommonSettingKey = Exclude<
  keyof GalleryCommonSettings,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;

type ScopeSpecificGalleryCommonSettingKey = Extract<
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

function getDefaultGalleryConfig(): GalleryConfig {
  return cloneGalleryConfig(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig)
    ?? { mode: 'per-type', breakpoints: {} };
}

export function resolveGalleryConfig(
  settings: Pick<GalleryBehaviorSettings, keyof GalleryBehaviorSettings>,
): GalleryConfig {
  const baseConfig = getDefaultGalleryConfig();
  return settings.galleryConfig ? mergeGalleryConfig(baseConfig, settings.galleryConfig) : baseConfig;
}

export function getGalleryConfigScopeAdapterIds(
  config: GalleryConfig,
  scope: Extract<GalleryConfigScope, 'unified' | 'image' | 'video'>,
): string[] {
  return GALLERY_BREAKPOINTS
    .map((breakpoint) => config.breakpoints?.[breakpoint]?.[scope]?.adapterId)
    .filter((adapterId): adapterId is string => typeof adapterId === 'string' && adapterId.length > 0);
}

export function getActiveGalleryConfigAdapterIds(config: GalleryConfig): string[] {
  if (config.mode === 'unified') {
    return getGalleryConfigScopeAdapterIds(config, 'unified');
  }

  return [
    ...getGalleryConfigScopeAdapterIds(config, 'image'),
    ...getGalleryConfigScopeAdapterIds(config, 'video'),
  ];
}

export function setRepresentativeGalleryCommonSetting<K extends RepresentativeGalleryCommonSettingKey>(
  config: GalleryConfig,
  key: K,
  value: GalleryCommonSettings[K],
): GalleryConfig {
  const nextConfig = cloneGalleryConfig(config) ?? { mode: 'per-type', breakpoints: {} };
  syncSharedCommonSettingAcrossScopes(nextConfig, key, value);
  return nextConfig;
}

export function setScopeGalleryCommonSetting<K extends ScopeSpecificGalleryCommonSettingKey>(
  config: GalleryConfig,
  scope: GalleryConfigScope,
  key: K,
  value: GalleryCommonSettings[K],
): GalleryConfig {
  const nextConfig = cloneGalleryConfig(config) ?? { mode: 'per-type', breakpoints: {} };
  syncScopedCommonSettingAcrossBreakpoints(nextConfig, scope, key, value);
  return nextConfig;
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

export function syncLegacyGallerySettingToConfig<K extends keyof GalleryBehaviorSettings>(
  config: GalleryConfig | undefined,
  key: K,
  value: GalleryBehaviorSettings[K],
): GalleryConfig | undefined {
  const commonKey = LEGACY_COMMON_SETTING_FIELD_MAP[key as keyof typeof LEGACY_COMMON_SETTING_FIELD_MAP];
  const scopedCommonKey = LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP[key as keyof typeof LEGACY_SCOPED_COMMON_SETTING_FIELD_MAP];
  const nextConfig = cloneGalleryConfig(config) ?? getDefaultGalleryConfig();

  if (!commonKey && !scopedCommonKey) {
    let usesAdapterSetting = false;
    for (const breakpoint of GALLERY_BREAKPOINTS) {
      for (const scope of GALLERY_SCOPES) {
        const adapterId = nextConfig.breakpoints?.[breakpoint]?.[scope]?.adapterId;
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

export function parseGalleryConfig(input: unknown): GalleryConfig | undefined {
  return parseGalleryConfigInput(input);
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