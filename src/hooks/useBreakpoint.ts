import { useState, useEffect, useRef, useCallback } from 'react';
import { useMantineTheme } from '@mantine/core';

/**
 * Breakpoint label used for per-breakpoint adapter resolution.
 */
export type Breakpoint = 'desktop' | 'tablet' | 'mobile';

interface UseBreakpointOptions {
  source?: 'container' | 'viewport';
}

/**
 * Converts a Mantine `em`-string (e.g. "48em") to pixels using the standard 16px base.
 */
function emToPx(em: string): number {
  const num = parseFloat(em);
  return Number.isFinite(num) ? num * 16 : 0;
}

/** Fallback breakpoints (px) if Mantine theme breakpoints are unavailable.
 *  Align with Mantine v7 defaults: sm=48em=768px, lg=75em=1200px. */
const FALLBACK_MOBILE_MAX = 768;
const FALLBACK_TABLET_MAX = 1200;

/**
 * Determines the current {@link Breakpoint} based on either container width or viewport width.
 *
 * Uses `ResizeObserver` on the supplied container ref by default so it works
 * correctly when the gallery is embedded inside a WordPress shortcode where
 * container width ≠ viewport width. When `source` is `'viewport'`, it instead
 * tracks `window.innerWidth`, which is a better fit for fullscreen or modal
 * viewer experiences that are intentionally width-clamped.
 *
 * Thresholds are sourced from the Mantine theme (`sm` → mobile/tablet boundary,
 * `lg` → tablet/desktop boundary) for consistency with the rest of the design system.
 *
 * @param containerRef - React ref to the DOM element to observe.
 * @param options - Controls whether breakpoint resolution uses the container or viewport width.
 * @returns The current `Breakpoint` value (`'desktop' | 'tablet' | 'mobile'`).
 */
export function useBreakpoint(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseBreakpointOptions = {},
): Breakpoint {
  const theme = useMantineTheme();
  const source = options.source ?? 'container';

  // Resolve Mantine breakpoints → pixel thresholds
  const mobileMax = theme.breakpoints?.sm
    ? emToPx(theme.breakpoints.sm)
    : FALLBACK_MOBILE_MAX;
  const tabletMax = theme.breakpoints?.lg
    ? emToPx(theme.breakpoints.lg)
    : FALLBACK_TABLET_MAX;

  const resolve = useCallback(
    (width: number): Breakpoint => {
      if (width < mobileMax) return 'mobile';
      if (width < tabletMax) return 'tablet';
      return 'desktop';
    },
    [mobileMax, tabletMax],
  );

  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop');

  // Keep a ref to avoid stale closures inside the ResizeObserver callback.
  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  useEffect(() => {
    if (source === 'viewport') {
      const updateFromViewport = () => {
        setBreakpoint(resolveRef.current(window.innerWidth));
      };

      updateFromViewport();
      window.addEventListener('resize', updateFromViewport);

      return () => {
        window.removeEventListener('resize', updateFromViewport);
      };
    }

    const el = containerRef.current;
    if (!el) return;

    // Set initial value
    setBreakpoint(resolveRef.current(el.clientWidth));

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width =
          entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
        setBreakpoint(resolveRef.current(width));
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef, source]);

  return breakpoint;
}
