/**
 * P15-E.1–E.4: Layout Builder Gallery Adapter
 *
 * Renders media in an absolutely positioned layout defined by a
 * LayoutTemplate. Each slot is a positioned `<div>` with clip-path,
 * border, and object-fit matching the slot definition.
 *
 * Features:
 * - Uses `useLayoutTemplate()` query hook + public endpoint (no auth).
 * - `assignMediaToSlots()` for media→slot assignment.
 * - Per-slot hover effects via `buildTileStyles()` + `buildBoxShadowStyles()`.
 * - Lightbox integration via `useCarousel` + `<Lightbox>`.
 * - Empty-slot placeholders (gray dashed, non-interactive).
 * - Slot count mismatch warning.
 *
 * Adapter ID: `'layout-builder'`
 */
import React, { useId, useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import type { ListingItem } from '@/components/Galleries/Adapters/GalleryAdapter';
import { useRecordAnalyticsEvent } from '@/hooks/useRecordAnalyticsEvent';
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
import { useCarousel } from '@wp-super-gallery/shared-utils';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { assignMediaToSlots, resolveSlotWithOverrides, resolveSlotForBreakpoint, containerWidthToBreakpoint } from '@/utils/layoutSlotAssignment';
import { buildSlotEntranceCss, entranceKeyframeName, ENTRANCE_MARKER_CLASS, REVEAL_CLASS } from '@/utils/slotEntrance';
import { buildTileStyles, buildBoxShadowStyles } from '@/components/Galleries/Adapters/_shared/tileHoverStyles';
import { getClipPath, usesClipPath } from '@/utils/clipPath';
import { buildGradientCss, templateToGradientOpts } from '@wp-super-gallery/shared-utils';
import { computeBreakpointBand } from '@wp-super-gallery/shared-utils';
import { buildFilterCss, getBlendModeCss, buildOverlayBg } from '@wp-super-gallery/shared-utils';
import { useFeatheredMask } from '@/hooks/useFeatheredMask';
import { GraphicLayerContent } from '@/components/Admin/LayoutBuilder/GraphicLayerContent';
import { useViewportHeight } from '@wp-super-gallery/shared-utils';
import { sanitizeCssUrl, toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from '../_shared/runtimeCommon';

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

// ── Slot CSS class helpers ────────────────────────────────────────────────────

function slotCssClass(instanceId: string, slotId: string): string {
  return `wpsg-lb-slot-${instanceId}-${slotId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
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
  /** CSS class name carrying position/size rules (injected via <style> in parent). */
  positionClassName: string;
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
  positionClassName,
}: GallerySlotViewProps) {
  const { t } = useTranslation('wpsg');
  // Px dimensions (used for mask position computation)
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
  // P58-E: marker class the IntersectionObserver queries to drive the reveal.
  const entranceClass = slot.entranceAnimation ? ENTRANCE_MARKER_CLASS : '';

  if (!assigned) {
    // E.4: Empty slot — gray dashed placeholder, non-interactive
    return (
      <div
        className={[positionClassName, entranceClass].filter(Boolean).join(' ')}
        style={{
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
          {t('gallery_empty_slot', 'Empty')}
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
      ? t('layout_view_in_lightbox', 'View {{title}} in lightbox', { title: assigned.title || t('layout_media_fallback', 'media') })
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
      opacity: slot.opacity ?? 1,
      cursor: isClickable ? 'pointer' : 'default',
      filter: mergedFilter,
      transition: needsInlineGlow ? 'filter 0.25s ease' : undefined,
      mixBlendMode: (blendCss as React.CSSProperties['mixBlendMode']) || undefined,
    };
    const outerClassName = [positionClassName, hoverClass, entranceClass].filter(Boolean).join(' ');
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
      <TiltWrapper tilt={slot.tilt} className={outerClassName} style={outerStyle} {...interactionProps} {...glowHandlers}>
        {clipContent}
      </TiltWrapper>
    ) : (
      <div className={outerClassName} style={outerStyle} {...interactionProps} {...glowHandlers}>
        {clipContent}
      </div>
    );
  }

  // Rectangle slots
  const rectStyle: React.CSSProperties = {
    opacity: slot.opacity ?? 1,
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
  const rectClassName = [positionClassName, hoverClass, entranceClass].filter(Boolean).join(' ');
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
    <TiltWrapper tilt={slot.tilt} className={rectClassName} style={rectStyle} {...interactionProps}>
      {rectContent}
    </TiltWrapper>
  ) : (
    <div className={rectClassName} style={rectStyle} {...interactionProps}>
      {rectContent}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface LayoutBuilderGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  /** Campaign layout template ID (from campaign.layoutTemplateId). Required in media mode; omit in listing mode (read from settings.campaignListingLayoutTemplateId). */
  templateId?: string;
  /** Per-campaign slot overrides (media binding, focal point). */
  slotOverrides?: CampaignLayoutBinding['slotOverrides'];
  /** When true, show admin-level assignment info banners. */
  isAdmin?: boolean;
  /** Measured container dimensions from GallerySectionWrapper. */
  containerDimensions?: ContainerDimensions;
  /** Campaign ID used to fire lightbox_open analytics events. */
  campaignId?: string;
  /** API client for recording analytics events. */
  apiClient?: ApiClient | undefined;
  // P37-LB: listing-mode fields (from GalleryAdapterProps contract)
  items?: ListingItem[];
  renderItem?: (item: ListingItem, index: number) => ReactNode;
  listingMode?: { surface: 'campaign-listing' };
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
  campaignId,
  apiClient,
  items,
  renderItem,
  listingMode,
}: LayoutBuilderGalleryProps) {
  const { t } = useTranslation('wpsg');
  const isListingMode = !!(items && renderItem && listingMode);
  const effectiveTemplateId = isListingMode
    ? (settings.campaignListingLayoutTemplateId ?? '')
    : (templateId ?? '');
  const { template, isLoading, error } = useLayoutTemplate(effectiveTemplateId);

  // Lightbox state — navigates the full media array
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const recordEvent = useRecordAnalyticsEvent(apiClient);

  const openAt = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLightboxOpen(true);
      const item = media[index];
      if (item && campaignId) {
        recordEvent(campaignId, 'lightbox_open', item.id);
      }
    },
    [setCurrentIndex, media, campaignId, recordEvent],
  );
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  // ── Loading / Error states ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Center py="xl" mih={200}>
        <Stack align="center" gap="xs">
          <Loader size="md" aria-label={t('layout_loading_aria', 'Loading layout template')} />
          <Text size="sm" c="dimmed">{t('layout_loading_text', 'Loading gallery…')}</Text>
        </Stack>
      </Center>
    );
  }

  if (error || !template) {
    return (
      <Stack align="center" gap="xs" py="xl">
        <IconAlertTriangle size={32} color="var(--mantine-color-yellow-6)" />
        <Text size="sm" c="dimmed">
          {error ?? t('layout_not_found', 'Layout template not found')}
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
      isListingMode={isListingMode}
      items={items}
      renderItem={renderItem}
    />
  );
}

// ── Inner renderer (only mounts when template is loaded) ─────────────────────

interface InnerProps {
  template: LayoutTemplate;
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime | undefined;
  slotOverrides: CampaignLayoutBinding['slotOverrides'];
  isAdmin: boolean;
  lightboxOpen: boolean;
  currentIndex: number;
  onOpenAt: (index: number) => void;
  onCloseLightbox: () => void;
  onNext: () => void;
  onPrev: () => void;
  // P37-LB
  isListingMode: boolean;
  items: ListingItem[] | undefined;
  renderItem: ((item: ListingItem, index: number) => ReactNode) | undefined;
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
  isListingMode,
  items,
  renderItem,
}: InnerProps) {
  const { t } = useTranslation('wpsg');
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const viewportHeight = useViewportHeight();
  // Stable per-instance ID for scoping slot position CSS (prevents collisions when
  // the same template is mounted more than once on a page).
  const rawInstanceId = useId();
  const instanceId = rawInstanceId.replace(/[^a-zA-Z0-9]/g, '');
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

  // ── P58-B: Active breakpoint for per-breakpoint slot overrides ───────────────
  // Prefer the runtime breakpoint resolved by the host gallery section — it is the
  // SAME signal that decided this adapter should render, so overrides stay in sync
  // with adapter selection. Fall back to the locally-measured container width only
  // when there is no runtime (e.g. standalone/preview usage).
  const activeBreakpoint = useMemo(
    () => runtime?.breakpoint ?? containerWidthToBreakpoint(containerWidth || 9999),
    [runtime?.breakpoint, containerWidth],
  );

  // ── Media assignment (skipped in listing mode) ────────────────────────────
  const { assignments, summary } = useMemo(
    () => isListingMode
      ? { assignments: new Map<string, MediaItem | undefined>(), summary: { kept: [], cleared: [], autoFilled: [], empty: [] } }
      : assignMediaToSlots(template, media, slotOverrides),
    [isListingMode, template, media, slotOverrides],
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

  // ── P58-B: Publish a non-desktop breakpoint at the actual device width ──────
  // Tablet/mobile render only the centered device-width band (full-height slice) of the
  // design canvas, scaled to fill the container — matching the builder's band guide.
  // Slots stay percentages of the design canvas (no coordinate remap); only the wrapper
  // crops + scales. The design width mirrors the builder's clamped canvas so coordinates
  // agree between the two.
  const isBpCropped = activeBreakpoint !== 'desktop';
  const designWidth = Math.max(400, Math.min(1200, template.canvasMaxWidth || 1200));
  const designHeight =
    template.canvasHeightMode === 'fixed-vh'
      ? viewportHeight * ((template.canvasHeightVh || 50) / 100)
      : designWidth / (template.canvasAspectRatio || 16 / 9);
  const breakpointPx = activeBreakpoint === 'tablet' ? 768 : 390;
  const band = isBpCropped
    ? computeBreakpointBand(designWidth, designHeight, breakpointPx, containerWidth)
    : null;
  // Inner-canvas dimensions slots are positioned against.
  const canvasW = isBpCropped ? designWidth : finalCanvasWidth;
  const canvasH = isBpCropped ? designHeight : canvasHeight;

  // ── Hover styles ──────────────────────────────────────────────────────────
  // Two sets — drop-shadow for clip-path shapes (on wrapper div), box-shadow for rectangles.
  const hoverStylesCss = useMemo(() => {
    const dropShadow = buildTileStyles({ scope: 'lb', settings });
    const boxShadow = buildBoxShadowStyles('lb-rect', settings);
    return dropShadow + '\n' + boxShadow;
  }, [settings]);

  // ── Slot position CSS ─────────────────────────────────────────────────────
  // Extracts position/size from per-element inline styles into a single injected
  // <style> block, improving DevTools inspectability.
  const slotPositionCss = useMemo(() => {
    return template.slots.map((rawSlot) => {
      // P58-B: resolve per-breakpoint geometry overrides before computing CSS.
      const slot = resolveSlotForBreakpoint(rawSlot, template, activeBreakpoint);
      if (slot.visible === false) {
        return `.${slotCssClass(instanceId, slot.id)}{display:none}`;
      }
      const pxX = (slot.x / 100) * canvasW;
      const pxY = (slot.y / 100) * canvasH;
      const pxW = (slot.width / 100) * canvasW;
      const pxH = (slot.height / 100) * canvasH;
      // Expose rotation as a custom property too, so the shared hover-bounce
      // keyframes compose it instead of overwriting the angle on hover (B-7).
      const rotCss = slot.rotation
        ? `;transform:rotate(${slot.rotation}deg);transform-origin:center center;--wpsg-slot-rot:${slot.rotation}deg`
        : '';
      const opacityCss = slot.opacity !== undefined && slot.opacity !== 1 ? `;opacity:${slot.opacity}` : '';
      return `.${slotCssClass(instanceId, slot.id)}{position:absolute;left:${pxX}px;top:${pxY}px;width:${pxW}px;height:${pxH}px;z-index:${slot.zIndex}${rotCss}${opacityCss}}`;
    }).join('\n');
  }, [template, activeBreakpoint, canvasW, canvasH, instanceId]);

  // ── Slot entrance-animation CSS (P58-E) ───────────────────────────────────
  // Per-slot keyframes + hidden/revealed states; an IntersectionObserver (below)
  // adds REVEAL_CLASS when the slot scrolls into view. Composes slot rotation.
  const slotEntranceCss = useMemo(() => {
    return template.slots
      .filter((slot) => slot.entranceAnimation)
      .map((slot) => buildSlotEntranceCss({
        className: slotCssClass(instanceId, slot.id),
        keyframeName: entranceKeyframeName(instanceId, slot.id),
        anim: slot.entranceAnimation!,
        rotationDeg: slot.rotation ?? 0,
      }))
      .join('\n');
  }, [template.slots, instanceId]);

  // Reveal animated slots on first viewport entry (one-shot). Falls back to
  // revealing everything immediately when IntersectionObserver is unavailable.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !slotEntranceCss) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>(`.${ENTRANCE_MARKER_CLASS}`));
    if (targets.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      targets.forEach((tEl) => tEl.classList.add(REVEAL_CLASS));
      return;
    }
    const io = new IntersectionObserver((entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add(REVEAL_CLASS);
          obs.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    targets.forEach((tEl) => io.observe(tEl));
    return () => io.disconnect();
  }, [slotEntranceCss]);

  // ── Slot-count mismatch warning ───────────────────────────────────────────
  const slotCount = template.slots.length;
  const mediaCount = media.length;
  const hasMismatch = slotCount !== mediaCount;
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack {...getWpsgDebugProps('LayoutBuilderGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {/* Hover and slot position styles injected into DOM */}
      <style>{hoverStylesCss}</style>
      <style>{slotPositionCss}</style>
      {slotEntranceCss && <style>{slotEntranceCss}</style>}

      {/* Header */}
      {heading.visible && (
        <Text size="sm" fw={500} component="div" ta={common.galleryLabelJustification || 'left'}>
          <Box component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {common.showGalleryLabelIcon && <IconLayoutDashboard size={16} />}
            {heading.label}
          </Box>
        </Text>
      )}

      {/* Mismatch warning — admin/editor only (B-8); never shown to public viewers */}
      {!isListingMode && isAdmin && hasMismatch && (
        <Box
          {...getWpsgDebugProps('LayoutBuilderGallery', 'mismatch-warning')}
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
            ? t('layout_media_overflow', '{{count}} media item(s) have no slot — they won\'t be displayed.', { count: mediaCount - slotCount })
            : t('layout_slot_overflow', '{{count}} slot(s) have no media — they\'ll appear as placeholders.', { count: slotCount - mediaCount })}
        </Box>
      )}

      {/* Admin: slot assignment summary — only relevant in media mode */}
      {!isListingMode && isAdmin && (summary.cleared.length > 0 || summary.empty.length > 0) && (
        <Box
          {...getWpsgDebugProps('LayoutBuilderGallery', 'assignment-summary')}
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
            <strong>{t('layout_assignment_info', 'Slot assignment info')}</strong>
            {summary.kept.length > 0 && (
              <div>
                {t('layout_kept_bindings', 'Kept bindings: {{summary}}', { summary: summary.kept.map((k) => `slot ${k.slotIndex} \u2192 ${k.mediaTitle}`).join(', ') })}
              </div>
            )}
            {summary.cleared.length > 0 && (
              <div>
                {t('layout_cleared_bindings', 'Cleared (media not in campaign): {{summary}}', { summary: summary.cleared.map((c) => `slot ${c.slotIndex}`).join(', ') })}
              </div>
            )}
            {summary.autoFilled.length > 0 && (
              <div>
                {t('layout_auto_filled', 'Auto-filled from remaining media: {{summary}}', { summary: summary.autoFilled.map((a) => `slot ${a.slotIndex} \u2192 ${a.mediaTitle}`).join(', ') })}
              </div>
            )}
            {summary.empty.length > 0 && (
              <div>
                {t('layout_empty_slots', 'Empty (no media remaining): slot{{suffix}} {{summary}}', { suffix: summary.empty.length > 1 ? 's' : '', summary: summary.empty.join(', ') })}
              </div>
            )}
          </div>
        </Box>
      )}

      {/* Canvas container */}
      <div
        {...getWpsgDebugProps('LayoutBuilderGallery', 'canvas-shell')}
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: band ? undefined : (maxW || undefined),
          overflowX: band ? 'hidden' : 'auto',
        }}
      >
        {containerWidth > 0 && (() => {
          // P58-B: tablet/mobile render the centered device band cropped+scaled inside a
          // fixed-height window; desktop renders the canvas inline as before.
          const radiusCss = toCssOrNumber(settings.imageBorderRadius || 0, settings.imageBorderRadiusUnit ?? 'px');
          const canvasEl = (
            <div
              {...getWpsgDebugProps('LayoutBuilderGallery', 'canvas')}
              style={{
                position: band ? 'absolute' : 'relative',
                width: canvasW,
                height: canvasH,
                backgroundColor:
                  (template.backgroundMode ?? 'color') === 'color'
                    ? (template.backgroundColor || '#000')
                    : (template.backgroundMode === 'none' ? 'transparent' : undefined),
                background:
                  (template.backgroundMode ?? 'color') === 'gradient'
                    ? buildGradientCss(templateToGradientOpts(template)) ?? 'transparent'
                    : undefined,
                overflow: 'hidden',
                borderRadius: band ? undefined : radiusCss,
                ...(band
                  ? { top: 0, left: -band.bandLeftPx * band.scale, transform: `scale(${band.scale})`, transformOrigin: 'top left' }
                  : { margin: '0 auto' }),
              }}
              role="img"
              aria-label={t('layout_canvas_aria', 'Layout gallery: {{name}}', { name: template.name })}
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
            {template.slots.map((rawSlot, slotIndex) => {
              // P37-LB: listing mode — each slot is a positioned container for renderItem
              if (isListingMode) {
                if (slotIndex >= (items?.length ?? 0)) return null;
                const item = items![slotIndex];
                if (!item) return null;
                const listingSlotClass = slotCssClass(instanceId, rawSlot.id);
                const containerStyle: React.CSSProperties = {
                  opacity: rawSlot.opacity ?? 1,
                  borderRadius: rawSlot.borderRadius || undefined,
                  border: rawSlot.borderWidth > 0
                    ? `${rawSlot.borderWidth}px solid ${rawSlot.borderColor}`
                    : undefined,
                  overflow: 'hidden',
                  filter: buildFilterCss(rawSlot.filterEffects, rawSlot.shadow) || undefined,
                  mixBlendMode: (getBlendModeCss(rawSlot.blendMode) as React.CSSProperties['mixBlendMode']) || undefined,
                };
                if (rawSlot.tilt?.enabled) {
                  return (
                    <TiltWrapper key={rawSlot.id} className={listingSlotClass} tilt={rawSlot.tilt} style={containerStyle}>
                      {renderItem!(item, slotIndex)}
                    </TiltWrapper>
                  );
                }
                return (
                  <div key={rawSlot.id} className={listingSlotClass} style={containerStyle}>
                    {renderItem!(item, slotIndex)}
                  </div>
                );
              }

              // Media mode — identity-based slot rendering.
              // P58-B: apply breakpoint geometry override, then campaign override (media/position).
              const bpSlot = resolveSlotForBreakpoint(rawSlot, template, activeBreakpoint);
              if (bpSlot.visible === false) return null;
              const slot = resolveSlotWithOverrides(bpSlot, slotOverrides);
              const assigned = assignments.get(slot.id);
              return (
                <GallerySlotView
                  key={slot.id}
                  slot={slot}
                  assigned={assigned}
                  effectiveWidth={canvasW}
                  canvasHeight={canvasH}
                  onOpenAt={onOpenAt}
                  mediaIndexMap={mediaIndexMap}
                  glowColor={slot.glowColor || settings.tileGlowColor || '#7c9ef8'}
                  glowSpread={slot.glowSpread ?? settings.tileGlowSpread ?? 12}
                  positionClassName={slotCssClass(instanceId, slot.id)}
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

              const oPxX = (overlay.x / 100) * canvasW;
              const oPxY = (overlay.y / 100) * canvasH;
              const oPxW = (overlay.width / 100) * canvasW;
              const oPxH = (overlay.height / 100) * canvasH;

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
                  <GraphicLayerContent
                    layer={overlay}
                    pixelWidth={oPxW}
                    pixelHeight={oPxH}
                  />
                </div>
              );
            })}
            </div>
          );
          return band ? (
            <div
              {...getWpsgDebugProps('LayoutBuilderGallery', 'canvas-window')}
              style={{
                position: 'relative',
                width: '100%',
                height: band.windowHeightPx,
                overflow: 'hidden',
                borderRadius: radiusCss,
                margin: '0 auto',
              }}
            >
              {canvasEl}
            </div>
          ) : canvasEl;
        })()}
      </div>

      {/* Lightbox — not used in listing mode (card owns click) */}
      {!isListingMode && (
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
      )}
    </Stack>
  );
}

setWpsgDebugDisplayName(LayoutBuilderGallery, 'LayoutBuilderGallery');