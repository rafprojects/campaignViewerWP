import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  GalleryConfig,
  GalleryConfigScope,
} from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { isAdapterSupportedAtBreakpoint, normalizeAdapterId } from '@/components/Galleries/Adapters/adapterRegistry';
import {
  buildGalleryCommonSettingsFromLegacy,
  buildGalleryConfigFromLegacySettings,
  getLegacyViewportBackgroundFieldMap,
  mergeGalleryConfig,
} from './galleryConfig';
import { getLegacyFlatAdapterId, getLegacyPerTypeAdapterId } from './galleryAdapterSelection';

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
  return s.galleryConfig ?? buildGalleryConfigFromLegacySettings(s);
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
  const effectiveConfig = resolveEffectiveGalleryConfig(s, options.galleryOverrides);

  return resolveSupportedAdapterChain(
    [
      options.galleryOverrides ? resolveScopeConfig(effectiveConfig, breakpoint, 'unified')?.adapterId : undefined,
      options.legacyOverrideId,
      resolveScopeConfig(globalConfig, breakpoint, 'unified')?.adapterId,
      s.unifiedGalleryAdapterId,
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
  const legacyCommon = buildGalleryCommonSettingsFromLegacy(s, scope);
  const effectiveConfig = resolveEffectiveGalleryConfig(s, galleryOverrides);

  return {
    ...legacyCommon,
    ...(resolveScopeConfig(effectiveConfig, breakpoint, scope)?.common ?? {}),
  };
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

  return Object.entries(resolvedAdapterSettings).reduce((resolvedSettings, [key, value]) => {
    if (value === undefined) {
      return resolvedSettings;
    }

    return {
      ...resolvedSettings,
      [key]: value,
    } as GalleryBehaviorSettings;
  }, applyResolvedGalleryCommonSettings(s, resolvedCommonSettings, scope));
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
  const legacyId = getLegacyPerTypeAdapterId(s, breakpoint, mediaType);

  return resolveSupportedAdapterChain(
    [
      options.galleryOverrides ? resolveScopeConfig(resolveEffectiveGalleryConfig(s, options.galleryOverrides), breakpoint, mediaType)?.adapterId : undefined,
      options.legacyOverrideId,
      resolveScopeConfig(globalConfig, breakpoint, mediaType)?.adapterId,
      legacyId,
      getLegacyFlatAdapterId(s, mediaType),
    ],
    breakpoint,
  );
}
