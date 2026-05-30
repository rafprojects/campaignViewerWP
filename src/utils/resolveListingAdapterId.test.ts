/**
 * P35-B: Tests for resolveListingAdapterId
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings } from '@/types';
import { resolveListingAdapterId } from './resolveListingAdapterId';

function makeSettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, ...overrides };
}

describe('resolveListingAdapterId', () => {
  it('returns compact-grid when no settings are configured (hard fallback)', () => {
    const s = makeSettings();
    expect(resolveListingAdapterId(s, 'desktop')).toBe('compact-grid');
    expect(resolveListingAdapterId(s, 'tablet')).toBe('compact-grid');
    expect(resolveListingAdapterId(s, 'mobile')).toBe('compact-grid');
  });

  it('returns the base id at desktop when only campaignListingAdapterId is set', () => {
    const s = makeSettings({ campaignListingAdapterId: 'masonry' });
    expect(resolveListingAdapterId(s, 'desktop')).toBe('masonry');
  });

  it('falls through to base id at tablet/mobile when no per-breakpoint override is set', () => {
    const s = makeSettings({ campaignListingAdapterId: 'justified' });
    expect(resolveListingAdapterId(s, 'tablet')).toBe('justified');
    expect(resolveListingAdapterId(s, 'mobile')).toBe('justified');
  });

  it('applies mobile override at mobile breakpoint', () => {
    const s = makeSettings({
      campaignListingAdapterId: 'masonry',
      campaignListingAdapterIdMobile: 'compact-grid',
    });
    expect(resolveListingAdapterId(s, 'mobile')).toBe('compact-grid');
    expect(resolveListingAdapterId(s, 'tablet')).toBe('masonry'); // no tablet override
    expect(resolveListingAdapterId(s, 'desktop')).toBe('masonry');
  });

  it('applies tablet override at tablet breakpoint', () => {
    const s = makeSettings({
      campaignListingAdapterId: 'justified',
      campaignListingAdapterIdTablet: 'masonry',
    });
    expect(resolveListingAdapterId(s, 'tablet')).toBe('masonry');
    expect(resolveListingAdapterId(s, 'mobile')).toBe('justified'); // no mobile override
    expect(resolveListingAdapterId(s, 'desktop')).toBe('justified');
  });

  it('applies both mobile and tablet overrides independently', () => {
    const s = makeSettings({
      campaignListingAdapterId: 'compact-grid',
      campaignListingAdapterIdTablet: 'masonry',
      campaignListingAdapterIdMobile: 'justified',
    });
    expect(resolveListingAdapterId(s, 'desktop')).toBe('compact-grid');
    expect(resolveListingAdapterId(s, 'tablet')).toBe('masonry');
    expect(resolveListingAdapterId(s, 'mobile')).toBe('justified');
  });

  it('normalizes legacy aliases', () => {
    // 'carousel' is an alias for 'classic'
    const s = makeSettings({ campaignListingAdapterId: 'carousel' });
    expect(resolveListingAdapterId(s, 'desktop')).toBe('classic');
  });

  it('normalizes unknown ids to themselves (registry pass-through)', () => {
    // normalizeAdapterId returns the id unchanged when not in the registry
    const s = makeSettings({ campaignListingAdapterId: 'non-existent-adapter' });
    expect(resolveListingAdapterId(s, 'desktop')).toBe('non-existent-adapter');
  });

  it('treats PHP-sourced empty-string override as "no override" (regression: ?? vs ||)', () => {
    // PHP always sends campaignListingAdapterIdMobile/Tablet as '' when the user
    // has not set a per-breakpoint override.  The resolver must treat '' as absent
    // and fall through to campaignListingAdapterId, not pass '' to normalizeAdapterId
    // which would return 'classic' (carousel).
    const s = makeSettings({
      campaignListingAdapterId: 'masonry',
      campaignListingAdapterIdMobile: '',
      campaignListingAdapterIdTablet: '',
    });
    expect(resolveListingAdapterId(s, 'mobile')).toBe('masonry');
    expect(resolveListingAdapterId(s, 'tablet')).toBe('masonry');
    expect(resolveListingAdapterId(s, 'desktop')).toBe('masonry');
  });

  it('desktop breakpoint is never affected by mobile or tablet overrides', () => {
    const s = makeSettings({
      campaignListingAdapterId: 'compact-grid',
      campaignListingAdapterIdMobile: 'masonry',
      campaignListingAdapterIdTablet: 'justified',
    });
    expect(resolveListingAdapterId(s, 'desktop')).toBe('compact-grid');
  });
});
