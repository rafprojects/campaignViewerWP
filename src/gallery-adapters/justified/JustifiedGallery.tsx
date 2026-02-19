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
import { Box, Stack, Title, Group } from '@mantine/core';
import { IconLayoutRows, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { buildBoxShadowStyles } from '@/gallery-adapters/_shared/tileHoverStyles';

const SCOPE = 'justified';

interface RpaPhoto {
  src: string;
  width: number;
  height: number;
  key: string;
  item: MediaItem;
}

interface JustifiedGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
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

  const borderRadius = settings.imageBorderRadius;
  const gap = settings.thumbnailGap ?? 6;
  const targetRowHeight = settings.mosaicTargetRowHeight ?? 200;

  const photos: RpaPhoto[] = enriched.map((item) => ({
    src: item.thumbnail || item.url,
    width: item.width,
    height: item.height,
    key: item.id,
    item,
    alt: item.caption || item.title || '',
  }));

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconLayoutRows size={18} />
          Gallery ({media.length})
        </Group>
      </Title>

      <style>{buildBoxShadowStyles(SCOPE, settings)}</style>

      <RowsPhotoAlbum
        photos={photos}
        targetRowHeight={targetRowHeight}
        spacing={gap}
        rowConstraints={{ singleRowMaxHeight: targetRowHeight * 2 }}
        onClick={({ index }) => openAt(index)}
        render={{
          // ⚠ CRITICAL: never set display here — it breaks the flex-row layout.
          // Only set overflow/radius/position which do not affect the layout flow.
          button({ style, className, ...props }) {
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
                }}
              />
            );
          },
          extras(_cls, { photo, width, height }) {
            const p = photo as RpaPhoto;
            const isVideo = p.item.type === 'video';
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
                    background: 'rgba(0,0,0,0.65)', borderRadius: 4,
                    padding: '2px 5px', fontSize: 10, color: 'white', fontWeight: 600,
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
