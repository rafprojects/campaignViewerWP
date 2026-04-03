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
import { toCss } from '@/utils/cssUnits';
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
  const sc = s.sectionScale ?? 1;
  const scaledMinWidth = Math.round((s.gallerySectionMinWidth ?? 0) * sc);
  const scaledMaxWidth = Math.round((s.gallerySectionMaxWidth ?? 0) * sc);
  const scaledMinHeight = Math.round((s.gallerySectionMinHeight ?? 0) * sc);
  const scaledMaxHeight = Math.round((s.gallerySectionMaxHeight ?? 0) * sc);
  const scaledPadding = Math.round(Math.max(0, Math.min(32, s.gallerySectionPadding)) * sc);
  const widthUnit = s.gallerySectionMaxWidthUnit ?? 'px';
  const minWidthUnit = s.gallerySectionMinWidthUnit ?? 'px';
  const heightUnit = s.gallerySectionMaxHeightUnit ?? 'px';
  const minHeightUnit = s.gallerySectionMinHeightUnit ?? 'px';
  const paddingUnit = s.gallerySectionPaddingUnit ?? 'px';
  const offsetXUnit = s.gallerySectionContentOffsetXUnit ?? 'px';
  const offsetYUnit = s.gallerySectionContentOffsetYUnit ?? 'px';
  const effectiveMinWidth = Math.max(0, Math.min(scaledMinWidth, scaledMaxWidth || scaledMinWidth));

  // Clamp user settings to measured available space
  const effectiveMaxWidth = availableWidth > 0
    ? clampDimension(
        scaledMaxWidth,
        effectiveMinWidth,
        2000,
        availableWidth,
      )
    : 0;

  const resolvedMaxHeight =
    s.gallerySectionHeightMode === 'manual' && scaledMaxHeight > 0
      ? toCss(clampDimension(scaledMaxHeight, scaledMinHeight, 2000, Infinity), heightUnit)
      : s.gallerySectionHeightMode === 'viewport'
        ? '80dvh'
        : undefined; // 'auto' — no max height constraint

  const effectiveMaxHeight =
    s.gallerySectionHeightMode === 'manual' && scaledMaxHeight > 0
      ? clampDimension(scaledMaxHeight, scaledMinHeight, 2000, Infinity)
      : measuredHeight > 0 ? measuredHeight : 0;

  const containerDimensions: ContainerDimensions = {
    width: effectiveMaxWidth,
    height: effectiveMaxHeight,
  };

  const hasBg = bgType !== 'none' && bgType !== 'theme';
  const backgroundStyles = hasBg ? resolveBackground(bgType, bgColor, bgGradient, bgImageUrl) : {};

  const alignX = s.gallerySectionContentAlignX || 'center';
  const alignY = s.gallerySectionContentAlignY || 'start';
  const hasContentOffset = s.gallerySectionContentOffsetX !== 0 || s.gallerySectionContentOffsetY !== 0;

  const wrapperStyle: CSSProperties = {
    width: '100%',
    maxWidth: scaledMaxWidth > 0
      ? `min(100%, ${toCss(Math.max(effectiveMinWidth, scaledMaxWidth), widthUnit)})`
      : '100%',
    minWidth: effectiveMinWidth > 0 ? `min(100%, ${toCss(effectiveMinWidth, minWidthUnit)})` : undefined,
    maxHeight: resolvedMaxHeight,
    minHeight: toCss(scaledMinHeight, minHeightUnit),
    padding: toCss(scaledPadding, paddingUnit),
    marginInline: 'auto',
    overflow: resolvedMaxHeight ? 'hidden' : undefined,
    borderRadius: borderRadius != null ? `${borderRadius}px` : undefined,
    display: 'flex',
    flexDirection: 'column',
    alignItems: alignX === 'center' ? 'center' : alignX === 'end' ? 'flex-end' : 'flex-start',
    justifyContent: alignY === 'center' ? 'center' : alignY === 'end' ? 'flex-end' : 'flex-start',
    ...backgroundStyles,
    ...externalStyle,
  };

  const contentStyle: CSSProperties | undefined = hasContentOffset
    ? { width: '100%', transform: `translate(${toCss(s.gallerySectionContentOffsetX, offsetXUnit)}, ${toCss(s.gallerySectionContentOffsetY, offsetYUnit)})` }
    : undefined;

  return (
    <Box ref={sectionRef} style={wrapperStyle}>
      {hasContentOffset ? (
        <div style={contentStyle}>{children(containerDimensions)}</div>
      ) : (
        children(containerDimensions)
      )}
    </Box>
  );
}
