import type { Breakpoint } from '@/hooks/useBreakpoint';
import type { GalleryBehaviorSettings, GalleryConfigBreakpoint } from '@/types';

export type GalleryMediaScope = 'image' | 'video';

export const LEGACY_FLAT_SCOPE_KEYS = {
  image: 'imageGalleryAdapterId',
  video: 'videoGalleryAdapterId',
} as const satisfies Record<GalleryMediaScope, keyof GalleryBehaviorSettings>;

export const LEGACY_BREAKPOINT_SCOPE_KEYS = {
  image: {
    desktop: 'desktopImageAdapterId',
    tablet: 'tabletImageAdapterId',
    mobile: 'mobileImageAdapterId',
  },
  video: {
    desktop: 'desktopVideoAdapterId',
    tablet: 'tabletVideoAdapterId',
    mobile: 'mobileVideoAdapterId',
  },
} as const satisfies Record<GalleryMediaScope, Record<GalleryConfigBreakpoint, keyof GalleryBehaviorSettings>>;

type LegacyPerTypeAdapterSettings = Pick<
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
>;

type LegacyActiveAdapterSettings = LegacyPerTypeAdapterSettings & Pick<
  GalleryBehaviorSettings,
  | 'unifiedGalleryEnabled'
  | 'unifiedGalleryAdapterId'
>;

export function getLegacyFlatAdapterId(
  settings: Pick<GalleryBehaviorSettings, 'imageGalleryAdapterId' | 'videoGalleryAdapterId'>,
  scope: GalleryMediaScope,
): string {
  return settings[LEGACY_FLAT_SCOPE_KEYS[scope]];
}

export function getLegacyPerTypeAdapterId(
  settings: LegacyPerTypeAdapterSettings,
  breakpoint: Breakpoint | GalleryConfigBreakpoint,
  scope: GalleryMediaScope,
): string {
  if (settings.gallerySelectionMode !== 'per-breakpoint') {
    return getLegacyFlatAdapterId(settings, scope);
  }

  const perBreakpointId = settings[LEGACY_BREAKPOINT_SCOPE_KEYS[scope][breakpoint as GalleryConfigBreakpoint]];
  return perBreakpointId || getLegacyFlatAdapterId(settings, scope);
}

export function getLegacyScopeAdapterIds(
  settings: LegacyActiveAdapterSettings,
  scope: GalleryMediaScope,
): string[] {
  if (settings.unifiedGalleryEnabled) {
    return [settings.unifiedGalleryAdapterId];
  }

  if (settings.gallerySelectionMode === 'per-breakpoint') {
    return [
      settings[LEGACY_BREAKPOINT_SCOPE_KEYS[scope].desktop],
      settings[LEGACY_BREAKPOINT_SCOPE_KEYS[scope].tablet],
      settings[LEGACY_BREAKPOINT_SCOPE_KEYS[scope].mobile],
    ];
  }

  return [getLegacyFlatAdapterId(settings, scope)];
}

export function getLegacyActiveAdapterIds(settings: LegacyActiveAdapterSettings): string[] {
  if (settings.unifiedGalleryEnabled) {
    return [settings.unifiedGalleryAdapterId];
  }

  return [
    ...getLegacyScopeAdapterIds(settings, 'image'),
    ...getLegacyScopeAdapterIds(settings, 'video'),
  ];
}