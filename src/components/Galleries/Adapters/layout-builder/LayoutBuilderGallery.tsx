/**
 * P15-E.1–E.4: Layout Builder Gallery Adapter
 *
 * Renders media in an absolutely positioned layout defined by a
 * LayoutTemplate. Each slot is a positioned `<div>` with clip-path,
 * border, and object-fit matching the slot definition.
 *
 * Features:
 * - Uses `useLayoutTemplate()` SWR hook + public endpoint (no auth).
 * - `assignMediaToSlots()` for media→slot assignment.
 * - Per-slot hover effects via `buildTileStyles()` + `buildBoxShadowStyles()`.
 * - Lightbox integration via `useCarousel` + `<Lightbox>`.
 * - Empty-slot placeholders (gray dashed, non-interactive).
 * - Slot count mismatch warning.
 *
 * Adapter ID: `'layout-builder'`
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Box, Center, Loader, Text, Stack } from '@mantine/core';
import { IconLayoutDashboard, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  LayoutTemplate,
  CampaignLayoutBinding,
  SlotTiltEffect,
  LayoutSlot,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { useLayoutTemplate } from '@/hooks/useLayoutTemplate';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Galleries/Shared/Lightbox';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { assignMediaToSlots, resolveSlotWithOverrides } from '@/utils/layoutSlotAssignment';
import { buildTileStyles, buildBoxShadowStyles } from '@/components/Galleries/Adapters/_shared/tileHoverStyles';
import { getClipPath, usesClipPath } from '@/utils/clipPath';
import { buildGradientCss, templateToGradientOpts } from '@/utils/gradientCss';
import { buildFilterCss, getBlendModeCss, buildOverlayBg } from '@/utils/slotEffects';
import { useFeatheredMask } from '@/hooks/useFeatheredMask';
import { useViewportHeight } from '@/hooks/useViewportHeight';
import { sanitizeCssUrl } from '@/utils/sanitizeCss';
import { toCssOrNumber } from '@/utils/cssUnits';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings } from '../_shared/runtimeCommon';

// ── TiltWrapper: applies mouse-reactive 3D tilt to children ──────────────────

function TiltWrapper({
  tilt,
  children,
  style,
  ...rest
}: {
  tilt: SlotTiltEffect;
  children: React.ReactNode;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      // Normalise mouse position to -1…1 from centre
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      const rotateY = nx * tilt.maxAngle;
      const rotateX = -ny * tilt.maxAngle;
      setTransform(
        `perspective(${tilt.perspective}px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`,
      );
    },
    [tilt.maxAngle, tilt.perspective],
  );

  const handleMouseLeave = useCallback(() => {
    setTransform('');
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        transform: transform || undefined,
        transition: transform ? 'none' : `transform ${tilt.resetSpeed}ms ease-out`,
        willChange: 'transform',
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ── GallerySlotView: renders one slot (a function component so hooks work) ───

interface GallerySlotViewProps {
  slot: LayoutSlot;
  assigned: MediaItem | undefined;
  effectiveWidth: number;
  canvasHeight: number;
  onOpenAt: (index: number) => void;
  mediaIndexMap: Map<string, number>;
  /** Glow settings from campaign-level GalleryBehaviorSettings. */
  glowColor: string;
  glowSpread: number;
}

function GallerySlotView({
  slot,
  assigned,
  effectiveWidth,
  canvasHeight,
  onOpenAt,
  mediaIndexMap,
  glowColor,
  glowSpread,
}: GallerySlotViewProps) {
  // Px positions from percentages
  const pxX = (slot.x / 100) * effectiveWidth;
  const pxY = (slot.y / 100) * canvasHeight;
  const pxW = (slot.width / 100) * effectiveWidth;
  const pxH = (slot.height / 100) * canvasHeight;
  const clipPath = getClipPath(slot);

  // Mask layer — prefer maskLayer fields if present, apply feathering
  const ml = slot.maskLayer;
  const maskVisible = ml?.visible !== false;
  const rawMaskUrl = maskVisible ? (ml?.url ?? slot.maskUrl) : undefined;
  const featherPx = maskVisible ? (ml?.feather ?? 0) : 0;
  const maskUrl = useFeatheredMask(rawMaskUrl, featherPx);
  const resolvedMaskMode = ml?.mode ?? slot.maskMode ?? 'luminance';
  // Compute mask position as pixel offsets (CSS %-based mask-position doesn't work at size=100%)
  const feMaskPosX = ml ? `${(ml.x / 100) * pxW}px` : 'center';
  const feMaskPosY = ml ? `${(ml.y / 100) * pxH}px` : 'center';
  const feMaskPos = ml ? `${feMaskPosX} ${feMaskPosY}` : 'center';
  const safeMaskUrl = sanitizeCssUrl(maskUrl);
  const maskStyle: React.CSSProperties = safeMaskUrl
    ? ({
      WebkitMaskImage: `url(${safeMaskUrl})`,
      maskImage: `url(${safeMaskUrl})`,
      WebkitMaskSize: ml ? `${ml.width}% ${ml.height}%` : 'cover',
      maskSize: ml ? `${ml.width}% ${ml.height}%` : 'cover',
      WebkitMaskPosition: feMaskPos,
      maskPosition: feMaskPos,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskMode: resolvedMaskMode,
      maskMode: resolvedMaskMode,
    } as React.CSSProperties)
    : {};

  // Slot effects
  const filterCss = buildFilterCss(slot.filterEffects, slot.shadow);
  const blendCss = getBlendModeCss(slot.blendMode);
  const overlayBg = buildOverlayBg(slot.overlayEffect);
  const [hovered, setHovered] = useState(false);

  if (!assigned) {
    // E.4: Empty slot — gray dashed placeholder, non-interactive
    return (
      <div
        style={{
          position: 'absolute',
          left: pxX,
          top: pxY,
          width: pxW,
          height: pxH,
          zIndex: slot.zIndex,
          clipPath,
          ...maskStyle,
          borderRadius: slot.shape === 'rectangle' ? slot.borderRadius : undefined,
          border: '2px dashed rgba(128,128,128,0.5)',
          background: 'rgba(128,128,128,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        <Text size="xs" c="dimmed" ta="center">
          Empty
        </Text>
      </div>
    );
  }

  // Resolve lightbox index for this media item
  const lightboxIndex = mediaIndexMap.get(assigned.id) ?? 0;
  const isClickable = slot.clickAction === 'lightbox';

  // Choose hover class — per-slot hoverEffect selects the specific
  // effect variant (-pop or -glow), drop-shadow for clip-path (on wrapper),
  // box-shadow for rectangles (direct).
  //
  // IMPORTANT: for clip-path + glow, we CANNOT use a CSS class because the
  // inline `filter` style (for slot shadows/effects) overrides any class-based
  // `filter` rule. Instead we merge the glow drop-shadow into the inline
  // filter at render time via hover state.
  const isClip = usesClipPath(slot);
  const needsInlineGlow = isClip && slot.hoverEffect === 'glow';

  const hoverClass = (() => {
    if (slot.hoverEffect === 'none') return '';
    // Clip-path + glow: handled via inline merged filter, no CSS class
    if (needsInlineGlow) return '';
    const suffix = slot.hoverEffect === 'glow' ? '-glow' : '-pop';
    return isClip ? `wpsg-tile-lb${suffix}` : `wpsg-tile-lb-rect${suffix}`;
  })();

  // Build merged filter: slot effects + optional glow on hover
  const glowFilter = hovered && needsInlineGlow
    ? `drop-shadow(0 0 ${glowSpread}px ${glowColor}) drop-shadow(0 0 ${glowSpread * 2}px ${glowColor}66)`
    : '';
  const mergedFilter = [filterCss, glowFilter].filter(Boolean).join(' ') || undefined;

  // Hover handlers for inline glow (only wired when needed)
  const glowHandlers = needsInlineGlow
    ? {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
    }
    : {};

  // Media content (shared by clip-path wrapper and rectangle paths)
  const slotMedia = assigned.type === 'video' ? (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <LazyImage
        src={assigned.thumbnail || assigned.url}
        alt={assigned.title || 'Video'}
        style={{
          width: '100%',
          height: '100%',
          objectFit: slot.objectFit,
          objectPosition: slot.objectPosition,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.25)',
          pointerEvents: 'none',
        }}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="white" opacity={0.85}>
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
  ) : (
    <LazyImage
      src={assigned.thumbnail || assigned.url}
      alt={assigned.title || 'Image'}
      style={{
        width: '100%',
        height: '100%',
        objectFit: slot.objectFit,
        objectPosition: slot.objectPosition,
      }}
    />
  );

  // Interaction props (shared)
  const interactionProps = {
    role: isClickable ? ('button' as const) : undefined,
    tabIndex: isClickable ? 0 : undefined,
    'aria-label': isClickable
      ? `View ${assigned.title || 'media'} in lightbox`
      : undefined,
    onClick: isClickable ? () => onOpenAt(lightboxIndex) : undefined,
    onKeyDown: isClickable
      ? (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenAt(lightboxIndex);
        }
      }
      : undefined,
  };

  // Clip-path shapes: double-container border technique.
  if (clipPath) {
    const inset = slot.borderWidth > 0 ? `${slot.borderWidth}px` : 0;
    const outerStyle: React.CSSProperties = {
      position: 'absolute',
      left: pxX,
      top: pxY,
      width: pxW,
      height: pxH,
      zIndex: slot.zIndex,
      cursor: isClickable ? 'pointer' : 'default',
      filter: mergedFilter,
      transition: needsInlineGlow ? 'filter 0.25s ease' : undefined,
      mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
    };
    const clipContent = (
      <>
        {/* Border fill layer */}
        {slot.borderWidth > 0 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath,
              ...maskStyle,
              backgroundColor: slot.borderColor,
            }}
          />
        )}
        {/* Image layer, inset to reveal border strip */}
        <div
          style={{
            position: 'absolute',
            inset,
            clipPath,
            ...maskStyle,
            overflow: 'hidden',
          }}
        >
          {slotMedia}
        </div>
        {/* Overlay effect layer */}
        {overlayBg && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              clipPath,
              ...maskStyle,
              background: overlayBg,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}
      </>
    );

    return slot.tilt?.enabled ? (
      <TiltWrapper tilt={slot.tilt} className={hoverClass} style={outerStyle} {...interactionProps} {...glowHandlers}>
        {clipContent}
      </TiltWrapper>
    ) : (
      <div className={hoverClass} style={outerStyle} {...interactionProps} {...glowHandlers}>
        {clipContent}
      </div>
    );
  }

  // Rectangle slots
  const rectStyle: React.CSSProperties = {
    position: 'absolute',
    left: pxX,
    top: pxY,
    width: pxW,
    height: pxH,
    zIndex: slot.zIndex,
    borderRadius: slot.borderRadius,
    ...maskStyle,
    border:
      slot.borderWidth > 0
        ? `${slot.borderWidth}px solid ${slot.borderColor}`
        : undefined,
    cursor: isClickable ? 'pointer' : 'default',
    overflow: 'hidden',
    filter: mergedFilter,
    mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
  };
  const rectContent = (
    <>
      {slotMedia}
      {overlayBg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: slot.borderRadius,
            background: overlayBg,
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      )}
    </>
  );

  return slot.tilt?.enabled ? (
    <TiltWrapper tilt={slot.tilt} className={hoverClass} style={rectStyle} {...interactionProps}>
      {rectContent}
    </TiltWrapper>
  ) : (
    <div className={hoverClass} style={rectStyle} {...interactionProps}>
      {rectContent}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface LayoutBuilderGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  /** Campaign layout template ID (from campaign.layoutTemplateId). */
  templateId: string;
  /** Per-campaign slot overrides (media binding, focal point). */
  slotOverrides?: CampaignLayoutBinding['slotOverrides'];
  /** When true, show admin-level assignment info banners. */
  isAdmin?: boolean;
  /** Measured container dimensions from GallerySectionWrapper. */
  containerDimensions?: ContainerDimensions;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LayoutBuilderGallery({
  media,
  settings,
  runtime,
  templateId,
  slotOverrides = {},
  isAdmin = false,
  containerDimensions: _containerDimensions,
}: LayoutBuilderGalleryProps) {
  const { template, isLoading, error } = useLayoutTemplate(templateId);

  // Lightbox state — navigates the full media array
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);

  const openAt = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLightboxOpen(true);
    },
    [setCurrentIndex],
  );
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  // ── Loading / Error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Center py="xl" mih={200}>
        <Stack align="center" gap="xs">
          <Loader size="md" aria-label="Loading layout template" />
          <Text size="sm" c="dimmed">Loading gallery…</Text>
        </Stack>
      </Center>
    );
  }

  if (error || !template) {
    return (
      <Stack align="center" gap="xs" py="xl">
        <IconAlertTriangle size={32} color="var(--mantine-color-yellow-6)" />
        <Text size="sm" c="dimmed">
          {error ?? 'Layout template not found'}
        </Text>
      </Stack>
    );
  }

  return (
    <LayoutBuilderGalleryInner
      template={template}
      media={media}
      settings={settings}
      runtime={runtime}
      slotOverrides={slotOverrides}
      isAdmin={isAdmin}
      lightboxOpen={lightboxOpen}
      currentIndex={currentIndex}
      onOpenAt={openAt}
      onCloseLightbox={closeLightbox}
      onNext={next}
      onPrev={prev}
    />
  );
}

// ── Inner renderer (only mounts when template is loaded) ─────────────────────

interface InnerProps {
  template: LayoutTemplate;
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  slotOverrides: CampaignLayoutBinding['slotOverrides'];
  isAdmin: boolean;
  lightboxOpen: boolean;
  currentIndex: number;
  onOpenAt: (index: number) => void;
  onCloseLightbox: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function LayoutBuilderGalleryInner({
  template,
  media,
  settings,
  runtime,
  slotOverrides,
  isAdmin,
  lightboxOpen,
  currentIndex,
  onOpenAt,
  onCloseLightbox,
  onNext,
  onPrev,
}: InnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const viewportHeight = useViewportHeight();
  const common = resolveGalleryComponentCommonSettings(settings, runtime);

  // ── Responsive container width via ResizeObserver ──────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Media assignment ──────────────────────────────────────────────────────
  const { assignments, summary } = useMemo(
    () => assignMediaToSlots(template, media, slotOverrides),
    [template, media, slotOverrides],
  );

  // Build a quick mediaId→index map for lightbox navigation
  const mediaIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    media.forEach((m, i) => map.set(m.id, i));
    return map;
  }, [media]);

  // ── Canvas dimensions ─────────────────────────────────────────────────────
  const maxW = template.canvasMaxWidth || 9999;
  const minW = template.canvasMinWidth || 0;
  const effectiveWidth = Math.max(minW, Math.min(containerWidth, maxW));
  // Respect template's designed width so Layout Builder canvases aren't
  // shrunk below their authored size by a narrower modal.
  const finalCanvasWidth = Math.max(effectiveWidth, template.canvasMaxWidth || 0);
  const canvasHeight =
    template.canvasHeightMode === 'fixed-vh'
      ? viewportHeight * ((template.canvasHeightVh || 50) / 100)
      : finalCanvasWidth / (template.canvasAspectRatio || 16 / 9);

  // ── Hover styles ──────────────────────────────────────────────────────────
  // Two sets — drop-shadow for clip-path shapes (on wrapper div), box-shadow for rectangles.
  const hoverStylesCss = useMemo(() => {
    const dropShadow = buildTileStyles({ scope: 'lb', settings });
    const boxShadow = buildBoxShadowStyles('lb-rect', settings);
    return dropShadow + '\n' + boxShadow;
  }, [settings]);

  // ── Slot-count mismatch warning ───────────────────────────────────────────
  const slotCount = template.slots.length;
  const mediaCount = media.length;
  const hasMismatch = slotCount !== mediaCount;

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {/* Hover styles injected into DOM */}
      <style>{hoverStylesCss}</style>

      {/* Header */}
      {common.showCampaignGalleryLabels !== false && (
        <Text size="sm" fw={500} component="div" ta={common.galleryLabelJustification || 'left'}>
          <Box component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {common.showGalleryLabelIcon && <IconLayoutDashboard size={16} />}
            Gallery ({mediaCount})
          </Box>
        </Text>
      )}

      {/* Mismatch warning */}
      {hasMismatch && (
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 6,
            background: 'var(--mantine-color-yellow-light)',
            color: 'var(--mantine-color-yellow-9)',
            fontSize: '0.8125rem',
          }}
          role="alert"
        >
          <IconAlertTriangle size={16} />
          {mediaCount > slotCount
            ? `${mediaCount - slotCount} media item(s) have no slot — they won't be displayed.`
            : `${slotCount - mediaCount} slot(s) have no media — they'll appear as placeholders.`}
        </Box>
      )}

      {/* Admin: slot assignment summary */}
      {isAdmin && (summary.cleared.length > 0 || summary.empty.length > 0) && (
        <Box
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 6,
            background: 'var(--mantine-color-blue-light)',
            color: 'var(--mantine-color-blue-9)',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
          }}
        >
          <IconInfoCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Slot assignment info</strong>
            {summary.kept.length > 0 && (
              <div>
                Kept bindings: {summary.kept.map((k) => `slot ${k.slotIndex} \u2192 ${k.mediaTitle}`).join(', ')}
              </div>
            )}
            {summary.cleared.length > 0 && (
              <div>
                Cleared (media not in campaign): {summary.cleared.map((c) => `slot ${c.slotIndex}`).join(', ')}
              </div>
            )}
            {summary.autoFilled.length > 0 && (
              <div>
                Auto-filled from remaining media: {summary.autoFilled.map((a) => `slot ${a.slotIndex} \u2192 ${a.mediaTitle}`).join(', ')}
              </div>
            )}
            {summary.empty.length > 0 && (
              <div>
                Empty (no media remaining): slot{summary.empty.length > 1 ? 's' : ''} {summary.empty.join(', ')}
              </div>
            )}
          </div>
        </Box>
      )}

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{ width: '100%', maxWidth: maxW || undefined, overflowX: 'auto' }}
      >
        {containerWidth > 0 && (
          <div
            style={{
              position: 'relative',
              width: finalCanvasWidth,
              height: canvasHeight,
              backgroundColor:
                (template.backgroundMode ?? 'color') === 'color'
                  ? (template.backgroundColor || '#000')
                  : (template.backgroundMode === 'none' ? 'transparent' : undefined),
              background:
                (template.backgroundMode ?? 'color') === 'gradient'
                  ? buildGradientCss(templateToGradientOpts(template)) ?? 'transparent'
                  : undefined,
              overflow: 'hidden',
              borderRadius: toCssOrNumber(settings.imageBorderRadius || 0, settings.imageBorderRadiusUnit ?? 'px'),
              margin: '0 auto',
            }}
            role="img"
            aria-label={`Layout gallery: ${template.name}`}
          >
            {/* Background image layer (below slots) */}
            {template.backgroundImage && (
              <img
                src={template.backgroundImage}
                alt=""
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: template.backgroundImageFit ?? 'cover',
                  objectPosition: 'center',
                  opacity: template.backgroundImageOpacity ?? 1,
                  zIndex: 0,
                  pointerEvents: 'none',
                  display: 'block',
                }}
                draggable={false}
              />
            )}
            {template.slots.map((rawSlot) => {
              const slot = resolveSlotWithOverrides(rawSlot, slotOverrides);
              const assigned = assignments.get(slot.id);
              return (
                <GallerySlotView
                  key={slot.id}
                  slot={slot}
                  assigned={assigned}
                  effectiveWidth={finalCanvasWidth}
                  canvasHeight={canvasHeight}
                  onOpenAt={onOpenAt}
                  mediaIndexMap={mediaIndexMap}
                  glowColor={slot.glowColor || settings.tileGlowColor || '#7c9ef8'}
                  glowSpread={slot.glowSpread ?? settings.tileGlowSpread ?? 12}
                />
              );
            })}

            {/* Overlay layers (P15-H) — rendered above all slots */}
            {template.overlays.map((overlay) => {
              // Blob URLs are only valid in the browser tab that created them
              // and should never be persisted for campaign rendering.
              if (overlay.imageUrl?.startsWith('blob:')) {
                return null;
              }

              const oPxX = (overlay.x / 100) * effectiveWidth;
              const oPxY = (overlay.y / 100) * canvasHeight;
              const oPxW = (overlay.width / 100) * effectiveWidth;
              const oPxH = (overlay.height / 100) * canvasHeight;

              return (
                <div
                  key={overlay.id}
                  style={{
                    position: 'absolute',
                    left: oPxX,
                    top: oPxY,
                    width: oPxW,
                    height: oPxH,
                    zIndex: overlay.zIndex,
                    opacity: overlay.opacity,
                    pointerEvents: overlay.pointerEvents ? 'auto' : 'none',
                  }}
                  aria-hidden="true"
                >
                  <img
                    src={overlay.imageUrl}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'fill',
                      display: 'block',
                    }}
                    draggable={false}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        isOpen={lightboxOpen}
        media={media}
        currentIndex={currentIndex}
        onPrev={onPrev}
        onNext={onNext}
        onClose={onCloseLightbox}
        videoMaxWidth={settings.lightboxVideoMaxWidth}
        videoMaxWidthUnit={settings.lightboxVideoMaxWidthUnit}
        videoHeight={settings.lightboxVideoHeight}
        videoHeightUnit={settings.lightboxVideoHeightUnit}
        mediaMaxHeight={settings.lightboxMediaMaxHeight}
      />
    </Stack>
  );
}
