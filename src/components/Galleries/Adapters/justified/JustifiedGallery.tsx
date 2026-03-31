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
 */
import { useState, useCallback } from 'react';
import { RowsPhotoAlbum } from 'react-photo-album';
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import { Box, Stack, Title, Group } from '@mantine/core';
import { IconLayoutRows, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem, ContainerDimensions } from '@/types';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Galleries/Shared/Lightbox';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { buildBoxShadowStyles } from '@/components/Galleries/Adapters/_shared/tileHoverStyles';

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
  containerDimensions?: ContainerDimensions;
}

export function JustifiedGallery({ media, settings }: JustifiedGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const enriched = useMediaDimensions(media);

  const openAt = useCallback(
    (i: number) => { setCurrentIndex(i); setLightboxOpen(true); },
    [setCurrentIndex],
  );
  const close = useCallback(() => setLightboxOpen(false), []);

  const gap = settings.thumbnailGap ?? 6;
  const targetRowHeight = settings.mosaicTargetRowHeight ?? 200;

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

  const adapterPad = Math.max(0, Math.min(24, settings.adapterContentPadding ?? 0));
  const adapterSizing: React.CSSProperties = settings.adapterSizingMode === 'manual'
    ? { maxWidth: `${settings.adapterMaxWidthPct ?? 100}%`, marginInline: 'auto' }
    : {};

  return (
    <Stack gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: adapterPad } : {}) }}>
      {settings.showCampaignGalleryLabels !== false && (
        <Title order={3} size="h5" ta={settings.galleryLabelJustification || 'left'}>
          <Group gap={8} component="span" justify={settings.galleryLabelJustification || 'left'}>
            {settings.showGalleryLabelIcon && <IconLayoutRows size={18} />}
            Gallery ({media.length})
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
            const borderRadius = (photo as RpaPhoto).item.type === 'video' ? settings.videoBorderRadius : settings.imageBorderRadius;

            return (
              <button
                {...props}
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
            return <LazyImage {...imgProps} style={imgStyle} />;
          },
          extras(_cls, { photo, width, height }) {
            const p = photo as RpaPhoto;
            const isVideo = p.item.type === 'video';
            const borderRadius = isVideo ? settings.videoBorderRadius : settings.imageBorderRadius;
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
                        style={{ opacity: 0, transition: 'opacity 0.2s ease',
                          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }} />
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
        onPrev={prev} onNext={next} onClose={close} />
    </Stack>
  );
}
