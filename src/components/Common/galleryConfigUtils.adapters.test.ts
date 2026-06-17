/**
 * Coverage for the adapter-setting-group helpers in galleryConfigUtils
 * (getRepresentativeAdapterSettingValue / shouldRenderAdapterSettingField /
 * setAdapterSettingForMatchingScopes), which depend on adapterUsesSettingGroup.
 */
import { describe, it, expect, vi } from 'vitest';

// Preserve the real registry (galleryConfig.ts needs getRegisteredAdapters) and
// override only adapterUsesSettingGroup: the adapter id 'g-adapter' uses any group.
vi.mock('@/components/Galleries/Adapters/adapterRegistry', async (orig) => {
  const actual = await orig<typeof import('@/components/Galleries/Adapters/adapterRegistry')>();
  return { ...actual, adapterUsesSettingGroup: (id: string) => id === 'g-adapter' };
});

import type { GalleryConfig } from '@/types';
import type {
  AdapterSettingGroupDefinition,
  AdapterSettingFieldDefinition,
} from '@/components/Galleries/Adapters/GalleryAdapter';
import {
  getRepresentativeAdapterSettingValue,
  shouldRenderAdapterSettingField,
  setAdapterSettingForMatchingScopes,
} from './galleryConfigUtils';

const field = (over: Partial<AdapterSettingFieldDefinition> = {}): AdapterSettingFieldDefinition =>
  ({ key: 'opacity', label: 'Opacity', control: 'number', ...over }) as AdapterSettingFieldDefinition;

const group = (
  fields: AdapterSettingFieldDefinition[],
  over: Partial<AdapterSettingGroupDefinition> = {},
): AdapterSettingGroupDefinition =>
  ({ group: 'tile-appearance', label: 'Tile', scopeMode: 'shared', fields, ...over }) as AdapterSettingGroupDefinition;

// A per-type config whose `image` scope uses the group-bearing adapter.
const cfgWith = (adapterSettings: Record<string, unknown>, adapterId = 'g-adapter'): GalleryConfig =>
  ({
    mode: 'per-type',
    breakpoints: { desktop: { image: { adapterId, adapterSettings } } },
  }) as GalleryConfig;

describe('getRepresentativeAdapterSettingValue', () => {
  it('returns a number for number/dimension controls', () => {
    const g = group([field({ key: 'opacity', control: 'number' })]);
    expect(getRepresentativeAdapterSettingValue(cfgWith({ opacity: 80 }), 'desktop', g, g.fields[0]!)).toBe(80);
    const gd = group([field({ key: 'w', control: 'dimension' })]);
    expect(getRepresentativeAdapterSettingValue(cfgWith({ w: 12 }), 'desktop', gd, gd.fields[0]!)).toBe(12);
  });

  it('returns a string for select/text/color and a boolean for boolean', () => {
    const gs = group([field({ key: 'mode', control: 'select' })]);
    expect(getRepresentativeAdapterSettingValue(cfgWith({ mode: 'fancy' }), 'desktop', gs, gs.fields[0]!)).toBe('fancy');
    const gb = group([field({ key: 'on', control: 'boolean' })]);
    expect(getRepresentativeAdapterSettingValue(cfgWith({ on: true }), 'desktop', gb, gb.fields[0]!)).toBe(true);
  });

  it('skips scopes whose adapter does not use the group, and returns undefined on a type mismatch', () => {
    const g = group([field({ key: 'opacity', control: 'number' })]);
    // adapter that does NOT use the group -> skipped -> undefined
    expect(getRepresentativeAdapterSettingValue(cfgWith({ opacity: 80 }, 'other'), 'desktop', g, g.fields[0]!)).toBeUndefined();
    // value present but wrong type (string for a number control) -> undefined
    expect(getRepresentativeAdapterSettingValue(cfgWith({ opacity: 'x' }), 'desktop', g, g.fields[0]!)).toBeUndefined();
  });

  it('honors a field appliesTo restriction', () => {
    const g = group([field({ key: 'opacity', control: 'number', appliesTo: 'video' })], { scopeMode: 'contextual' });
    // config only has an image scope, but the field applies to video -> no match
    expect(getRepresentativeAdapterSettingValue(cfgWith({ opacity: 80 }), 'desktop', g, g.fields[0]!)).toBeUndefined();
  });
});

describe('shouldRenderAdapterSettingField', () => {
  it('returns false when no configured scope uses the group', () => {
    const g = group([field({ key: 'opacity' })]);
    const cfg = cfgWith({ opacity: 1 }, 'other');
    expect(shouldRenderAdapterSettingField(cfg, 'desktop', g, g.fields[0]!)).toBe(false);
  });

  it('returns true for a visible field with no conditional controller', () => {
    const g = group([field({ key: 'opacity' })]);
    expect(shouldRenderAdapterSettingField(cfgWith({ opacity: 1 }), 'desktop', g, g.fields[0]!)).toBe(true);
  });

  it('returns true when the controller field is absent from the group', () => {
    // tileBorderColor is a known controlled field, but its controller (tileBorderWidth) is not in this group
    const g = group([field({ key: 'tileBorderColor', control: 'color' })]);
    expect(shouldRenderAdapterSettingField(cfgWith({ tileBorderColor: '#fff' }), 'desktop', g, g.fields[0]!)).toBe(true);
  });

  it('respects the controller predicate (tileBorderWidth > 0 reveals tileBorderColor)', () => {
    const controlled = field({ key: 'tileBorderColor', control: 'color' });
    const controller = field({ key: 'tileBorderWidth', control: 'number' });
    const g = group([controlled, controller]);
    expect(shouldRenderAdapterSettingField(cfgWith({ tileBorderColor: '#fff', tileBorderWidth: 2 }), 'desktop', g, controlled)).toBe(true);
    expect(shouldRenderAdapterSettingField(cfgWith({ tileBorderColor: '#fff', tileBorderWidth: 0 }), 'desktop', g, controlled)).toBe(false);
  });

  it('respects a boolean controller (tileGlowEnabled reveals tileGlowColor)', () => {
    const controlled = field({ key: 'tileGlowColor', control: 'color' });
    const controller = field({ key: 'tileGlowEnabled', control: 'boolean' });
    const g = group([controlled, controller]);
    expect(shouldRenderAdapterSettingField(cfgWith({ tileGlowColor: '#0ff', tileGlowEnabled: true }), 'desktop', g, controlled)).toBe(true);
    expect(shouldRenderAdapterSettingField(cfgWith({ tileGlowColor: '#0ff', tileGlowEnabled: false }), 'desktop', g, controlled)).toBe(false);
  });
});

describe('setAdapterSettingForMatchingScopes', () => {
  it('writes the value into scopes whose adapter uses the group', () => {
    const g = group([field({ key: 'opacity', control: 'number' })]);
    const out = setAdapterSettingForMatchingScopes(cfgWith({ opacity: 10 }), 'desktop', g, g.fields[0]!, 55);
    expect(out.breakpoints.desktop?.image?.adapterSettings?.opacity).toBe(55);
  });

  it('skips scopes whose adapter does not use the group', () => {
    const g = group([field({ key: 'opacity', control: 'number' })]);
    const out = setAdapterSettingForMatchingScopes(cfgWith({ opacity: 10 }, 'other'), 'desktop', g, g.fields[0]!, 55);
    // unchanged (the only scope's adapter doesn't use the group) -> pruned/untouched
    expect(out.breakpoints.desktop?.image?.adapterSettings?.opacity ?? 10).toBe(10);
  });
});
