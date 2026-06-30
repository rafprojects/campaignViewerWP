/**
 * Breakpoint viewport crop/scale geometry (P58-B).
 *
 * A non-desktop breakpoint renders a centered, full-height vertical slice (the "band")
 * of the design canvas, scaled to fill the available container width. This helper
 * computes that crop+scale geometry so the published gallery and the builder preview
 * render a breakpoint identically to the builder's on-canvas band guide.
 *
 * Slots stay percentages of the full design canvas — there is no coordinate remap; the
 * caller positions the canvas at its design size and applies `scale` + a left offset of
 * `bandLeftPx * scale` inside an `overflow:hidden` window of `windowWidthPx × windowHeightPx`.
 */

export interface BreakpointBandGeometry {
  /** Width (px) of the centered band on the design canvas. */
  bandWidthPx: number;
  /** Left offset (px) of the band on the design canvas. */
  bandLeftPx: number;
  /** Scale factor applied to the design canvas so the band fills the container (scale-to-fill). */
  scale: number;
  /** Visible window width (px) after scaling — equals `containerWidth` for a positive container. */
  windowWidthPx: number;
  /** Visible window height (px) after scaling. */
  windowHeightPx: number;
}

/**
 * Computes how to crop+scale a design canvas so a breakpoint's centered device-width band
 * fills the available container.
 *
 * @param designWidth    Full design canvas width (px) — the SAME basis the builder uses.
 * @param designHeight   Full design canvas height (px).
 * @param breakpointPx   Device reference width (px) for the breakpoint (e.g. 390 / 768).
 * @param containerWidth Available width (px) to fill. `<= 0` yields scale 1 (unmeasured container).
 */
export function computeBreakpointBand(
  designWidth: number,
  designHeight: number,
  breakpointPx: number,
  containerWidth: number,
): BreakpointBandGeometry {
  const bandWidthPx = Math.min(breakpointPx, designWidth);
  const bandLeftPx = (designWidth - bandWidthPx) / 2;
  const scale = containerWidth > 0 ? containerWidth / bandWidthPx : 1;
  return {
    bandWidthPx,
    bandLeftPx,
    scale,
    windowWidthPx: bandWidthPx * scale,
    windowHeightPx: designHeight * scale,
  };
}
