/**
 * P22-P2: GallerySectionWrapper
 *
 * Wraps each gallery section (unified or per-type), measures its own
 * width via ResizeObserver, and provides clamped ContainerDimensions to
 * children through a render-prop pattern.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Box } from '@mantine/core';
import type { ContainerDimensions, GalleryBehaviorSettings } from '@/types';
import { clampDimension } from '@/utils/clampDimension';
import { sanitizeCssUrl } from '@/utils/sanitizeCss';

interface GallerySectionWrapperProps {
  settings: GalleryBehaviorSettings;
  bgType: string;
  bgColor: string;
  bgGradient: string;
  bgImageUrl: string;
  borderRadius?: number;
  style?: CSSProperties;
  children: (containerDimensions: ContainerDimensions) => ReactNode;
}

/** Return a CSS background style object from viewport background settings. */
function resolveBackground(type: string, color: string, gradient: string, imageUrl: string): CSSProperties {
  switch (type) {
    case 'solid':    return { background: color };
    case 'gradient': return { background: gradient };
    case 'image': {
      const safeUrl = sanitizeCssUrl(imageUrl);
      return safeUrl ? { backgroundImage: `url(${safeUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
    }
    default:         return {};
  }
}

export function GallerySectionWrapper({
  settings: s,
  bgType,
  bgColor,
  bgGradient,
  bgImageUrl,
  borderRadius,
  style: externalStyle,
  children,
}: GallerySectionWrapperProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [measuredHeight, setMeasuredHeight] = useState(0);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setMeasuredWidth(rect.width);
      setMeasuredHeight(rect.height);
    });
    ro.observe(el);
    setMeasuredWidth(el.clientWidth);
    setMeasuredHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const availableWidth = measuredWidth > 0 ? measuredWidth : 0;
  const effectiveMinWidth = Math.max(0, Math.min(s.gallerySectionMinWidth, s.gallerySectionMaxWidth || s.gallerySectionMinWidth));

  // Clamp user settings to measured available space
  const effectiveMaxWidth = availableWidth > 0
    ? clampDimension(
        s.gallerySectionMaxWidth,
        effectiveMinWidth,
        2000,
        availableWidth,
      )
    : 0;

  const resolvedMaxHeight =
    s.gallerySectionHeightMode === 'manual' && s.gallerySectionMaxHeight > 0
      ? `${clampDimension(s.gallerySectionMaxHeight, s.gallerySectionMinHeight, 2000, Infinity)}px`
      : s.gallerySectionHeightMode === 'viewport'
        ? '80dvh'
        : undefined; // 'auto' — no max height constraint

  const effectiveMaxHeight =
    s.gallerySectionHeightMode === 'manual' && s.gallerySectionMaxHeight > 0
      ? clampDimension(s.gallerySectionMaxHeight, s.gallerySectionMinHeight, 2000, Infinity)
      : measuredHeight > 0 ? measuredHeight : 0;

  const containerDimensions: ContainerDimensions = {
    width: effectiveMaxWidth,
    height: effectiveMaxHeight,
  };

  const hasBg = bgType !== 'none' && bgType !== 'theme';
  const backgroundStyles = hasBg ? resolveBackground(bgType, bgColor, bgGradient, bgImageUrl) : {};

  const wrapperStyle: CSSProperties = {
    width: '100%',
    maxWidth: s.gallerySectionMaxWidth > 0
      ? `min(100%, ${Math.max(effectiveMinWidth, s.gallerySectionMaxWidth)}px)`
      : '100%',
    minWidth: effectiveMinWidth > 0 ? `min(100%, ${effectiveMinWidth}px)` : undefined,
    maxHeight: resolvedMaxHeight,
    minHeight: `${s.gallerySectionMinHeight}px`,
    padding: `${Math.max(0, Math.min(32, s.gallerySectionPadding))}px`,
    marginInline: 'auto',
    overflow: resolvedMaxHeight ? 'hidden' : undefined,
    borderRadius: borderRadius != null ? `${borderRadius}px` : undefined,
    ...backgroundStyles,
    ...externalStyle,
  };

  return (
    <Box ref={sectionRef} style={wrapperStyle}>
      {children(containerDimensions)}
    </Box>
  );
}
