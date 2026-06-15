/**
 * Hexagonal Gallery Adapter  (adapter id = "hexagonal")
 *
 * Honeycomb layout: pointy-top hexagonal tiles in offset rows.
 * Uses ResizeObserver to calculate how many tiles fit per row, then
 * renders rows with alternating half-width horizontal offsets and a
 * controlled vertical overlap to produce the classic honeycomb pattern.
 *
 * Tile size, gap, border, glow and hover-bounce are all configurable
 * via the shared gallery settings.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, Stack, Title, Group, Text } from '@mantine/core';
import { IconHexagon, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCss, toCssOrNumber } from '@wp-super-gallery/shared-utils';
import { useCarousel } from '@wp-super-gallery/shared-utils';
import { Lightbox } from '@wp-super-gallery/shared-ui';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { buildTileStyles } from '@/components/Galleries/Adapters/_shared/tileHoverStyles';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from '../_shared/runtimeCommon';
import { resolveTileGridLayout } from '@wp-super-gallery/shared-utils';

const SCOPE = 'hex';
/** Pointy-top hexagon — tip at 12 o'clock and 6 o'clock. */
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
/** Row overlap ratio: rows are this * tileSize apart vertically (3/4 = classic honeycomb). */
const V_OVERLAP = 0.25;

interface HexagonalGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function HexagonalGallery({ media, settings, runtime, containerDimensions: _containerDimensions }: HexagonalGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]!.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const openAt = useCallback(
    (i: number) => { setCurrentIndex(i); setLightboxOpen(true); },
    [setCurrentIndex],
  );
  const close = useCallback(() => setLightboxOpen(false), []);

  const tileValue = (settings.tileSize ?? 150) * (settings.itemScale ?? 1);
  const tileSizeUnit = settings.tileSizeUnit ?? 'px';
  const gapX = settings.tileGapX ?? 8;
  const gapXUnit = settings.tileGapXUnit ?? 'px';
  const gapY = settings.tileGapY ?? 8;
  const gapYUnit = settings.tileGapYUnit ?? 'px';
  const border = settings.tileBorderWidth
    ? `${settings.tileBorderWidth}px solid ${settings.tileBorderColor}`
    : 'none';

  // Resolve the tile size + gap to pixels against the measured container width,
  // then reflow into rows. Computing in pixel-space fixes both the flattened-tile
  // bug (a `%` height has no parent height to resolve against) and the broken row
  // wrapping for every non-`px` unit. See _shared/tileLayout.ts.
  const { tilePx, tilesPerRow, rows } = resolveTileGridLayout({
    items: media,
    tileValue,
    tileUnit: tileSizeUnit,
    gapValue: gapX,
    gapUnit: gapXUnit,
    containerWidth,
  });

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack {...getWpsgDebugProps('HexagonalGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconHexagon size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      <style>{buildTileStyles({ scope: SCOPE, settings })}</style>

      <Box {...getWpsgDebugProps('HexagonalGallery', 'grid')} ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        {rows.map((row, rowIdx) => {
          const isOffset = rowIdx % 2 === 1;
          return (
            <Box
              {...getWpsgDebugProps('HexagonalGallery', 'row')}
              key={rowIdx}
              style={{
                display: 'flex',
                gap: toCssOrNumber(gapX, gapXUnit),
                marginTop: rowIdx === 0 ? 0 : `calc(${-(tilePx * V_OVERLAP)}px + ${toCss(gapY, gapYUnit)})`,
                paddingLeft: isOffset ? `calc((${tilePx}px + ${toCss(gapX, gapXUnit)}) / 2)` : 0,
              }}
            >
              {row.map((item, itemIdx) => {
                const globalIdx = rowIdx * tilesPerRow + itemIdx;
                const thumbSrc = item.thumbnail || item.url;
                const isVideo = item.type === 'video';
                const label = item.caption || item.title || `${isVideo ? 'Video' : 'Image'} ${globalIdx + 1}`;
                return (
                  <Box
                    key={item.id}
                    component="button"
                    onClick={() => openAt(globalIdx)}
                    aria-label={label}
                    className={`wpsg-tile-${SCOPE}`}
                    style={{
                      flexShrink: 0,
                      width: tilePx,
                      height: tilePx,
                      clipPath: HEX_CLIP,
                      border,
                      position: 'relative',
                      overflow: 'hidden',
                      padding: 0,
                      background: 'var(--wpsg-color-surface, #1a1a2e)',
                    }}
                  >
                    {/* Background image */}
                    <LazyImage
                      src={thumbSrc}
                      alt={label}
                      style={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        pointerEvents: 'none',
                      }}
                    />
                    {/* Overlay */}
                    <Box
                      className="wpsg-hex-overlay"
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0)',
                        transition: 'background 0.2s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isVideo
                        ? <IconPlayerPlay size={tilePx * 0.25} color="white"
                          style={{ opacity: 0.85, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                        : <IconZoomIn size={tilePx * 0.22} color="white"
                          className="wpsg-hex-zoom"
                          style={{ opacity: 0, transition: 'opacity 0.2s ease' }} />
                      }
                    </Box>
                    {isVideo && (
                      <Text
                        style={{
                          position: 'absolute', bottom: '28%', left: '50%',
                          transform: 'translateX(-50%)',
                          background: OVERLAY_BG, borderRadius: 4,
                          padding: '1px 5px', fontSize: 9, color: OVERLAY_TEXT, fontWeight: 600,
                          pointerEvents: 'none',
                        }}
                      >VIDEO</Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}

        {/* Spacing at the bottom: compensate for final row's upward offset */}
        <Box style={{ height: tilePx * V_OVERLAP }} />
      </Box>

      <style>{`
        .wpsg-tile-hex:hover .wpsg-hex-overlay {
          background: rgba(0,0,0,0.28) !important;
        }
        .wpsg-tile-hex:hover .wpsg-hex-zoom {
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

setWpsgDebugDisplayName(HexagonalGallery, 'HexagonalGallery');