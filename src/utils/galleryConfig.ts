/**
 * Gallery-config **pure transforms** (P70-D boundary).
 *
 * The canonical, editor-free home for gallery-config scope/breakpoint logic:
 * shared constants (`GALLERY_BREAKPOINTS`), the legacy viewport-background field
 * map, config cloning and resolution. Editor-only helpers (settings-UI table
 * builders, field collectors) live in
 * `@/components/Common/galleryConfigUtils`, which imports from here — the
 * dependency only ever points that direction.
 */
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

function getRegisteredAdaptersSafe() {
  return typeof getRegisteredAdapters === 'function' ? getRegisteredAdapters() : [];
}

const LEGACY_ADAPTER_SETTING_KEYS = Array.from(
  new Set(
    getRegisteredAdaptersSafe().flatMap((adapter) => (
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

    return definition.fields.some((field) => (
      (field.key === key || ('unitKey' in field && field.unitKey === key)) &&
      isAdapterSettingFieldApplicableToScope(field, scope)
    ));
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

  const result: BreakpointGalleryConfig = {};
  const unified = cloneScopeConfig(config.unified);
  const image = cloneScopeConfig(config.image);
  const video = cloneScopeConfig(config.video);
  if (unified !== undefined) result.unified = unified;
  if (image !== undefined) result.image = image;
  if (video !== undefined) result.video = video;
  return result;
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
  // Structural-sharing update: only clone breakpoint and scope objects that actually
  // change. Untouched branches keep their original references, avoiding unnecessary
  // object allocation on every settings edit.
  let configChanged = false;
  const newBreakpoints: Partial<Record<GalleryConfigBreakpoint, BreakpointGalleryConfig>> = {};

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const bpConfig = config.breakpoints?.[breakpoint];
    let bpChanged = false;
    const newBp: BreakpointGalleryConfig = bpConfig ? { ...bpConfig } : {};

    for (const scope of GALLERY_SCOPES) {
      const scopeConfig = bpConfig?.[scope];
      // Skip when value is already correct — preserves reference identity.
      if (scopeConfig !== undefined && scopeConfig.common?.[key] === value) continue;

      newBp[scope] = {
        ...scopeConfig,
        common: { ...scopeConfig?.common, [key]: value },
      };
      bpChanged = true;
    }

    if (bpChanged) {
      newBreakpoints[breakpoint] = newBp;
      configChanged = true;
    } else if (bpConfig !== undefined) {
      newBreakpoints[breakpoint] = bpConfig; // unchanged — keep original reference
    }
  }

  if (!configChanged) return config;
  return { ...config, breakpoints: newBreakpoints };
}

export function setScopeGalleryCommonSetting<K extends ScopeSpecificGalleryCommonSettingKey>(
  config: GalleryConfig,
  scope: GalleryConfigScope,
  key: K,
  value: GalleryCommonSettings[K],
): GalleryConfig {
  // Structural-sharing update: only clone breakpoints where the scoped common
  // setting actually changes.
  let configChanged = false;
  const newBreakpoints: Partial<Record<GalleryConfigBreakpoint, BreakpointGalleryConfig>> = {};

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const bpConfig = config.breakpoints?.[breakpoint];
    const scopeConfig = bpConfig?.[scope];

    // Skip when value is already correct — preserves reference identity.
    if (scopeConfig !== undefined && scopeConfig.common?.[key] === value) {
      if (bpConfig !== undefined) newBreakpoints[breakpoint] = bpConfig;
      continue;
    }

    newBreakpoints[breakpoint] = {
      ...bpConfig,
      [scope]: {
        ...scopeConfig,
        common: { ...scopeConfig?.common, [key]: value },
      },
    };
    configChanged = true;
  }

  if (!configChanged) return config;
  return { ...config, breakpoints: newBreakpoints };
}

export function setGalleryAdapterSetting<K extends keyof GalleryBehaviorSettings>(
  config: GalleryConfig | undefined,
  key: K,
  value: GalleryBehaviorSettings[K],
): GalleryConfig {
  // Structural-sharing update: only clone scope and breakpoint objects that need
  // to change. Scopes that don't use this adapter setting key keep their original
  // references, avoiding full-tree allocation on every adapter-setting edit.
  const base = config ?? getDefaultGalleryConfig();
  let configChanged = false;
  const newBreakpoints: Partial<Record<GalleryConfigBreakpoint, BreakpointGalleryConfig>> = {};

  for (const breakpoint of GALLERY_BREAKPOINTS) {
    const bpConfig = base.breakpoints?.[breakpoint];
    let bpChanged = false;
    const newBp: BreakpointGalleryConfig = bpConfig ? { ...bpConfig } : {};

    for (const scope of GALLERY_SCOPES) {
      const scopeConfig = bpConfig?.[scope];
      if (!scopeUsesAdapterSettingKey(scopeConfig?.adapterId, scope, key)) {
        continue; // key not used by this scope's adapter — preserve reference unchanged
      }
      // Skip when the stored value is already equal — preserves reference identity.
      if (scopeConfig?.adapterSettings?.[key] === value) {
        continue;
      }

      newBp[scope] = {
        ...scopeConfig,
        adapterSettings: { ...scopeConfig?.adapterSettings, [key]: value },
      };
      bpChanged = true;
    }

    if (bpChanged) {
      newBreakpoints[breakpoint] = newBp;
      configChanged = true;
    } else if (bpConfig !== undefined) {
      newBreakpoints[breakpoint] = bpConfig; // unchanged — keep original reference
    }
  }

  if (!configChanged) return base;
  return { ...base, breakpoints: newBreakpoints };
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

export function parseGalleryConfig(input: unknown): GalleryConfig | undefined {
  return parseGalleryConfigInput(input) as GalleryConfig | undefined;
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
    } as GalleryCommonSettings,
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