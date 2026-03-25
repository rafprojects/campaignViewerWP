import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYOUT_SLOT,
  DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  type GalleryBehaviorSettings,
  type GalleryConfig,
  type LayoutSlot,
} from '@/types';
import { mergeSettingsWithDefaults } from './mergeSettingsWithDefaults';

// ═══════════════════════════════════════════════════════════════
// DEFAULT_LAYOUT_SLOT
// ═══════════════════════════════════════════════════════════════

describe('DEFAULT_LAYOUT_SLOT', () => {
  it('has all required LayoutSlot fields', () => {
    const requiredKeys: (keyof LayoutSlot)[] = [
      'id', 'x', 'y', 'width', 'height', 'zIndex',
      'shape', 'borderRadius', 'borderWidth', 'borderColor',
      'objectFit', 'objectPosition', 'clickAction', 'hoverEffect',
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_LAYOUT_SLOT).toHaveProperty(key);
    }
  });

  it('positions at origin with 25×25 default size', () => {
    expect(DEFAULT_LAYOUT_SLOT.x).toBe(0);
    expect(DEFAULT_LAYOUT_SLOT.y).toBe(0);
    expect(DEFAULT_LAYOUT_SLOT.width).toBe(25);
    expect(DEFAULT_LAYOUT_SLOT.height).toBe(25);
  });

  it('uses rectangle shape with cover fit', () => {
    expect(DEFAULT_LAYOUT_SLOT.shape).toBe('rectangle');
    expect(DEFAULT_LAYOUT_SLOT.objectFit).toBe('cover');
  });

  it('has centered object position', () => {
    expect(DEFAULT_LAYOUT_SLOT.objectPosition).toBe('50% 50%');
  });

  it('defaults to lightbox click and pop hover', () => {
    expect(DEFAULT_LAYOUT_SLOT.clickAction).toBe('lightbox');
    expect(DEFAULT_LAYOUT_SLOT.hoverEffect).toBe('pop');
  });
});

// ═══════════════════════════════════════════════════════════════
// DEFAULT_GALLERY_BEHAVIOR_SETTINGS – Phase 15 fields
// ═══════════════════════════════════════════════════════════════

describe('DEFAULT_GALLERY_BEHAVIOR_SETTINGS – P15 fields', () => {
  it('defaults gallerySelectionMode to unified', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gallerySelectionMode).toBe('unified');
  });

  it('defaults all per-breakpoint adapters to classic', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.desktopImageAdapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.desktopVideoAdapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tabletImageAdapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.tabletVideoAdapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.mobileImageAdapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.mobileVideoAdapterId).toBe('classic');
  });

  it('defaults layoutBuilderScope to full', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.layoutBuilderScope).toBe('full');
  });

  it('hydrates default nested galleryConfig compatibility data', () => {
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.mode).toBe('per-type');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.galleryConfig?.breakpoints?.desktop?.unified?.adapterId).toBe('compact-grid');
  });

  it('is a valid GalleryBehaviorSettings (satisfies type contract)', () => {
    // This is a compile-time guarantee, but let's also verify at runtime
    // that no key is undefined.
    const keys = Object.keys(DEFAULT_GALLERY_BEHAVIOR_SETTINGS) as Array<
      keyof GalleryBehaviorSettings
    >;
    for (const key of keys) {
      expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS[key]).not.toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// mergeSettingsWithDefaults
// ═══════════════════════════════════════════════════════════════

describe('mergeSettingsWithDefaults', () => {
  it('returns full defaults when partial is empty', () => {
    const merged = mergeSettingsWithDefaults({});
    expect(merged).toEqual(DEFAULT_GALLERY_BEHAVIOR_SETTINGS);
  });

  it('overrides specified fields from partial', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
    });
    expect(merged.gallerySelectionMode).toBe('per-breakpoint');
    expect(merged.desktopImageAdapterId).toBe('masonry');
    // Unrelated field still has default
    expect(merged.imageGalleryAdapterId).toBe('classic');
  });

  it('preserves falsy value 0 (does not replace with default)', () => {
    const merged = mergeSettingsWithDefaults({
      imageBorderRadius: 0, // default is 8
    });
    expect(merged.imageBorderRadius).toBe(0);
  });

  it('preserves falsy value false (does not replace with default)', () => {
    const merged = mergeSettingsWithDefaults({
      transitionFadeEnabled: false, // default is true
    });
    expect(merged.transitionFadeEnabled).toBe(false);
  });

  it('preserves empty string (does not replace with default)', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySubtitleText: '', // default is ''
    });
    expect(merged.gallerySubtitleText).toBe('');
  });

  it('replaces null with default', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySelectionMode: null as unknown as 'unified',
    });
    expect(merged.gallerySelectionMode).toBe('unified');
  });

  it('replaces undefined with default', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySelectionMode: undefined,
    });
    expect(merged.gallerySelectionMode).toBe('unified');
  });

  it('does not mutate the default object', () => {
    const originalMode = DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gallerySelectionMode;
    mergeSettingsWithDefaults({ gallerySelectionMode: 'per-breakpoint' });
    expect(DEFAULT_GALLERY_BEHAVIOR_SETTINGS.gallerySelectionMode).toBe(originalMode);
  });

  it('ignores keys not in the defaults (extra API fields)', () => {
    const merged = mergeSettingsWithDefaults({
      unknownField: 'should-be-ignored',
    } as Record<string, unknown>);
    expect(merged).not.toHaveProperty('unknownField');
  });

  it('produces a fresh object each call', () => {
    const a = mergeSettingsWithDefaults({});
    const b = mergeSettingsWithDefaults({});
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('handles all P15 fields correctly in one merge', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'justified',
      desktopVideoAdapterId: 'masonry',
      tabletImageAdapterId: 'hexagonal',
      tabletVideoAdapterId: 'compact-grid',
      mobileImageAdapterId: 'circular',
      mobileVideoAdapterId: 'diamond',
      layoutBuilderScope: 'viewport',
    });

    expect(merged.gallerySelectionMode).toBe('per-breakpoint');
    expect(merged.desktopImageAdapterId).toBe('justified');
    expect(merged.desktopVideoAdapterId).toBe('masonry');
    expect(merged.tabletImageAdapterId).toBe('hexagonal');
    expect(merged.tabletVideoAdapterId).toBe('compact-grid');
    expect(merged.mobileImageAdapterId).toBe('circular');
    expect(merged.mobileVideoAdapterId).toBe('diamond');
    expect(merged.layoutBuilderScope).toBe('viewport');
  });

  it('derives nested galleryConfig from legacy flat settings', () => {
    const merged = mergeSettingsWithDefaults({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
      tabletImageAdapterId: 'justified',
      mobileImageAdapterId: 'compact-grid',
      gallerySectionPadding: 24,
    });

    expect(merged.galleryConfig?.mode).toBe('per-type');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    expect(merged.galleryConfig?.breakpoints?.tablet?.image?.adapterId).toBe('justified');
    expect(merged.galleryConfig?.breakpoints?.mobile?.image?.adapterId).toBe('compact-grid');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.common?.sectionPadding).toBe(24);
  });

  it('merges explicit nested galleryConfig over the legacy-derived bridge', () => {
    const nested: GalleryConfig = {
      mode: 'unified',
      breakpoints: {
        desktop: {
          image: {
            adapterId: 'diamond',
          },
        },
      },
    };

    const merged = mergeSettingsWithDefaults({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
      galleryConfig: nested,
    });

    expect(merged.galleryConfig?.mode).toBe('unified');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('diamond');
    expect(merged.galleryConfig?.breakpoints?.tablet?.image?.adapterId).toBe('classic');
  });

  it('parses galleryConfig when it arrives as JSON', () => {
    const merged = mergeSettingsWithDefaults({
      galleryConfig: JSON.stringify({
        mode: 'unified',
        breakpoints: {
          mobile: {
            unified: {
              adapterId: 'masonry',
            },
          },
        },
      }),
    } as Record<string, unknown>);

    expect(merged.galleryConfig?.mode).toBe('unified');
    expect(merged.galleryConfig?.breakpoints?.mobile?.unified?.adapterId).toBe('masonry');
    expect(merged.galleryConfig?.breakpoints?.desktop?.image?.adapterId).toBe('classic');
  });
});
