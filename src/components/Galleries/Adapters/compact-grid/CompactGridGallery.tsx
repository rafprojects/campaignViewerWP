/**
 * P12-C: Compact Grid Gallery Adapter
 *
 * Responsive flex-wrap grid with playing-card–proportioned media tiles
 * (configurable width/height, default 160×224 px — a 5:7 ratio).
 * Accepts a unified media array (images + videos). Image tiles open the
 * shared Portal-based Lightbox; video tiles show a play-button overlay
 * and also open in the lightbox (the lightbox handles both types).
 *
 * Registered as adapter id="compact-grid".
 *
 * P35-D: Listing-mode branch.
 * When `items` and `renderItem` are present the adapter renders arbitrary
 * items (e.g. campaign cards) using the card-grid geometry from `settings`.
 * The layout is byte-identical to the legacy CardGallery inline flex grid
 * under default settings.  Lightbox is not mounted in listing mode.
 */
import { useState, useCallback, useMemo } from 'react';
import { Box, Group, Stack, Title } from '@mantine/core';
import { IconLayoutGrid, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import type { ListingItem } from '../GalleryAdapter';
import type { ReactNode } from 'react';
import { toCss, toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { gridRowMaxWidthCss, resolveFixedCardWidth, formatGapCss, resolveListingColumns } from '@/utils/gridLayout';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from '../_shared/runtimeCommon';

function resolveCompactGridAspectRatio(settings: GalleryBehaviorSettings, cardWidth: number, itemScale: number): string {
  if (settings.gridCardAspectRatio && settings.gridCardAspectRatio !== 'auto') {
    return settings.gridCardAspectRatio.replace(':', ' / ');
  }

  const legacyCardHeight = Math.max(1, Math.round((settings.gridCardHeight ?? 224) * itemScale));
  return `${Math.max(1, cardWidth)} / ${legacyCardHeight}`;
}

/** Below this resolved pixel width, fixed-width cards fall back to the responsive branch. */
const MIN_FIXED_CARD_WIDTH_PX = 120;

interface CompactGridGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
  // P35-D: listing-mode fields (from GalleryAdapterProps)
  items?: ListingItem[];
  renderItem?: (item: ListingItem, index: number) => ReactNode;
  listingMode?: { surface: 'campaign-listing' };
}

export function CompactGridGallery({ media, settings, runtime, containerDimensions, items, renderItem }: CompactGridGalleryProps) {
  const isListingMode = !!(items && renderItem);

  // ── All hooks must be called unconditionally (Rules of Hooks) ─────────────

  // P12-C: media-mode hooks (used when isListingMode === false)
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  // useCallback hooks — must precede any early return (Rules of Hooks).
  const openAt = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLightboxOpen(true);
    },
    [setCurrentIndex],
  );
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  // P35-D: listing-mode layout computation
  const listingLayout = useMemo(() => {
    if (!isListingMode) return null;
    const containerWidth = containerDimensions?.width ?? 0;

    // Column count — shared helper covers gridCardMaxColumns → cardGridColumns → auto chain.
    const effectiveColumns = resolveListingColumns(settings, containerWidth);

    // Gap — mirrors CardGallery.effectiveGapH / cardGapV.
    const cardGapHUnit = settings.cardGapHUnit ?? 'px';
    const cardGapVUnit = settings.cardGapVUnit ?? 'px';
    const effectiveGapH = formatGapCss(settings.cardGapH ?? 16, cardGapHUnit, containerWidth, 4);
    const cardGapV = settings.cardGapV ?? 16;

    // Fixed vs. responsive card width — mirrors CardGallery.fixedCardWidth.
    const hasFixedCardWidth = (settings.cardMaxWidth ?? 0) > 0;
    const fixedCardWidth = hasFixedCardWidth
      ? resolveFixedCardWidth(
          settings.cardMaxWidth ?? 0,
          settings.cardMaxWidthUnit ?? 'px',
          settings.cardScale ?? 1,
          containerWidth,
          MIN_FIXED_CARD_WIDTH_PX,
        )
      : null;

    const responsiveCardWidth = effectiveColumns <= 1
      ? '100%'
      : `calc((100% - ${toCss((effectiveColumns - 1) * (settings.cardGapH ?? 16), cardGapHUnit)}) / ${effectiveColumns})`;

    // Container-level styles — byte-identical to the old CardGallery `card-gallery-grid` Box.
    const cardGridJustification = settings.cardJustifyContent || 'center';
    const cardGridVerticalAlign = settings.cardGalleryVerticalAlign || 'start';
    const cardGridMinHeight = settings.cardGalleryMinHeight ?? 0;
    const cardGridMaxHeight = settings.cardGalleryMaxHeight ?? 0;
    const cardGridOffsetX = settings.cardGalleryOffsetX ?? 0;
    const cardGridOffsetY = settings.cardGalleryOffsetY ?? 0;
    const cardGalleryOffsetXUnit = settings.cardGalleryOffsetXUnit ?? 'px';
    const cardGalleryOffsetYUnit = settings.cardGalleryOffsetYUnit ?? 'px';
    const cardGalleryMinHeightUnit = settings.cardGalleryMinHeightUnit ?? 'px';
    const cardGalleryMaxHeightUnit = settings.cardGalleryMaxHeightUnit ?? 'px';

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexWrap: 'wrap',
      gap: `${toCss(cardGapV, cardGapVUnit)} ${effectiveGapH}`,
      justifyContent: cardGridJustification,
      alignContent: cardGridVerticalAlign,
      width: '100%',
      ...(cardGridMinHeight > 0 ? { minHeight: toCssOrNumber(cardGridMinHeight, cardGalleryMinHeightUnit) } : {}),
      ...(cardGridMaxHeight > 0 ? { maxHeight: toCssOrNumber(cardGridMaxHeight, cardGalleryMaxHeightUnit), overflow: 'auto' as const } : {}),
      ...(cardGridOffsetX !== 0 || cardGridOffsetY !== 0
        ? { transform: `translate(${toCss(cardGridOffsetX, cardGalleryOffsetXUnit)}, ${toCss(cardGridOffsetY, cardGalleryOffsetYUnit)})` }
        : {}),
      ...(fixedCardWidth ? {
        maxWidth: gridRowMaxWidthCss(fixedCardWidth.value, fixedCardWidth.unit, effectiveColumns, effectiveGapH),
        marginInline: 'auto',
      } : {}),
    };

    return { fixedCardWidth, responsiveCardWidth, containerStyle };
  }, [isListingMode, containerDimensions, settings]);

  // ── P35-D: Listing-mode render (hooks already called above) ──────────────
  if (isListingMode && listingLayout) {
    return (
      <Box
        {...getWpsgDebugProps('CompactGridGallery', 'grid')}
        data-testid="card-gallery-grid"
        style={listingLayout.containerStyle}
      >
        {items!.map((item, idx) => {
          if (listingLayout.fixedCardWidth) {
            // Fixed-width mode: CampaignCard already carries its own maxWidth prop.
            return (
              <Box key={item.id} data-testid="card-fixed-wrapper">
                {renderItem!(item, idx)}
              </Box>
            );
          }
          // Responsive mode: the wrapper drives flex-basis so cards fill the row.
          return (
            <Box
              key={item.id}
              data-testid="card-responsive-wrapper"
              style={{
                flex: `0 0 ${listingLayout.responsiveCardWidth}`,
                maxWidth: listingLayout.responsiveCardWidth,
                minWidth: 0,
              }}
            >
              {renderItem!(item, idx)}
            </Box>
          );
        })}
      </Box>
    );
  }

  // ── P12-C: Media-mode render (original path) ──────────────────────────────

  const itemSc = settings.itemScale ?? 1;
  const cardWidth = Math.round((settings.gridCardWidth ?? 160) * itemSc);
  const cardWidthUnit = settings.gridCardWidthUnit ?? 'px';
  const aspectRatio = resolveCompactGridAspectRatio(settings, cardWidth, itemSc);
  const maxColumns = Math.max(0, Math.min(8, settings.gridCardMaxColumns ?? 0));
  const minCardHeight = Math.max(0, settings.gridCardMinHeight ?? 0);
  const borderRadius = toCssOrNumber(settings.imageBorderRadius, settings.imageBorderRadiusUnit);
  const gap = common.adapterItemGap ?? 16;
  const gapUnit = common.adapterItemGapUnit ?? 'px';
  const cardWidthCss = toCss(cardWidth, cardWidthUnit);
  const gridMaxWidth = maxColumns > 0
    ? `min(100%, ${gridRowMaxWidthCss(cardWidth, cardWidthUnit, maxColumns, toCss(gap, gapUnit))})`
    : undefined;

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack {...getWpsgDebugProps('CompactGridGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconLayoutGrid size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      {/* Flex-wrap grid — justify-content distributes items per-row, so
          partially filled last rows can be center/space-between/etc. */}
      <Box
        {...getWpsgDebugProps('CompactGridGallery', 'grid')}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          width: '100%',
          maxWidth: gridMaxWidth,
          marginInline: gridMaxWidth ? 'auto' : undefined,
          gap: toCss(gap, gapUnit),
          justifyContent: common.adapterJustifyContent || 'center',
        }}
      >
        {media.map((item, index) => (
          <Box
            key={item.id}
            style={{
              flexBasis: `min(${cardWidthCss}, calc(50% - ${toCss(gap / 2, gapUnit)}))`,
              maxWidth: cardWidthCss,
              minWidth: 0,
            }}
          >
            <GridCard
              item={item}
              index={index}
              aspectRatio={aspectRatio}
              minHeight={minCardHeight > 0 ? toCssOrNumber(minCardHeight, 'px') : undefined}
              borderRadius={item.type === 'video' ? toCssOrNumber(settings.videoBorderRadius, settings.videoBorderRadiusUnit) : borderRadius}
              onOpen={openAt}
            />
          </Box>
        ))}
      </Box>

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

setWpsgDebugDisplayName(CompactGridGallery, 'CompactGridGallery');

// ─── Internal card component ────────────────────────────────────────────────

interface GridCardProps {
  item: MediaItem;
  index: number;
  aspectRatio: string;
  minHeight?: number | string | undefined;
  borderRadius: number | string;
  onOpen: (index: number) => void;
}

function GridCard({ item, index, aspectRatio, minHeight, borderRadius, onOpen }: GridCardProps) {
  const [hovered, setHovered] = useState(false);
  const isVideo = item.type === 'video';
  const thumbSrc = item.thumbnail || item.url;
  const label = item.caption
    ? `${isVideo ? 'Play' : 'View'}: ${item.caption}`
    : `${isVideo ? 'Play' : 'View'} ${isVideo ? 'video' : 'image'} ${index + 1}`;

  return (
    <Box
      {...getWpsgDebugProps('CompactGridGallery', 'card')}
      component="button"
      onClick={() => onOpen(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      aria-label={label}
      style={{
        /* Layout */
        display: 'block',
        width: '100%',
        aspectRatio,
        minHeight,
        /* Reset button styles */
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        /* Card appearance */
        borderRadius,
        overflow: 'hidden',
        position: 'relative',
        background: 'var(--wpsg-color-surface, #1a1a2e)',
        /* Elevation + pop on hover */
        boxShadow: hovered
          ? '0 8px 24px rgba(0,0,0,0.35)'
          : '0 2px 6px rgba(0,0,0,0.15)',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        transition: 'transform 0.3s ease, box-shadow 0.25s ease',
      }}
    >
      {/* Cover thumbnail */}
      <LazyImage
        src={thumbSrc}
        alt={item.caption || ''}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Hover overlay — zoom icon for images, play icon for videos */}
      <Box
        style={{
          position: 'absolute',
          inset: 0,
          background: hovered ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0)',
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
            style={{
              opacity: hovered ? 1 : 0.6,
              transition: 'opacity 0.25s ease',
              filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.7))',
            }}
          />
        ) : (
          <IconZoomIn
            size={28}
            color="white"
            style={{
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.25s ease',
              filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))',
            }}
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
}

setWpsgDebugDisplayName(GridCard, 'GridCard');
