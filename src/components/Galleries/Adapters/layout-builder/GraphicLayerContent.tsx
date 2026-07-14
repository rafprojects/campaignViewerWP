/**
 * P50-J — GraphicLayerContent
 *
 * Shared presentational renderer for a graphic layer's visual content,
 * applying the curated slot-parity property set: transform (rotation + flip),
 * shape/clip-path, mask, border, CSS filters, drop-shadow and blend mode.
 *
 * Used by every place an overlay is drawn (the builder canvas preview + edit
 * branches and the public LayoutBuilderGallery) so a graphic layer renders
 * identically across the builder and the rendered gallery. The outer
 * positioning element (absolute box or react-rnd frame) is owned by the caller;
 * this component fills it (width/height 100%) and never touches position,
 * z-index, opacity or pointer-events.
 */
import type { CSSProperties } from 'react';
import type { LayoutGraphicLayer } from '@/types';
import { getClipPathForShape } from '@wp-super-gallery/shared-utils';
import { buildFilterCss, getBlendModeCss } from '@wp-super-gallery/shared-utils';
import { buildGraphicLayerTransform } from '@wp-super-gallery/shared-utils';
import { useFeatheredMask } from '@/hooks/useFeatheredMask';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

export interface GraphicLayerContentProps {
  layer: LayoutGraphicLayer;
  /** Rendered width in px — used for pixel-accurate mask positioning. */
  pixelWidth?: number | undefined;
  /** Rendered height in px — used for pixel-accurate mask positioning. */
  pixelHeight?: number | undefined;
}

export function GraphicLayerContent({ layer, pixelWidth, pixelHeight }: GraphicLayerContentProps) {
  const clipPath = getClipPathForShape(layer.shape, layer.clipPath);

  // ── Mask (optional, mirrors LayoutSlotComponent) ──────────────────────────
  const ml = layer.maskLayer;
  const maskVisible = ml?.visible !== false;
  const rawMaskUrl = maskVisible ? ml?.url || undefined : undefined;
  const featherPx = maskVisible ? ml?.feather ?? 0 : 0;
  const maskUrl = useFeatheredMask(rawMaskUrl, featherPx);

  const maskPosX = ml && pixelWidth ? `${(ml.x / 100) * pixelWidth}px` : 'center';
  const maskPosY = ml && pixelHeight ? `${(ml.y / 100) * pixelHeight}px` : 'center';
  const maskPosValue = ml ? `${maskPosX} ${maskPosY}` : 'center';

  const maskCss: CSSProperties = maskUrl
    ? ({
        WebkitMaskImage: `url(${maskUrl})`,
        maskImage: `url(${maskUrl})`,
        WebkitMaskSize: ml ? `${ml.width}% ${ml.height}%` : 'cover',
        maskSize: ml ? `${ml.width}% ${ml.height}%` : 'cover',
        WebkitMaskPosition: maskPosValue,
        maskPosition: maskPosValue,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskMode: ml?.mode ?? 'luminance',
        maskMode: ml?.mode ?? 'luminance',
      } as CSSProperties)
    : {};

  // ── Effects ───────────────────────────────────────────────────────────────
  const filterCss = buildFilterCss(layer.filterEffects, layer.shadow);
  const blendCss = getBlendModeCss(layer.blendMode);
  const transform = buildGraphicLayerTransform(layer);
  const borderWidth = layer.borderWidth ?? 0;
  const hasClipOrMask = Boolean(clipPath || maskUrl);

  // Transform/filter/blend live on this inner wrapper so the caller's selection
  // outline (on the rnd frame) stays axis-aligned and unfiltered.
  const wrapperStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    position: 'relative',
    transform,
    transformOrigin: 'center center',
    filter: filterCss || undefined,
    mixBlendMode: (blendCss as CSSProperties['mixBlendMode']) || undefined,
  };

  const img = (
    <img
      src={layer.imageUrl}
      alt=""
      style={{
        width: '100%',
        height: '100%',
        // 'fill' keeps the image flush with its bounding box (object-fit is a
        // deferred P50-J item — a graphic layer's box is its image).
        objectFit: 'fill',
        display: 'block',
        pointerEvents: 'none',
      }}
      draggable={false}
    />
  );

  if (hasClipOrMask) {
    // Double-container border technique (same as LayoutSlotComponent): the only
    // reliable CSS approach for a border that follows an arbitrary clip/mask.
    return (
      <div style={wrapperStyle} data-wpsg-graphic-layer="clipped">
        {borderWidth > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath,
              ...maskCss,
              backgroundColor: layer.borderColor || '#ffffff',
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: borderWidth > 0 ? `${borderWidth}px` : 0,
            clipPath,
            ...maskCss,
            overflow: 'hidden',
          }}
        >
          {img}
        </div>
      </div>
    );
  }

  // Rectangle: standard CSS border + corner rounding.
  return (
    <div
      style={{
        ...wrapperStyle,
        borderRadius: layer.borderRadius || undefined,
        overflow: 'hidden',
        border: borderWidth > 0 ? `${borderWidth}px solid ${layer.borderColor || '#ffffff'}` : undefined,
        boxSizing: 'border-box',
      }}
      data-wpsg-graphic-layer="rect"
    >
      {img}
    </div>
  );
}

setWpsgDebugDisplayName(GraphicLayerContent, 'LayoutBuilder:GraphicLayerContent');
