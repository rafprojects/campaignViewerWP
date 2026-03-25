/** Shared overlay styling constants for gallery adapter hover / badge elements.
 *  Centralised here so contrast adjustments are single-point-of-change.
 *  Background at 0.7 opacity improves white-text contrast across varied imagery,
 *  but final WCAG contrast still depends on the underlying pixels. */

export const OVERLAY_BG = 'rgba(0,0,0,0.7)';
export const OVERLAY_TEXT = '#ffffff';
export const OVERLAY_ICON_SHADOW = 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))';
