import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfig,
  GalleryConfigScope,
} from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { isAdapterSupportedAtBreakpoint, normalizeAdapterId } from '@/components/Galleries/Adapters/adapterRegistry';
import {
  getRepresentativeScopeAdapterId,
  getLegacyViewportBackgroundFieldMap,
  mergeGalleryConfig,
} from './galleryConfig';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS as DEFAULT_SETTINGS } from '@/types';

type GalleryMode = 'unified' | 'per-type';

interface GalleryResolutionOptions {
  galleryOverrides?: Partial<GalleryConfig>;
  legacyOverrideId?: string;
}

type CommonSettingKey = keyof GalleryCommonSettings;
type ScopeSpecificCommonSettingKey = Extract<
  CommonSettingKey,
  'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl'
>;
type SharedCommonSettingKey = Exclude<CommonSettingKey, ScopeSpecificCommonSettingKey>;

const BLOCKED_ADAPTER_SETTING_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const COMMON_SETTING_FIELD_MAP: Record<SharedCommonSettingKey, keyof GalleryBehaviorSettings> = {
  sectionMaxWidth: 'gallerySectionMaxWidth',
  sectionMaxHeight: 'gallerySectionMaxHeight',
  sectionMinWidth: 'gallerySectionMinWidth',
  sectionMinHeight: 'gallerySectionMinHeight',
  sectionHeightMode: 'gallerySectionHeightMode',
  sectionPadding: 'gallerySectionPadding',
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
};

function resolveSupportedAdapterChain(ids: Array<string | undefined>, breakpoint: Breakpoint): string {
  for (const id of ids) {
    if (!id) {
      continue;
    }

    const normalizedId = normalizeAdapterId(id);
    if (isAdapterSupportedAtBreakpoint(normalizedId, breakpoint)) {
      return normalizedId;
    }
  }

  return 'classic';
}

function resolveBaseGalleryConfig(s: GalleryBehaviorSettings): GalleryConfig {
  return s.galleryConfig ?? DEFAULT_SETTINGS.galleryConfig ?? { mode: 'per-type', breakpoints: {} };
}

function resolveEffectiveGalleryConfig(
  s: GalleryBehaviorSettings,
  galleryOverrides?: Partial<GalleryConfig>,
): GalleryConfig {
  const base = resolveBaseGalleryConfig(s);
  return galleryOverrides ? mergeGalleryConfig(base, galleryOverrides) : base;
}

function resolveScopeConfig(
  config: GalleryConfig,
  breakpoint: Breakpoint,
  scope: GalleryConfigScope,
) {
  return config.breakpoints?.[breakpoint]?.[scope];
}

function resolveOverrideScopeConfig(
  galleryOverrides: Partial<GalleryConfig> | undefined,
  breakpoint: Breakpoint,
  scope: GalleryConfigScope,
) {
  return galleryOverrides?.breakpoints?.[breakpoint]?.[scope];
}

export function resolveGalleryMode(
  s: GalleryBehaviorSettings,
  galleryOverrides?: Partial<GalleryConfig>,
): GalleryMode {
  return resolveEffectiveGalleryConfig(s, galleryOverrides).mode ?? (s.unifiedGalleryEnabled ? 'unified' : 'per-type');
}

export function resolveUnifiedAdapterId(
  s: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
  options: GalleryResolutionOptions = {},
): string {
  const globalConfig = resolveBaseGalleryConfig(s);

  return resolveSupportedAdapterChain(
    [
      resolveOverrideScopeConfig(options.galleryOverrides, breakpoint, 'unified')?.adapterId,
      resolveScopeConfig(globalConfig, breakpoint, 'unified')?.adapterId,
      getRepresentativeScopeAdapterId(globalConfig, 'unified'),
    ],
    breakpoint,
  );
}

export function resolveGalleryCommonSettings(
  s: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
  scope: GalleryConfigScope,
  galleryOverrides?: Partial<GalleryConfig>,
): GalleryCommonSettings {
  const effectiveConfig = resolveEffectiveGalleryConfig(s, galleryOverrides);

  return resolveScopeConfig(effectiveConfig, breakpoint, scope)?.common ?? {};
}

export function applyResolvedGalleryCommonSettings(
  s: GalleryBehaviorSettings,
  commonSettings: GalleryCommonSettings,
  scope: GalleryConfigScope,
): GalleryBehaviorSettings {
  const resolvedSettings = { ...s };

  for (const [commonKey, settingKey] of Object.entries(COMMON_SETTING_FIELD_MAP) as Array<
    [SharedCommonSettingKey, keyof GalleryBehaviorSettings]
  >) {
    const value = commonSettings[commonKey];
    if (value !== undefined) {
      (resolvedSettings as Record<string, unknown>)[settingKey] = value;
    }
  }

  const viewportFieldMap = getLegacyViewportBackgroundFieldMap(scope);
  for (const [commonKey, settingKey] of Object.entries(viewportFieldMap) as Array<
    [ScopeSpecificCommonSettingKey, keyof GalleryBehaviorSettings]
  >) {
    const value = commonSettings[commonKey];
    if (value !== undefined) {
      (resolvedSettings as Record<string, unknown>)[settingKey] = value;
    }
  }

  return resolvedSettings;
}

export function resolveEffectiveGallerySettings(
  s: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
  scope: GalleryConfigScope,
  galleryOverrides?: Partial<GalleryConfig>,
): GalleryBehaviorSettings {
  const resolvedCommonSettings = resolveGalleryCommonSettings(s, breakpoint, scope, galleryOverrides);
  const resolvedAdapterSettings = resolveEffectiveGalleryConfig(s, galleryOverrides).breakpoints?.[breakpoint]?.[scope]?.adapterSettings ?? {};
  const resolvedSettings = applyResolvedGalleryCommonSettings(s, resolvedCommonSettings, scope);
  const resolvedSettingsRecord = resolvedSettings as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(resolvedAdapterSettings)) {
    if (value === undefined || BLOCKED_ADAPTER_SETTING_KEYS.has(key)) {
      continue;
    }

    resolvedSettingsRecord[key] = value;
  }

  for (const blockedKey of BLOCKED_ADAPTER_SETTING_KEYS) {
    delete resolvedSettingsRecord[blockedKey];
  }

  return resolvedSettings;
}

/**
 * Resolve the adapter ID to use for a given media type and breakpoint.
 *
 * When `gallerySelectionMode` is `'per-breakpoint'`, selects from the 6
 * per-breakpoint adapter settings. Otherwise returns the unified setting.
 */
export function resolveAdapterId(
  s: GalleryBehaviorSettings,
  mediaType: 'image' | 'video',
  breakpoint: Breakpoint,
  options: GalleryResolutionOptions = {},
): string {
  const globalConfig = resolveBaseGalleryConfig(s);
  const legacyOverrideId = options.galleryOverrides ? undefined : options.legacyOverrideId;

  return resolveSupportedAdapterChain(
    [
      resolveOverrideScopeConfig(options.galleryOverrides, breakpoint, mediaType)?.adapterId,
      legacyOverrideId,
      resolveScopeConfig(globalConfig, breakpoint, mediaType)?.adapterId,
      getRepresentativeScopeAdapterId(globalConfig, mediaType),
    ],
    breakpoint,
  );
}
