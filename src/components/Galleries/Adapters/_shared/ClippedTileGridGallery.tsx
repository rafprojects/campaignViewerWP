/**
 * Clipped Tile Grid Gallery  (Phase 70-B)
 *
 * Shared engine for the offset clip-path tile grids — Diamond and Hexagonal —
 * which were previously byte-for-byte identical apart from a handful of
 * constants. A `ClippedTileGridConfig` supplies the pieces that differ
 * (clip-path, vertical overlap, heading icon, CSS scope, icon-size ratios and
 * the video badge styling); everything else — responsive tiles-per-row reflow,
 * offset rows, hover/zoom overlay, lightbox wiring and heading chrome — lives
 * here once. Each concrete adapter is now a thin config-passing wrapper.
 */
import { useState, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Text } from '@mantine/core';
import { IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import { OVERLAY_BG, OVERLAY_TEXT } from './overlayStyles';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { toCss, toCssOrNumber, useCarousel, resolveTileGridLayout } from '@wp-super-gallery/shared-utils';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { buildTileStyles } from './tileHoverStyles';
import { getWpsgDebugProps } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from './runtimeCommon';
import { AdapterHeading } from './AdapterHeading';
import { AdapterLightbox } from './AdapterLightbox';
import { useContainerWidth } from './useContainerWidth';

/** Per-adapter configuration for {@link ClippedTileGridGallery}. */
export interface ClippedTileGridConfig {
  /** CSS scope string (e.g. `'diamond'`, `'hex'`) — drives tile/overlay/zoom class names. */
  scope: string;
  /** Component name used for the `data-wpsg-*` debug attributes. */
  debugName: string;
  /** clip-path polygon applied to every tile. */
  clipPath: string;
  /** Vertical overlap ratio — rows sit this × tile height apart. */
  vOverlap: number;
  /** Already-sized heading icon (e.g. `<IconDiamond size={18} />`). */
  icon: ReactNode;
  /** Play-icon size as a fraction of the tile size (video tiles). */
  playIconRatio: number;
  /** Zoom-icon size as a fraction of the tile size (image tiles). */
  zoomIconRatio: number;
  /** Video badge styling that differs between the grids. */
  badge: {
    bottom: string;
    padding: string;
    fontSize: number;
    whiteSpace?: 'nowrap';
  };
}

interface ClippedTileGridGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  // `| undefined` so wrappers can forward their own optional `runtime` prop
  // verbatim under `exactOptionalPropertyTypes`.
  runtime?: ResolvedGallerySectionRuntime | undefined;
  config: ClippedTileGridConfig;
}

export function ClippedTileGridGallery({ media, settings, runtime, config }: ClippedTileGridGalleryProps) {
  const { scope, debugName, clipPath, vOverlap, icon, playIconRatio, zoomIconRatio, badge } = config;
  const { t } = useTranslation('wpsg');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

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
  // then reflow into rows — computing in pixel-space fixes both the flattened-tile
  // bug (a `%` height has no parent height to resolve against) and broken row
  // wrapping for every non-`px` unit. See shared-utils/tileLayout.
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
    <Stack {...getWpsgDebugProps(debugName)} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      <AdapterHeading common={common} heading={heading} icon={icon} />

      <style>{buildTileStyles({ scope, settings })}</style>

      <Box {...getWpsgDebugProps(debugName, 'grid')} ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        {rows.map((row, rowIdx) => {
          const isOffset = rowIdx % 2 === 1;
          return (
            <Box
              {...getWpsgDebugProps(debugName, 'row')}
              key={rowIdx}
              style={{
                display: 'flex',
                gap: toCssOrNumber(gapX, gapXUnit),
                marginTop: rowIdx === 0 ? 0 : `calc(${-(tilePx * vOverlap)}px + ${toCss(gapY, gapYUnit)})`,
                paddingLeft: isOffset ? `calc((${tilePx}px + ${toCss(gapX, gapXUnit)}) / 2)` : 0,
              }}
            >
              {row.map((item, itemIdx) => {
                const globalIdx = rowIdx * tilesPerRow + itemIdx;
                const thumbSrc = item.thumbnail || item.url;
                const isVideo = item.type === 'video';
                const label = item.caption || item.title
                  || t('gallery_item_label', '{{type}} {{index}}', { type: isVideo ? t('gallery_video_type', 'Video') : t('gallery_image_type', 'Image'), index: globalIdx + 1 });
                return (
                  <Box
                    key={item.id}
                    component="button"
                    onClick={() => openAt(globalIdx)}
                    aria-label={label}
                    className={`wpsg-tile-${scope}`}
                    style={{
                      flexShrink: 0,
                      width: tilePx,
                      height: tilePx,
                      clipPath,
                      border,
                      position: 'relative',
                      overflow: 'hidden',
                      padding: 0,
                      background: 'var(--wpsg-color-surface, #1a1a2e)',
                    }}
                  >
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
                    <Box
                      className={`wpsg-${scope}-overlay`}
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0)',
                        transition: 'background 0.2s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isVideo
                        ? <IconPlayerPlay size={tilePx * playIconRatio} color="white"
                          style={{ opacity: 0.85, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                        : <IconZoomIn size={tilePx * zoomIconRatio} color="white"
                          className={`wpsg-${scope}-zoom`}
                          style={{ opacity: 0, transition: 'opacity 0.2s ease' }} />
                      }
                    </Box>
                    {isVideo && (
                      <Text
                        style={{
                          position: 'absolute', bottom: badge.bottom, left: '50%',
                          transform: 'translateX(-50%)',
                          background: OVERLAY_BG, borderRadius: 4,
                          padding: badge.padding, fontSize: badge.fontSize, color: OVERLAY_TEXT, fontWeight: 600,
                          pointerEvents: 'none',
                          ...(badge.whiteSpace ? { whiteSpace: badge.whiteSpace } : {}),
                        }}
                      >{t('gallery_video_badge', 'VIDEO')}</Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}

        {/* Compensate for final-row upward shift */}
        <Box style={{ height: tilePx * vOverlap }} />
      </Box>

      <style>{`
        .wpsg-tile-${scope}:hover .wpsg-${scope}-overlay {
          background: rgba(0,0,0,0.28) !important;
        }
        .wpsg-tile-${scope}:hover .wpsg-${scope}-zoom {
          opacity: 1 !important;
        }
      `}</style>

      <AdapterLightbox isOpen={lightboxOpen} media={media} currentIndex={currentIndex}
        onPrev={prev} onNext={next} onClose={close} settings={settings} />
    </Stack>
  );
}
