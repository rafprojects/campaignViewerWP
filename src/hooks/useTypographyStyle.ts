import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { GalleryBehaviorSettings, TypographyOverride } from '../types';

const EMPTY: TypographyOverride = {};

/**
 * Returns a CSSProperties object for a named text element, derived from the
 * user's typography overrides.  When no override is set the hook returns `{}`
 * and Mantine defaults apply as before.
 */
export function useTypographyStyle(
  elementId: string,
  settings: GalleryBehaviorSettings,
): CSSProperties {
  const override = settings.typographyOverrides?.[elementId] ?? EMPTY;

  return useMemo(() => {
    const style: CSSProperties = {};

    // Core typography
    if (override.fontFamily) style.fontFamily = override.fontFamily;
    if (override.fontSize) style.fontSize = override.fontSize;
    if (override.fontWeight) style.fontWeight = override.fontWeight;
    if (override.fontStyle) style.fontStyle = override.fontStyle;
    if (override.textTransform) style.textTransform = override.textTransform;
    if (override.textDecoration) style.textDecoration = override.textDecoration;
    if (override.lineHeight) style.lineHeight = override.lineHeight;
    if (override.letterSpacing) style.letterSpacing = override.letterSpacing;
    if (override.wordSpacing) style.wordSpacing = override.wordSpacing;
    if (override.color) style.color = override.color;

    // Text Stroke (via -webkit-text-stroke)
    if (override.textStrokeWidth) style.WebkitTextStrokeWidth = override.textStrokeWidth;
    if (override.textStrokeColor) style.WebkitTextStrokeColor = override.textStrokeColor;

    // Text Shadow + Text Glow (both map to CSS text-shadow, combined)
    const shadows: string[] = [];
    if (override.textShadowColor && override.textShadowBlur) {
      shadows.push(
        `${override.textShadowOffsetX ?? '0px'} ${override.textShadowOffsetY ?? '0px'} ${override.textShadowBlur} ${override.textShadowColor}`,
      );
    }
    if (override.textGlowColor && override.textGlowBlur) {
      shadows.push(`0 0 ${override.textGlowBlur} ${override.textGlowColor}`);
    }
    if (shadows.length > 0) style.textShadow = shadows.join(', ');

    return style;
  }, [override]);
}
