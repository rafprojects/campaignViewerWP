import { describe, expect, it } from 'vitest';

import {
  getClosestSyntheticFocusIndex,
  getCarouselAlign,
  getCarouselContainScroll,
  getCarouselFocusIndex,
  getCarouselSnapIndexForFocus,
  getOriginalCarouselIndex,
  getSyntheticLoopRecenterIndex,
  normalizeCarouselVisibleCards,
  shouldLoopCarousel,
  shouldUseSyntheticCarouselLoop,
} from './carouselBehavior';

describe('carouselBehavior', () => {
  it('normalizes visible-card counts to positive integers without forcing odd values', () => {
    expect(normalizeCarouselVisibleCards(undefined)).toBe(1);
    expect(normalizeCarouselVisibleCards(1)).toBe(1);
    expect(normalizeCarouselVisibleCards(2)).toBe(2);
    expect(normalizeCarouselVisibleCards(4)).toBe(4);
    expect(normalizeCarouselVisibleCards(5)).toBe(5);
  });

  it('only loops when the media set is larger than the visible-card window', () => {
    expect(shouldLoopCarousel(true, 5, 3)).toBe(true);
    expect(shouldLoopCarousel(true, 3, 3)).toBe(true);
    expect(shouldLoopCarousel(true, 2, 3)).toBe(false);
    expect(shouldLoopCarousel(false, 8, 3)).toBe(false);
  });

  it('uses start alignment for multi-card windows and center alignment for single-card windows', () => {
    expect(getCarouselAlign(1)).toBe('center');
    expect(getCarouselAlign(2)).toBe('start');
    expect(getCarouselAlign(3)).toBe('start');
    expect(getCarouselAlign(5)).toBe('start');
  });

  it('keeps per-slide snaps in non-looping multi-card mode', () => {
    expect(getCarouselContainScroll(true, 3)).toBe(false);
    expect(getCarouselContainScroll(false, 1)).toBe('trimSnaps');
    expect(getCarouselContainScroll(false, 2)).toBe('keepSnaps');
    expect(getCarouselContainScroll(false, 3)).toBe('keepSnaps');
  });

  it('maps a snap anchor to the centered focus index for non-looping carousels', () => {
    expect(getCarouselFocusIndex(0, 3, 5, false)).toBe(1);
    expect(getCarouselFocusIndex(1, 3, 5, false)).toBe(2);
    expect(getCarouselFocusIndex(2, 3, 5, false)).toBe(3);
  });

  it('maps a snap anchor to the centered focus index for looping carousels', () => {
    expect(getCarouselFocusIndex(0, 3, 4, true)).toBe(1);
    expect(getCarouselFocusIndex(2, 3, 4, true)).toBe(3);
    expect(getCarouselFocusIndex(3, 3, 4, true)).toBe(0);
  });

  it('maps even visible-card windows to a stable focus offset', () => {
    expect(getCarouselFocusIndex(0, 4, 6, false)).toBe(2);
    expect(getCarouselSnapIndexForFocus(2, 4, 6, false)).toBe(0);
    expect(getCarouselSnapIndexForFocus(4, 4, 6, false)).toBe(2);
  });

  it('converts a requested focus slide back into the snap index needed to center it', () => {
    expect(getCarouselSnapIndexForFocus(3, 3, 4, true)).toBe(2);
    expect(getCarouselSnapIndexForFocus(0, 3, 4, true)).toBe(3);
    expect(getCarouselSnapIndexForFocus(2, 3, 5, false)).toBe(1);
  });

  it('uses a synthetic loop track for small multi-card sets that Embla cannot loop reliably', () => {
    expect(shouldUseSyntheticCarouselLoop(true, 3, 3)).toBe(true);
    expect(shouldUseSyntheticCarouselLoop(true, 4, 3)).toBe(true);
    expect(shouldUseSyntheticCarouselLoop(true, 5, 3)).toBe(false);
    expect(shouldUseSyntheticCarouselLoop(true, 2, 3)).toBe(false);
  });

  it('maps duplicated synthetic slides back to their original items and middle band', () => {
    expect(getOriginalCarouselIndex(5, 4)).toBe(1);
    expect(getSyntheticLoopRecenterIndex(2, 4)).toBe(6);
    expect(getSyntheticLoopRecenterIndex(6, 4)).toBe(null);
    expect(getSyntheticLoopRecenterIndex(8, 4)).toBe(4);
    expect(getClosestSyntheticFocusIndex(0, 6, 4)).toBe(4);
    expect(getClosestSyntheticFocusIndex(3, 5, 4)).toBe(7);
  });
});