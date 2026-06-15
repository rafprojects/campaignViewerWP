/**
 * P50-D: Isotope / Filterable Grid Adapter  (adapter id = "isotope")
 *
 * CSS Grid layout with client-side filter controls (Chip buttons per media
 * type) and sort controls (Select by upload date / order). Layout transitions
 * are animated with a FLIP technique: item positions are snapshotted before
 * the state change and each item's offset is inverted post-layout, then
 * cancelled via a CSS transition so the eye perceives smooth movement.
 *
 * Filter chips only appear when the media set contains more than one type
 * (e.g. both images and videos), so a uniform-type gallery presents a clean
 * grid with only the sort control showing.
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Chip, Group, Select, Stack, Title } from '@mantine/core';
import { IconLayoutGrid, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import type {
  ContainerDimensions,
  GalleryBehaviorSettings,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCss, toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { useCarousel } from '@wp-super-gallery/shared-utils';
import { useLightbox } from '@wp-super-gallery/shared-utils';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import {
  resolveAdapterShellStyle,
  resolveGalleryComponentCommonSettings,
  resolveGalleryHeading,
} from '../_shared/runtimeCommon';

type SortOrder = 'default' | 'asc' | 'desc';

const TYPE_LABELS: Record<string, string> = {
  image: 'Images',
  video: 'Videos',
  other: 'Other',
};

function compareDateAsc(a: MediaItem, b: MediaItem): number {
  if (a.dateUploaded && b.dateUploaded) {
    return a.dateUploaded < b.dateUploaded ? -1 : a.dateUploaded > b.dateUploaded ? 1 : 0;
  }
  return a.order - b.order;
}

interface IsotopeAdapterProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function IsotopeAdapter({ media, settings, runtime }: IsotopeAdapterProps) {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');

  // ── Derived collections ────────────────────────────────────────────────────

  const filterValues = useMemo(
    () => [...new Set(media.map((m) => m.type))],
    [media],
  );
  const showFilter = filterValues.length > 1;

  const visibleItems = useMemo(() => {
    let items = activeFilter === 'all' ? media : media.filter((m) => m.type === activeFilter);
    if (sortOrder === 'asc') items = [...items].sort(compareDateAsc);
    if (sortOrder === 'desc') items = [...items].sort((a, b) => compareDateAsc(b, a));
    return items;
  }, [media, activeFilter, sortOrder]);

  // ── FLIP animation ─────────────────────────────────────────────────────────

  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const snapshotRects = useCallback(() => {
    const rects = new Map<string, DOMRect>();
    itemRefs.current.forEach((el, id) => {
      rects.set(id, el.getBoundingClientRect());
    });
    prevRectsRef.current = rects;
  }, []);

  const handleFilterChange = useCallback(
    (value: string) => {
      snapshotRects();
      setActiveFilter(value);
    },
    [snapshotRects],
  );

  const handleSortChange = useCallback(
    (value: string | null) => {
      snapshotRects();
      setSortOrder((value as SortOrder) ?? 'default');
    },
    [snapshotRects],
  );

  // After each render driven by filter/sort, play the FLIP transition for
  // items that were already visible and have moved to a new position.
  useLayoutEffect(() => {
    const newRects = new Map<string, DOMRect>();
    itemRefs.current.forEach((el, id) => {
      newRects.set(id, el.getBoundingClientRect());
    });

    itemRefs.current.forEach((el, id) => {
      const oldRect = prevRectsRef.current.get(id);
      const newRect = newRects.get(id);
      if (!oldRect || !newRect) return;

      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (dx === 0 && dy === 0) return; // no movement (also handles jsdom zeros)

      // Apply inverse transform instantly, then release to CSS transition.
      el.style.transition = 'none';
      el.style.transform = `translate(${dx}px, ${dy}px)`;

      requestAnimationFrame(() => {
        el.style.transition = 'transform 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
        el.style.transform = '';
      });
    });

    // Clear snapshot so a non-filter render doesn't replay stale positions.
    prevRectsRef.current = new Map();
  });

  // ── Lightbox ───────────────────────────────────────────────────────────────

  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const { isOpen: lightboxOpen, open: openLightbox, close: closeLightbox } = useLightbox({
    enableArrowNavigation: true,
    onPrev: prev,
    onNext: next,
  });

  const openAt = useCallback(
    (mediaIndex: number) => {
      setCurrentIndex(mediaIndex);
      openLightbox();
    },
    [setCurrentIndex, openLightbox],
  );

  // ── Layout settings ────────────────────────────────────────────────────────

  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);
  const adapterSizing = resolveAdapterShellStyle(common);

  const gap = common.adapterItemGap ?? 12;
  const gapUnit = common.adapterItemGapUnit ?? 'px';
  const gapCss = toCss(gap, gapUnit);

  const borderRadius = toCssOrNumber(settings.imageBorderRadius, settings.imageBorderRadiusUnit);
  const videoBorderRadius = toCssOrNumber(settings.videoBorderRadius, settings.videoBorderRadiusUnit);

  return (
    <Stack {...getWpsgDebugProps('IsotopeAdapter')} gap="md" style={adapterSizing}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconLayoutGrid size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      {/* Controls row */}
      <Group gap="sm" wrap="wrap" align="center">
        {showFilter && (
          <Chip.Group value={activeFilter} onChange={handleFilterChange}>
            <Group gap={6}>
              <Chip value="all" size="xs" variant="filled">All</Chip>
              {filterValues.map((type) => (
                <Chip key={type} value={type} size="xs" variant="filled">
                  {TYPE_LABELS[type] ?? type}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        )}
        <Select
          size="xs"
          value={sortOrder}
          onChange={handleSortChange}
          data={[
            { value: 'default', label: 'Default order' },
            { value: 'asc', label: 'Newest first' },
            { value: 'desc', label: 'Oldest first' },
          ]}
          style={{ width: 140 }}
          aria-label="Sort order"
        />
      </Group>

      {/* Grid */}
      <Box
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: gapCss,
        }}
      >
        {visibleItems.map((item) => {
          const mediaIndex = media.indexOf(item);
          const isVideo = item.type === 'video';
          const thumbSrc = item.thumbnail || item.url;
          const label = item.caption
            ? `${isVideo ? 'Play' : 'View'}: ${item.caption}`
            : `${isVideo ? 'Play' : 'View'} ${isVideo ? 'video' : 'image'} ${mediaIndex + 1}`;

          return (
            <Box
              key={item.id}
              ref={(el: HTMLButtonElement | null) => {
                if (el) {
                  itemRefs.current.set(item.id, el);
                } else {
                  itemRefs.current.delete(item.id);
                }
              }}
              component="button"
              onClick={() => openAt(mediaIndex)}
              aria-label={label}
              style={{
                display: 'block',
                aspectRatio: '4 / 3',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                borderRadius: isVideo ? videoBorderRadius : borderRadius,
                overflow: 'hidden',
                position: 'relative',
                background: 'var(--wpsg-color-surface, #1a1a2e)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <LazyImage
                src={thumbSrc}
                alt={item.caption || ''}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              {/* Hover overlay */}
              <Box
                className="wpsg-isotope-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.25s ease',
                  pointerEvents: 'none',
                }}
              >
                {isVideo ? (
                  <IconPlayerPlay
                    size={32}
                    color="white"
                    style={{ opacity: 0.7, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.7))' }}
                  />
                ) : (
                  <IconZoomIn
                    className="wpsg-isotope-zoom"
                    size={28}
                    color="white"
                    style={{ opacity: 0, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))', transition: 'opacity 0.25s ease' }}
                  />
                )}
              </Box>

              {/* Video badge */}
              {isVideo && (
                <Box
                  style={{
                    position: 'absolute',
                    top: 6,
                    left: 6,
                    background: OVERLAY_BG,
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    color: OVERLAY_TEXT,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    pointerEvents: 'none',
                  }}
                >
                  VIDEO
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      <style>{`
        .wpsg-isotope-overlay { transition: background 0.25s ease; }
        button:hover .wpsg-isotope-overlay { background: rgba(0,0,0,0.32) !important; }
        button:hover .wpsg-isotope-zoom { opacity: 1 !important; }
        @media (prefers-reduced-motion: reduce) {
          [ref] { transition: none !important; }
        }
      `}</style>

      <Lightbox
        isOpen={lightboxOpen}
        media={media}
        currentIndex={currentIndex}
        onPrev={prev}
        onNext={next}
        onClose={closeLightbox}
        videoMaxWidth={settings.lightboxVideoMaxWidth}
        videoMaxWidthUnit={settings.lightboxVideoMaxWidthUnit}
        videoHeight={settings.lightboxVideoHeight}
        videoHeightUnit={settings.lightboxVideoHeightUnit}
        mediaMaxHeight={settings.lightboxMediaMaxHeight}
      />
    </Stack>
  );
}

setWpsgDebugDisplayName(IsotopeAdapter, 'IsotopeAdapter');
