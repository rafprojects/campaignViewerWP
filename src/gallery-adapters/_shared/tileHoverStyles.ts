/**
 * Shared tile hover style generator
 *
 * Builds an inline <style> string for hover bounce + border glow effects
 * that work inside shadow DOM. Uses a per-adapter unique CSS class so
 * multiple different adapters on the same page don't collide.
 */
import type { GalleryBehaviorSettings } from '@/types';

export interface TileStyleOptions {
  /** Unique CSS class suffix for this adapter, e.g. "hex", "circle", "masonry" */
  scope: string;
  settings: GalleryBehaviorSettings;
  /** Extra static CSS appended at the end */
  extraCss?: string;
}

/**
 * Returns the full <style> element content for hover effects on `.wpsg-tile-{scope}`.
 * Also exports a helper to generate the border style string.
 */
export function buildTileStyles({ scope, settings, extraCss = '' }: TileStyleOptions): string {
  const cls = `wpsg-tile-${scope}`;
  const { tileHoverBounce, tileGlowEnabled, tileGlowColor, tileGlowSpread } = settings;

  const parts: string[] = [];

  // ── Base transition ────────────────────────────────────────────────────────
  parts.push(`
.${cls} {
  transition: filter 0.25s ease;
  cursor: pointer;
}
`);

  // ── Hover bounce ──────────────────────────────────────────────────────────
  if (tileHoverBounce) {
    parts.push(`
@keyframes ${cls}-bounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.07); }
  75%  { transform: scale(0.97); }
  100% { transform: scale(1); }
}
.${cls}:hover {
  animation: ${cls}-bounce 0.38s ease-out forwards;
}
`);
  }

  // ── Border glow ───────────────────────────────────────────────────────────
  // drop-shadow filter works correctly with clip-path shapes (unlike box-shadow)
  if (tileGlowEnabled) {
    const color = tileGlowColor;
    const spread = tileGlowSpread;
    const color2 = `${color}66`; // half-opacity echo
    parts.push(`
.${cls}:hover {
  filter: drop-shadow(0 0 ${spread}px ${color}) drop-shadow(0 0 ${spread * 2}px ${color2});
}
`);
  }

  if (extraCss) {
    parts.push(extraCss);
  }

  return parts.join('');
}

/** Returns an inline `border` shorthand string, or '' when width is 0. */
export function tileBorderStyle(settings: GalleryBehaviorSettings): string {
  if (!settings.tileBorderWidth) return 'none';
  return `${settings.tileBorderWidth}px solid ${settings.tileBorderColor}`;
}

/** Box-shadow for non-clip-path tiles (justified/masonry) where box-shadow works. */
export function buildBoxShadowStyles(scope: string, settings: GalleryBehaviorSettings): string {
  const cls = `wpsg-tile-${scope}`;
  const parts: string[] = [];

  parts.push(`
.${cls} {
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  cursor: pointer;
}
`);

  if (settings.tileHoverBounce) {
    parts.push(`
@keyframes ${cls}-bounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.06); }
  75%  { transform: scale(0.98); }
  100% { transform: scale(1); }
}
.${cls}:hover {
  animation: ${cls}-bounce 0.38s ease-out forwards;
}
`);
  }

  if (settings.tileGlowEnabled) {
    const { tileGlowColor: color, tileGlowSpread: spread } = settings;
    parts.push(`
.${cls}:hover {
  box-shadow: 0 0 ${spread}px ${color}, 0 0 ${spread * 2}px ${color}66;
}
`);
  }

  return parts.join('');
}
