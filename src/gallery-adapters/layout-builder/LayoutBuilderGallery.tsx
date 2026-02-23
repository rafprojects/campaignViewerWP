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
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Center, Loader, Text, Stack } from '@mantine/core';
import { IconLayoutDashboard, IconAlertTriangle } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem, LayoutSlot, LayoutTemplate, CampaignLayoutBinding } from '@/types';
import { useLayoutTemplate } from '@/hooks/useLayoutTemplate';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { LazyImage } from '@/components/Gallery/LazyImage';
import { assignMediaToSlots, resolveSlotWithOverrides } from '@/utils/layoutSlotAssignment';
import { buildTileStyles, buildBoxShadowStyles } from '@/gallery-adapters/_shared/tileHoverStyles';

// ── Shape clip-paths ─────────────────────────────────────────────────────────

function getClipPath(slot: LayoutSlot): string | undefined {
  switch (slot.shape) {
    case 'circle':
      return 'circle(50% at 50% 50%)';
    case 'ellipse':
      return 'ellipse(50% 50% at 50% 50%)';
    case 'hexagon':
      return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
    case 'diamond':
      return 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
    case 'custom':
      return slot.clipPath || undefined;
    case 'rectangle':
    default:
      return undefined;
  }
}

/** True when clip-path is used — needs drop-shadow instead of box-shadow for glow. */
function usesClipPath(slot: LayoutSlot): boolean {
  return slot.shape !== 'rectangle';
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface LayoutBuilderGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  /** Campaign layout template ID (from campaign.layoutTemplateId). */
  templateId: string;
  /** Per-campaign slot overrides (media binding, focal point). */
  slotOverrides?: CampaignLayoutBinding['slotOverrides'];
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LayoutBuilderGallery({
  media,
  settings,
  templateId,
  slotOverrides = {},
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
      <Center py="xl">
        <Loader size="lg" aria-label="Loading layout template" />
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
  const assignments = useMemo(
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
  // We generate two sets — drop-shadow for clip-path shapes, box-shadow for rectangles
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

              // Choose hover class — clip-path shapes use drop-shadow, rectangles use box-shadow
              const hoverClass =
                slot.hoverEffect !== 'none'
                  ? usesClipPath(slot)
                    ? 'wpsg-tile-lb'
                    : 'wpsg-tile-lb-rect'
                  : '';

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
                    clipPath,
                    borderRadius: slot.shape === 'rectangle' ? slot.borderRadius : undefined,
                    border:
                      slot.borderWidth > 0
                        ? `${slot.borderWidth}px solid ${slot.borderColor}`
                        : undefined,
                    cursor: isClickable ? 'pointer' : 'default',
                    overflow: 'hidden',
                  }}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  aria-label={
                    isClickable
                      ? `View ${assigned.title || 'media'} in lightbox`
                      : undefined
                  }
                  onClick={isClickable ? () => onOpenAt(lightboxIndex) : undefined}
                  onKeyDown={
                    isClickable
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onOpenAt(lightboxIndex);
                          }
                        }
                      : undefined
                  }
                >
                  {assigned.type === 'video' ? (
                    // Video thumbnail with play indicator
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
                  )}
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
