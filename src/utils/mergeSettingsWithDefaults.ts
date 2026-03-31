import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
} from '@/types';
import {
  buildGalleryConfigFromLegacySettings,
  collectLegacyGallerySettingValues,
  cloneGalleryConfig,
  LEGACY_GALLERY_SETTING_KEYS,
  mergeGalleryConfig,
  parseGalleryConfig,
} from './galleryConfig';

/**
 * Merge a partial settings response with the full defaults.
 *
 * Uses `??` semantics: only `null` and `undefined` values fall through to the
 * default — `0`, `false`, and `''` are preserved.
 *
 * This replaces the ~80-line manual `response.field ?? DEFAULT.field` blocks
 * that previously existed in both `App.tsx` and `SettingsPanel.tsx`.
 */
export function mergeSettingsWithDefaults(
  partial: Partial<GalleryBehaviorSettings> | Record<string, unknown>,
): GalleryBehaviorSettings {
  const result = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS };
  const partialRecord = partial as Record<string, unknown>;
  const incomingGalleryConfig = parseGalleryConfig(partialRecord.galleryConfig);
  const hasLegacyGalleryBridgeOverride = LEGACY_GALLERY_SETTING_KEYS.some((key) => partialRecord[key] !== undefined && partialRecord[key] !== null);

  for (const key of Object.keys(DEFAULT_GALLERY_BEHAVIOR_SETTINGS) as Array<
    keyof GalleryBehaviorSettings
  >) {
    if (key === 'galleryConfig') {
      continue;
    }

    const incoming = partialRecord[key];
    if (incoming !== undefined && incoming !== null) {
      // P21-I: typography_overrides arrives as a JSON string from the PHP API.
      if (key === 'typographyOverrides' && typeof incoming === 'string') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any)[key] = JSON.parse(incoming);
        } catch {
          // Invalid JSON — keep the default empty object.
          console.warn('[WPSG] Failed to parse typographyOverrides JSON:', incoming);
        }
        continue;
      }
      // P21-K: viewerBgGradient migrated from string to GradientOptions object.
      if (key === 'viewerBgGradient') {
        if (typeof incoming === 'string' || Array.isArray(incoming)) {
          // Old CSS string or PHP empty array — discard, use default.
          continue;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = incoming;
    }
  }

  if (!incomingGalleryConfig && !hasLegacyGalleryBridgeOverride) {
    result.galleryConfig = cloneGalleryConfig(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig);
    return result;
  }

  const legacyGalleryConfig = buildGalleryConfigFromLegacySettings(result);
  result.galleryConfig = incomingGalleryConfig
    ? mergeGalleryConfig(legacyGalleryConfig, incomingGalleryConfig)
    : cloneGalleryConfig(legacyGalleryConfig);

  const resolvedGalleryConfig = result.galleryConfig
    ?? cloneGalleryConfig(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig)
    ?? { mode: 'per-type', breakpoints: {} };
  result.galleryConfig = resolvedGalleryConfig;

  Object.assign(result, collectLegacyGallerySettingValues(resolvedGalleryConfig));

  return result;
}
