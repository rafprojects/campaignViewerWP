/**
 * Build CSS filter, shadow, blend-mode, and overlay strings from slot effect types.
 */
import type { SlotFilterEffects, SlotShadow, SlotOverlayEffect, SlotBlendMode } from '@/types';

/**
 * Build a CSS `filter` string from slot filter effects and optional shadow.
 * Returns `undefined` when there are no active filters.
 */
export function buildFilterCss(
  effects?: SlotFilterEffects,
  shadow?: SlotShadow,
): string | undefined {
  const parts: string[] = [];

  if (effects) {
    if (effects.brightness != null && effects.brightness !== 100)
      parts.push(`brightness(${effects.brightness}%)`);
    if (effects.contrast != null && effects.contrast !== 100)
      parts.push(`contrast(${effects.contrast}%)`);
    if (effects.saturate != null && effects.saturate !== 100)
      parts.push(`saturate(${effects.saturate}%)`);
    if (effects.blur != null && effects.blur > 0)
      parts.push(`blur(${effects.blur}px)`);
    if (effects.grayscale != null && effects.grayscale > 0)
      parts.push(`grayscale(${effects.grayscale}%)`);
    if (effects.sepia != null && effects.sepia > 0)
      parts.push(`sepia(${effects.sepia}%)`);
    if (effects.hueRotate != null && effects.hueRotate !== 0)
      parts.push(`hue-rotate(${effects.hueRotate}deg)`);
    if (effects.invert != null && effects.invert > 0)
      parts.push(`invert(${effects.invert}%)`);
  }

  if (shadow && (shadow.offsetX || shadow.offsetY || shadow.blur)) {
    parts.push(
      `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color})`,
    );
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Get the CSS `mix-blend-mode` value for a slot.
 * Returns undefined (= no style needed) for 'normal' or absent.
 */
export function getBlendModeCss(bm?: SlotBlendMode): string | undefined {
  if (!bm || bm === 'normal') return undefined;
  return bm;
}

/**
 * Build a CSS background string for a darken/lighten overlay pseudo-element.
 * Returns undefined when no overlay is active.
 */
export function buildOverlayBg(
  overlay?: SlotOverlayEffect,
): string | undefined {
  if (!overlay || overlay.mode === 'none' || overlay.intensity <= 0) return undefined;
  const alpha = (overlay.intensity / 100).toFixed(2);
  return overlay.mode === 'darken'
    ? `rgba(0, 0, 0, ${alpha})`
    : `rgba(255, 255, 255, ${alpha})`;
}
