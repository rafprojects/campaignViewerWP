/**
 * Shared tile hover style generator
 *
 * Builds an inline <style> string for hover bounce + border glow effects
 * that work inside shadow DOM. Uses a per-adapter unique CSS class so
 * multiple different adapters on the same page don't collide.
 */
import type { GalleryBehaviorSettings } from '@/types';
import { sanitizeCssColor } from '@/utils/sanitizeCss';

/** Expand 3-digit hex (#abc) to 6-digit (#aabbcc); pass others through unchanged. */
function expandHex(hex: string): string {
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : hex;
}

/** Append hex alpha to a 3- or 6-digit hex color; return as-is for non-hex. */
function hexWithAlpha(color: string, alpha: string): string {
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) {
    return `${expandHex(color)}${alpha}`;
  }
  return color;
}

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
  const glowColor = sanitizeCssColor(tileGlowColor) || '#00bfff';
  const glowSpread = tileGlowSpread ?? 8;
  // Append hex alpha only for hex colors; reuse the base color for functional notations.
  const glowColor2 = hexWithAlpha(glowColor, '66');

  const parts: string[] = [];

  // ── Base transition (shared by combined + per-slot classes) ─────────────
  parts.push(`
.${cls}, .${cls}-pop, .${cls}-glow {
  transition: filter 0.25s ease;
  cursor: pointer;
}
`);

  // ── Bounce keyframes (always emitted — needed by both combined & per-slot) ─
  parts.push(`
@keyframes ${cls}-bounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.07); }
  75%  { transform: scale(0.97); }
  100% { transform: scale(1); }
}
`);

  // ── Per-slot pop class — bounce only ────────────────────────────────────
  parts.push(`
.${cls}-pop:hover {
  animation: ${cls}-bounce 0.38s ease-out forwards;
}
`);

  // ── Per-slot glow class — drop-shadow only ─────────────────────────────
  parts.push(`
.${cls}-glow:hover {
  filter: drop-shadow(0 0 ${glowSpread}px ${glowColor}) drop-shadow(0 0 ${glowSpread * 2}px ${glowColor2});
}
`);

  // ── Legacy combined class — controlled by global settings ──────────────
  if (tileHoverBounce) {
    parts.push(`
.${cls}:hover {
  animation: ${cls}-bounce 0.38s ease-out forwards;
}
`);
  }

  if (tileGlowEnabled) {
    parts.push(`
.${cls}:hover {
  filter: drop-shadow(0 0 ${glowSpread}px ${glowColor}) drop-shadow(0 0 ${glowSpread * 2}px ${glowColor2});
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
  const glowColor = sanitizeCssColor(settings.tileGlowColor) || '#00bfff';
  const glowSpread = settings.tileGlowSpread ?? 8;
  const parts: string[] = [];

  // ── Base transition (shared by combined + per-slot classes) ─────────────
  parts.push(`
.${cls}, .${cls}-pop, .${cls}-glow {
  transition: box-shadow 0.25s ease, transform 0.25s ease;
  cursor: pointer;
}
`);

  // ── Bounce keyframes (always emitted) ──────────────────────────────────
  parts.push(`
@keyframes ${cls}-bounce {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.06); }
  75%  { transform: scale(0.98); }
  100% { transform: scale(1); }
}
`);

  // ── Per-slot pop class — bounce only ────────────────────────────────────
  parts.push(`
.${cls}-pop:hover {
  animation: ${cls}-bounce 0.38s ease-out forwards;
}
`);

  // ── Per-slot glow class — box-shadow only ──────────────────────────────
  parts.push(`
.${cls}-glow:hover {
  box-shadow: 0 0 ${glowSpread}px ${glowColor}, 0 0 ${glowSpread * 2}px ${hexWithAlpha(glowColor, '66')};
}
`);

  // ── Legacy combined class — controlled by global settings ──────────────
  if (settings.tileHoverBounce) {
    parts.push(`
.${cls}:hover {
  animation: ${cls}-bounce 0.38s ease-out forwards;
}
`);
  }

  if (settings.tileGlowEnabled) {
    parts.push(`
.${cls}:hover {
  box-shadow: 0 0 ${glowSpread}px ${glowColor}, 0 0 ${glowSpread * 2}px ${hexWithAlpha(glowColor, '66')};
}
`);
  
  }

  return parts.join('');
}
