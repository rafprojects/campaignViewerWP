export function normalizeCarouselVisibleCards(value: number | undefined): number {
  return Math.max(1, Math.round(value ?? 1));
}

export function shouldLoopCarousel(loopEnabled: boolean | undefined, mediaCount: number, visibleCards: number): boolean {
  return !!loopEnabled && mediaCount > 1 && mediaCount >= visibleCards;
}

export function shouldUseSyntheticCarouselLoop(
  loopEnabled: boolean | undefined,
  mediaCount: number,
  visibleCards: number,
): boolean {
  const normalizedVisibleCards = normalizeCarouselVisibleCards(visibleCards);
  return shouldLoopCarousel(loopEnabled, mediaCount, normalizedVisibleCards)
    && normalizedVisibleCards > 1
    && mediaCount <= normalizedVisibleCards + 1;
}

export function getCarouselAlign(visibleCards: number): 'start' | 'center' {
  return normalizeCarouselVisibleCards(visibleCards) > 1 ? 'start' : 'center';
}

export function getCarouselContainScroll(
  loopEnabled: boolean,
  visibleCards: number,
): false | 'trimSnaps' | 'keepSnaps' {
  if (loopEnabled) {
    return false;
  }

  return normalizeCarouselVisibleCards(visibleCards) > 1 ? 'keepSnaps' : 'trimSnaps';
}

function getCenterOffset(visibleCards: number): number {
  return Math.floor(normalizeCarouselVisibleCards(visibleCards) / 2);
}

function modulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function getOriginalCarouselIndex(index: number, mediaCount: number): number {
  if (mediaCount <= 0) {
    return 0;
  }

  return modulo(index, mediaCount);
}

export function getSyntheticLoopRecenterIndex(index: number, mediaCount: number): number | null {
  if (mediaCount <= 0) {
    return null;
  }

  const middleBandStart = mediaCount;
  const middleBandEnd = (mediaCount * 2) - 1;

  if (index >= middleBandStart && index <= middleBandEnd) {
    return null;
  }

  return getOriginalCarouselIndex(index, mediaCount) + mediaCount;
}

export function getClosestSyntheticFocusIndex(
  focusIndex: number,
  currentRenderedFocusIndex: number,
  mediaCount: number,
): number {
  if (mediaCount <= 0) {
    return 0;
  }

  const candidates = [
    focusIndex,
    focusIndex + mediaCount,
    focusIndex + (mediaCount * 2),
  ];

  return candidates.reduce((closest, candidate) => {
    return Math.abs(candidate - currentRenderedFocusIndex) < Math.abs(closest - currentRenderedFocusIndex)
      ? candidate
      : closest;
  }, candidates[1] ?? candidates[0]);
}

export function getCarouselFocusIndex(
  snapIndex: number,
  visibleCards: number,
  mediaCount: number,
  loopEnabled: boolean,
): number {
  if (mediaCount <= 0) {
    return 0;
  }

  const centerOffset = getCenterOffset(visibleCards);

  if (loopEnabled) {
    return modulo(snapIndex + centerOffset, mediaCount);
  }

  return Math.max(0, Math.min(mediaCount - 1, snapIndex + centerOffset));
}

export function getCarouselSnapIndexForFocus(
  focusIndex: number,
  visibleCards: number,
  mediaCount: number,
  loopEnabled: boolean,
): number {
  if (mediaCount <= 0) {
    return 0;
  }

  const centerOffset = getCenterOffset(visibleCards);

  if (loopEnabled) {
    return modulo(focusIndex - centerOffset, mediaCount);
  }

  return Math.max(0, Math.min(mediaCount - 1, focusIndex - centerOffset));
}