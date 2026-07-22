import { useEffect, useState, type RefObject } from 'react';

/**
 * Tracks the live content-box width of the element referenced by `ref`.
 *
 * A `ResizeObserver` keeps the value in sync with layout changes, and an initial
 * synchronous `clientWidth` read on mount seeds a real width straight away so
 * width-driven layouts (tiles-per-row reflow) don't flash a 0-width first pass.
 *
 * Extracted verbatim from the DiamondGallery/HexagonalGallery adapters
 * (Phase 70-A). Takes a **consumer-supplied** ref so the caller can attach the
 * same element for other purposes without a second ref, and so the behaviour is
 * byte-identical to the inline effect it replaces.
 *
 * @param ref - ref to the element whose width should be measured.
 * @returns the element's current content-box width in pixels (0 before mount).
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]!.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
