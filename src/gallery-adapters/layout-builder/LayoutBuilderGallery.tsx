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
import type { GalleryBehaviorSettings, MediaItem, LayoutTemplate, CampaignLayoutBinding } from '@/types';
import { useLayoutTemplate } from '@/hooks/useLayoutTemplate';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { LazyImage } from '@/components/Gallery/LazyImage';
import { assignMediaToSlots, resolveSlotWithOverrides } from '@/utils/layoutSlotAssignment';
import { buildTileStyles, buildBoxShadowStyles } from '@/gallery-adapters/_shared/tileHoverStyles';
import { getClipPath, usesClipPath } from '@/utils/clipPath';

// ── Props ────────────────────────────────────────────────────────────────────

export interface LayoutBuilderGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  /** Campaign layout template ID (from campaign.layoutTemplateId). */
  templateId: string;
  /** Per-campaign slot overrides (media binding, focal point). */
  slotOverrides?: CampaignLayoutBinding['slotOverrides'];
  /** When true, show admin-level assignment info banners. */
  isAdmin?: boolean;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LayoutBuilderGallery({
  media,
  settings,
  templateId,
  slotOverrides = {},
  isAdmin = false,
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
  const canvasHeight = effectiveWidth / (template.canvasAspectRatio || 16 / 9);

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

  return (
    <Stack gap="md">
      {/* Hover styles injected into DOM */}
      <style>{hoverStylesCss}</style>

      {/* Header */}
      <Text size="sm" fw={500} component="div">
        <Box component="span" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconLayoutDashboard size={16} />
          Layout Gallery ({mediaCount})
        </Box>
      </Text>

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
      {isAdmin && (summary.cleared.length > 0 || summary.autoFilled.length > 0 || summary.empty.length > 0) && (
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
        style={{ width: '100%', maxWidth: maxW || undefined }}
      >
        {containerWidth > 0 && (
          <div
            style={{
              position: 'relative',
              width: effectiveWidth,
              height: canvasHeight,
              backgroundColor: template.backgroundColor || '#000',
              overflow: 'hidden',
              borderRadius: settings.imageBorderRadius || 0,
              margin: '0 auto',
            }}
            role="img"
            aria-label={`Layout gallery: ${template.name}`}
          >
            {template.slots.map((rawSlot) => {
              const slot = resolveSlotWithOverrides(rawSlot, slotOverrides);
              const assigned = assignments.get(slot.id);

              // Px positions from percentages
              const pxX = (slot.x / 100) * effectiveWidth;
              const pxY = (slot.y / 100) * canvasHeight;
              const pxW = (slot.width / 100) * effectiveWidth;
              const pxH = (slot.height / 100) * canvasHeight;
              const clipPath = getClipPath(slot);
              const maskStyle = slot.maskUrl
                ? {
                    WebkitMaskImage: `url(${slot.maskUrl})`,
                    maskImage: `url(${slot.maskUrl})`,
                    WebkitMaskSize: 'cover',
                    maskSize: 'cover',
                  } as React.CSSProperties
                : {};

              if (!assigned) {
                // E.4: Empty slot — gray dashed placeholder, non-interactive
                return (
                  <div
                    key={slot.id}
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

              // Choose hover class — drop-shadow for clip-path (on wrapper),
              // box-shadow for rectangles (direct).
              const hoverClass =
                slot.hoverEffect !== 'none'
                  ? usesClipPath(slot)
                    ? 'wpsg-tile-lb'
                    : 'wpsg-tile-lb-rect'
                  : '';

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

              // Clip-path shapes: outer wrapper gets hover filter (drop-shadow),
              // inner div gets clip-path so the shadow isn't clipped away.
              if (clipPath) {
                return (
                  <div
                    key={slot.id}
                    className={hoverClass}
                    style={{
                      position: 'absolute',
                      left: pxX,
                      top: pxY,
                      width: pxW,
                      height: pxH,
                      zIndex: slot.zIndex,
                      cursor: isClickable ? 'pointer' : 'default',
                    }}
                    {...interactionProps}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        clipPath,
                        ...maskStyle,
                        border:
                          slot.borderWidth > 0
                            ? `${slot.borderWidth}px solid ${slot.borderColor}`
                            : undefined,
                        overflow: 'hidden',
                      }}
                    >
                      {slotMedia}
                    </div>
                  </div>
                );
              }

              // Rectangle slots: box-shadow works directly on the element.
              return (
                <div
                  key={slot.id}
                  className={hoverClass}
                  style={{
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
                  }}
                  {...interactionProps}
                >
                  {slotMedia}
                </div>
              );
            })}

            {/* Overlay layers (P15-H) — rendered above all slots */}
            {template.overlays.map((overlay) => {
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
                      objectFit: 'contain',
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
      />
    </Stack>
  );
}
