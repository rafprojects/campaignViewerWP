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
  mergeGalleryConfig,
} from './galleryConfig';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS as DEFAULT_SETTINGS } from '@/types';

type GalleryMode = 'unified' | 'per-type';

interface GalleryResolutionOptions {
  galleryOverrides?: Partial<GalleryConfig> | undefined;
}

const BLOCKED_ADAPTER_SETTING_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

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
  const defaultConfig = DEFAULT_SETTINGS.galleryConfig ?? { mode: 'per-type', breakpoints: {} };
  return s.galleryConfig ? mergeGalleryConfig(defaultConfig, s.galleryConfig) : defaultConfig;
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
  return {
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
