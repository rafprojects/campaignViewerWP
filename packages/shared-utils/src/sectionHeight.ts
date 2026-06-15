/**
 * P51-E: shared bounded-section-height resolution for adapters that render a
 * fixed-height "stage" filling the section (scroll-snap pager, coverflow,
 * stacked deck).
 *
 * Why this exists: these adapters take their own height from the measured
 * section height (`containerDimensions.height` provided by GallerySectionWrapper).
 * That measurement is only safe to adopt when the section is itself
 * height-bounded — `viewport`/`manual` modes, where the wrapper applies a
 * `maxHeight` + `overflow: hidden`. In the default `auto` mode the section is
 * sized by its content, so adopting the measurement as the adapter's own fixed
 * height creates a feedback loop: each ResizeObserver cycle the section grows by
 * the heading/padding delta and the stage balloons without bound. Falling back
 * to a fixed default height in that case keeps the stage bounded.
 *
 * Pure function, no React/WordPress coupling — a P51-A abstraction-spike
 * candidate alongside the tile-layout helper.
 */
export type SectionHeightMode = 'auto' | 'manual' | 'viewport' | undefined;

export function resolveBoundedSectionHeight(
  sectionHeightMode: SectionHeightMode,
  measuredHeight: number | undefined,
  fallbackPx: number,
): number {
  const bounded = sectionHeightMode === 'viewport' || sectionHeightMode === 'manual';
  return bounded && typeof measuredHeight === 'number' && measuredHeight > 0
    ? measuredHeight
    : fallbackPx;
}
