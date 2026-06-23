/**
 * Diamond Gallery Adapter  (adapter id = "diamond")
 *
 * Argyle/diamond grid: square tiles rotated 45° via CSS clip-path.
 * Rows are offset horizontally by half a tile width, and overlap
 * vertically by half a tile height, forming an interlocked diamond
 * lattice (like the image in the reference screenshot).
 *
 * Responsive: a ResizeObserver calculates tiles-per-row; offset rows
 * shift automatically. Hover bounce, border glow, and border decoration
 * are all controlled by the shared tile settings.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Stack, Title, Group, Text } from '@mantine/core';
import { IconDiamond, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
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

const SCOPE = 'diamond';
/** Diamond clip-path: rhombus with tips at 12, 3, 6, 9 o'clock positions. */
const DIAMOND_CLIP = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
/** Vertical overlap ratio — 0.5 = rows are half-a-tile apart vertically */
const V_OVERLAP = 0.5;

interface DiamondGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function DiamondGallery({ media, settings, runtime, containerDimensions: _containerDimensions }: DiamondGalleryProps) {
  const { t } = useTranslation('wpsg');
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
  // then reflow into rows — see _shared/tileLayout.ts and the rationale in the
  // hexagonal adapter (this adapter shared the same non-`px` unit bugs).
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
    <Stack {...getWpsgDebugProps('DiamondGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconDiamond size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      <style>{buildTileStyles({ scope: SCOPE, settings })}</style>

      <Box {...getWpsgDebugProps('DiamondGallery', 'grid')} ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        {rows.map((row, rowIdx) => {
          const isOffset = rowIdx % 2 === 1;
          return (
            <Box
              {...getWpsgDebugProps('DiamondGallery', 'row')}
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
                const label = item.caption || item.title
                  || t('gallery_item_label', '{{type}} {{index}}', { type: isVideo ? t('gallery_video_type', 'Video') : t('gallery_image_type', 'Image'), index: globalIdx + 1 });
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
                      clipPath: DIAMOND_CLIP,
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
                      className="wpsg-diamond-overlay"
                      style={{
                        position: 'absolute', inset: 0,
                        background: 'rgba(0,0,0,0)',
                        transition: 'background 0.2s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {isVideo
                        ? <IconPlayerPlay size={tilePx * 0.22} color="white"
                          style={{ opacity: 0.85, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                        : <IconZoomIn size={tilePx * 0.2} color="white"
                          className="wpsg-diamond-zoom"
                          style={{ opacity: 0, transition: 'opacity 0.2s ease' }} />
                      }
                    </Box>
                    {isVideo && (
                      <Text
                        style={{
                          position: 'absolute', bottom: '26%', left: '50%',
                          transform: 'translateX(-50%)',
                          background: OVERLAY_BG, borderRadius: 4,
                          padding: '1px 4px', fontSize: 8, color: OVERLAY_TEXT, fontWeight: 600,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
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
        <Box style={{ height: tilePx * V_OVERLAP }} />
      </Box>

      <style>{`
        .wpsg-tile-diamond:hover .wpsg-diamond-overlay {
          background: rgba(0,0,0,0.28) !important;
        }
        .wpsg-tile-diamond:hover .wpsg-diamond-zoom {
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

setWpsgDebugDisplayName(DiamondGallery, 'DiamondGallery');