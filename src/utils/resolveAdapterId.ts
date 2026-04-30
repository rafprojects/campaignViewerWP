import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfig,
  GalleryConfigScope,
  ResolvedGallerySectionRuntime,
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
  sectionMaxWidthUnit: 'gallerySectionMaxWidthUnit',
  sectionMaxHeight: 'gallerySectionMaxHeight',
  sectionMaxHeightUnit: 'gallerySectionMaxHeightUnit',
  sectionMinWidth: 'gallerySectionMinWidth',
  sectionMinWidthUnit: 'gallerySectionMinWidthUnit',
  sectionMinHeight: 'gallerySectionMinHeight',
  sectionMinHeightUnit: 'gallerySectionMinHeightUnit',
  sectionHeightMode: 'gallerySectionHeightMode',
  sectionPadding: 'gallerySectionPadding',
  sectionPaddingUnit: 'gallerySectionPaddingUnit',
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
  return resolveEffectiveGalleryConfig(s, galleryOverrides).mode ?? 'per-type';
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
  const resolvedSettings: GalleryCommonSettings = {};

  for (const [commonKey, settingKey] of Object.entries(COMMON_SETTING_FIELD_MAP) as Array<
    [SharedCommonSettingKey, keyof GalleryBehaviorSettings]
  >) {
    const value = s[settingKey];
    if (value !== undefined) {
      (resolvedSettings as Record<string, unknown>)[commonKey] = value;
    }
  }

  const viewportFieldMap = getLegacyViewportBackgroundFieldMap(scope);
  for (const [commonKey, settingKey] of Object.entries(viewportFieldMap) as Array<
    [ScopeSpecificCommonSettingKey, keyof GalleryBehaviorSettings]
  >) {
    const value = s[settingKey];
    if (value !== undefined) {
      (resolvedSettings as Record<string, unknown>)[commonKey] = value;
    }
  }

  return {
    ...resolvedSettings,
    ...(resolveScopeConfig(effectiveConfig, breakpoint, scope)?.common ?? {}),
  };
}

export function resolveGallerySectionRuntime(
  s: GalleryBehaviorSettings,
  breakpoint: Breakpoint,
  scope: GalleryConfigScope,
  galleryOverrides?: Partial<GalleryConfig>,
): ResolvedGallerySectionRuntime {
  const effectiveConfig = resolveEffectiveGalleryConfig(s, galleryOverrides);
  const scopeConfig = resolveScopeConfig(effectiveConfig, breakpoint, scope);
  const common = resolveGalleryCommonSettings(s, breakpoint, scope, galleryOverrides);

  return {
    breakpoint,
    scope,
    common,
    background: {
      type: common.viewportBgType ?? 'none',
      color: common.viewportBgColor ?? '',
      gradient: common.viewportBgGradient ?? '',
      imageUrl: common.viewportBgImageUrl ?? '',
    },
    adapterSettings: { ...(scopeConfig?.adapterSettings ?? {}) },
  };
}

export function applyResolvedGalleryAdapterSettings(
  s: GalleryBehaviorSettings,
  runtime: Pick<ResolvedGallerySectionRuntime, 'adapterSettings'>,
): GalleryBehaviorSettings {
  const resolvedSettings = { ...s };
  const resolvedSettingsRecord = resolvedSettings as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(runtime.adapterSettings ?? {})) {
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
 * Resolves the adapter for one media scope directly from nested galleryConfig.
 */
export function resolveAdapterId(
  s: GalleryBehaviorSettings,
  mediaType: 'image' | 'video',
  breakpoint: Breakpoint,
  options: GalleryResolutionOptions = {},
): string {
  const globalConfig = resolveBaseGalleryConfig(s);

  return resolveSupportedAdapterChain(
    [
      resolveOverrideScopeConfig(options.galleryOverrides, breakpoint, mediaType)?.adapterId,
      resolveScopeConfig(globalConfig, breakpoint, mediaType)?.adapterId,
      getRepresentativeScopeAdapterId(globalConfig, mediaType),
    ],
    breakpoint,
  );
}
