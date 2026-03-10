import { describe, it, expect } from 'vitest';
import { resolveAdapterId } from './resolveAdapterId';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { GalleryBehaviorSettings } from '@/types';

/**
 * Build a settings object with targeted overrides on top of defaults.
 */
function makeSettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, ...overrides };
}

// ── Unified mode ─────────────────────────────────────────────

describe('resolveAdapterId – unified mode', () => {
  it('returns imageGalleryAdapterId for image type', () => {
    const s = makeSettings({ gallerySelectionMode: 'unified', imageGalleryAdapterId: 'justified' });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('justified');
  });

  it('returns videoGalleryAdapterId for video type', () => {
    const s = makeSettings({ gallerySelectionMode: 'unified', videoGalleryAdapterId: 'masonry' });
    expect(resolveAdapterId(s, 'video', 'desktop')).toBe('masonry');
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('masonry');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('masonry');
  });

  it('ignores per-breakpoint settings even if they are set', () => {
    const s = makeSettings({
      gallerySelectionMode: 'unified',
      imageGalleryAdapterId: 'classic',
      desktopImageAdapterId: 'masonry',
      tabletImageAdapterId: 'justified',
      mobileImageAdapterId: 'hexagonal',
    });
    // Should always return unified adapter regardless of breakpoint-specific settings
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('classic');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('classic');
  });
});

// ── Per-breakpoint mode ──────────────────────────────────────

describe('resolveAdapterId – per-breakpoint mode', () => {
  it('returns the correct image adapter for each breakpoint', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'masonry',
      tabletImageAdapterId: 'justified',
      mobileImageAdapterId: 'compact-grid',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('masonry');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('justified');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('compact-grid');
  });

  it('returns the correct video adapter for each breakpoint', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopVideoAdapterId: 'classic',
      tabletVideoAdapterId: 'hexagonal',
      mobileVideoAdapterId: 'masonry',
    });
    expect(resolveAdapterId(s, 'video', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('hexagonal');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('masonry');
  });

  it('falls back to unified imageGalleryAdapterId when per-breakpoint value is empty', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: '',
      imageGalleryAdapterId: 'justified',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('justified');
  });

  it('falls back to unified videoGalleryAdapterId when per-breakpoint value is empty', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      tabletVideoAdapterId: '',
      videoGalleryAdapterId: 'masonry',
    });
    expect(resolveAdapterId(s, 'video', 'tablet')).toBe('masonry');
  });

  it('uses per-breakpoint value when set, unified fallback only when falsy', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      imageGalleryAdapterId: 'fallback-adapter',
      desktopImageAdapterId: 'desktop-specific',
      tabletImageAdapterId: '',    // empty → falls back
      mobileImageAdapterId: 'mobile-specific',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('desktop-specific');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('fallback-adapter');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('mobile-specific');
  });
});

// ── Default settings behaviour ───────────────────────────────

describe('resolveAdapterId – with defaults', () => {
  it('defaults are unified mode returning classic for both types', () => {
    const s = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS };
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('classic');
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('classic');
  });
});

// ── Layout-builder mobile guard ──────────────────────────────

describe('resolveAdapterId – layout-builder mobile fallback', () => {
  it('falls back to unified image adapter when layout-builder is resolved on mobile', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      desktopImageAdapterId: 'layout-builder',
      tabletImageAdapterId: 'layout-builder',
      mobileImageAdapterId: 'layout-builder',
      imageGalleryAdapterId: 'masonry',
    });
    expect(resolveAdapterId(s, 'image', 'desktop')).toBe('layout-builder');
    expect(resolveAdapterId(s, 'image', 'tablet')).toBe('layout-builder');
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('masonry');
  });

  it('falls back to unified video adapter when layout-builder is resolved on mobile', () => {
    const s = makeSettings({
      gallerySelectionMode: 'per-breakpoint',
      mobileVideoAdapterId: 'layout-builder',
      videoGalleryAdapterId: 'justified',
    });
    expect(resolveAdapterId(s, 'video', 'mobile')).toBe('justified');
  });

  it('falls back to classic when unified adapter is also layout-builder on mobile', () => {
    const s = makeSettings({
      gallerySelectionMode: 'unified',
      imageGalleryAdapterId: 'layout-builder',
    });
    // Unified mode returns 'layout-builder', mobile guard kicks in,
    // fallback is also 'layout-builder' → returns 'classic'.
    expect(resolveAdapterId(s, 'image', 'mobile')).toBe('classic');
  });
});
