/**
 * Justified Rows Gallery Adapter  (adapter id = "justified")
 *
 * Flickr-style justified-rows layout: every row fills the full container
 * width while each image's aspect ratio is preserved. The row height
 * converges on `mosaicTargetRowHeight` via react-photo-album's row-packing
 * algorithm (the same one used by Flickr, Google Photos, 500px).
 *
 * Bug fixed vs original "mosaic" implementation: the custom render.button
 * was setting `display: 'block'` which turned the library's horizontal
 * flex-row into a vertical stack. The fix is simple — never override the
 * button's display property; let react-photo-album control it.
 *
 * P35-F: Listing-mode branch.
 * When `items` and `renderItem` are present the adapter renders arbitrary
 * items (e.g. campaign cards) using flex-stretch rows so cards expand to
 * fill each row — preserving the "justified" aesthetic for uniform items.
 * Lightbox and photo-album are not mounted in listing mode.
 */
import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { RowsPhotoAlbum } from 'react-photo-album';
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import { Box, Stack, Title, Group } from '@mantine/core';
import { IconLayoutRows, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import type { ListingItem } from '../GalleryAdapter';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { buildBoxShadowStyles } from '@/components/Galleries/Adapters/_shared/tileHoverStyles';
import { toCss, toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { resolveListingColumns } from '@/utils/gridLayout';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from '../_shared/runtimeCommon';

const SCOPE = 'justified';

interface RpaPhoto {
  src: string;
  width: number;
  height: number;
  key: string;
  item: MediaItem;
  alt?: string;
}

interface JustifiedGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
  // P35-F: listing-mode fields (from GalleryAdapterProps)
  items?: ListingItem[];
  renderItem?: (item: ListingItem, index: number) => ReactNode;
  listingMode?: { surface: 'campaign-listing' };
}

export function JustifiedGallery({ media, settings, runtime, containerDimensions, items, renderItem }: JustifiedGalleryProps) {
  // P35-F: listing-mode detection
  const isListingMode = !!(items && renderItem);

  // ── All hooks must be called unconditionally (Rules of Hooks) ─────────────

  // P12 / justified media-mode hooks
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const enriched = useMediaDimensions(media);
  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  // useCallback hooks — must precede any early return.
  const openAt = useCallback(
    (i: number) => { setCurrentIndex(i); setLightboxOpen(true); },
    [setCurrentIndex],
  );
  const close = useCallback(() => setLightboxOpen(false), []);

  // ── P35-F: Listing-mode render (hooks already called above) ───────────────
  // Flex-stretch rows: items expand to fill each row, creating the
  // "justified" appearance for campaign cards.
  if (isListingMode) {
    const containerWidth = containerDimensions?.width ?? 0;

    // Column count — shared helper covers gridCardMaxColumns → cardGridColumns → auto chain.
    const effectiveColumns = resolveListingColumns(settings, containerWidth);

    const gapH = settings.cardGapH ?? 16;
    const gapHUnit = settings.cardGapHUnit ?? 'px';
    const gapV = settings.cardGapV ?? 16;
    const gapVUnit = settings.cardGapVUnit ?? 'px';
    // flex-basis sets the minimum width for each item per the column count.
    // flex-grow:1 (no maxWidth cap) lets items stretch to fill any leftover
    // space in each row — the defining "justified" behaviour.
    // The last partial row also stretches; this is intentional for the
    // justified aesthetic (vs. compact-grid which left-aligns partial rows).
    const flexBasis = effectiveColumns <= 1
      ? '100%'
      : `calc((100% - ${toCss((effectiveColumns - 1) * gapH, gapHUnit)}) / ${effectiveColumns})`;

    return (
      <Box
        {...getWpsgDebugProps('JustifiedGallery', 'listing-grid')}
        data-testid="justified-listing-grid"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: `${toCss(gapV, gapVUnit)} ${toCss(gapH, gapHUnit)}`,
          width: '100%',
        }}
      >
        {items!.map((item, idx) => (
          <Box
            key={item.id}
            data-testid="justified-listing-item"
            style={{
              flex: `1 0 ${flexBasis}`,
              minWidth: 0,
            }}
          >
            {renderItem!(item, idx)}
          </Box>
        ))}
      </Box>
    );
  }

  // ── Justified media-mode render (original path) ───────────────────────────

  const gap = settings.thumbnailGap ?? 6;
  const itemSc = settings.itemScale ?? 1;
  const targetRowHeight = Math.round((settings.mosaicTargetRowHeight ?? 200) * itemSc);

  // Normalize all photos to a consistent reference height so large-resolution
  // images don't dominate the layout. react-photo-album uses width/height
  // ratios for row packing — absolute values don't matter, only ratios do.
  const normalizeHeight = settings.photoNormalizeHeight ?? 300;
  const photos: RpaPhoto[] = enriched.map((item) => {
    const ratio = item.width / item.height;
    return {
      src: item.thumbnail || item.url,
      width: Math.round(normalizeHeight * ratio),
      height: normalizeHeight,
      key: item.id,
      item,
      alt: item.caption || item.title || '',
    };
  });

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack {...getWpsgDebugProps('JustifiedGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconLayoutRows size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      <style>{buildBoxShadowStyles(SCOPE, settings)}</style>

      <RowsPhotoAlbum
        photos={photos}
        targetRowHeight={targetRowHeight}
        spacing={gap}
        rowConstraints={{ singleRowMaxHeight: Math.round(targetRowHeight * 1.5) }}
        onClick={({ index }) => openAt(index)}
        render={{
          // ⚠ CRITICAL: never set display here — it breaks the flex-row layout.
          // Only set overflow/radius/position which do not affect the layout flow.
          button({ style, className, ...props }, { photo }) {
            const isVideo = (photo as RpaPhoto).item.type === 'video';
            const borderRadius = toCssOrNumber(
              isVideo ? settings.videoBorderRadius : settings.imageBorderRadius,
              (isVideo ? settings.videoBorderRadiusUnit : settings.imageBorderRadiusUnit) ?? 'px',
            );

            return (
              <button
                {...props}
                {...getWpsgDebugProps('JustifiedGallery', 'tile')}
                className={`wpsg-tile-${SCOPE} ${className ?? ''}`}
                style={{
                  ...style,
                  overflow: 'hidden',
                  borderRadius,
                  position: 'relative',
                  border: settings.tileBorderWidth
                    ? `${settings.tileBorderWidth}px solid ${settings.tileBorderColor}`
                    : undefined,
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
                }}
              />
            );
          },
          image({ style: imgStyle, ...imgProps }) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return <LazyImage {...(imgProps as any)} {...(imgStyle !== undefined ? { style: imgStyle } : {})} />;
          },
          extras(_cls, { photo, width, height }) {
            const p = photo as RpaPhoto;
            const isVideo = p.item.type === 'video';
            const borderRadius = toCssOrNumber(
              isVideo ? settings.videoBorderRadius : settings.imageBorderRadius,
              (isVideo ? settings.videoBorderRadiusUnit : settings.imageBorderRadiusUnit) ?? 'px',
            );
            const iconSize = Math.max(20, Math.min(width, height) * 0.2);
            return (
              <Box
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius }}
                className="wpsg-jus-overlay"
              >
                <Box
                  className="wpsg-jus-icon-wrap"
                  style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  {isVideo
                    ? <IconPlayerPlay size={iconSize} color="white"
                      style={{ opacity: 0.8, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                    : <IconZoomIn size={iconSize} color="white"
                      className="wpsg-jus-zoom"
                      style={{
                        opacity: 0, transition: 'opacity 0.2s ease',
                        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))'
                      }} />
                  }
                </Box>
                {isVideo && (
                  <Box style={{
                    position: 'absolute', top: 5, left: 5,
                    background: OVERLAY_BG, borderRadius: 4,
                    padding: '2px 5px', fontSize: 10, color: OVERLAY_TEXT, fontWeight: 600,
                  }}>VIDEO</Box>
                )}
              </Box>
            );
          },
        }}
      />

      {/* Hover UI — must live in shadow DOM, so we use an inline <style> here */}
      <style>{`
        .react-photo-album--button:hover .wpsg-jus-icon-wrap {
          background: rgba(0,0,0,0.28) !important;
        }
        .react-photo-album--button:hover .wpsg-jus-zoom {
          opacity: 1 !important;
        }
      `}</style>

      <Lightbox isOpen={lightboxOpen} media={media} currentIndex={currentIndex}
        onPrev={prev} onNext={next} onClose={close}
        videoMaxWidth={settings.lightboxVideoMaxWidth} videoMaxWidthUnit={settings.lightboxVideoMaxWidthUnit}
        videoHeight={settings.lightboxVideoHeight} videoHeightUnit={settings.lightboxVideoHeightUnit}
        mediaMaxHeight={settings.lightboxMediaMaxHeight} />
    </Stack>
  );
}

setWpsgDebugDisplayName(JustifiedGallery, 'JustifiedGallery');