import {
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
} from '@/types';

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

  for (const key of Object.keys(DEFAULT_GALLERY_BEHAVIOR_SETTINGS) as Array<
    keyof GalleryBehaviorSettings
  >) {
    const incoming = (partial as Record<string, unknown>)[key];
    if (incoming !== undefined && incoming !== null) {
      // P21-I: typography_overrides arrives as a JSON string from the PHP API.
      if (key === 'typographyOverrides' && typeof incoming === 'string') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (result as any)[key] = JSON.parse(incoming);
        } catch {
          // Invalid JSON — keep the default empty object.
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

  return result;
}
