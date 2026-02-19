/**
 * Mosaic Gallery Adapter
 *
 * Uses react-photo-album's RowsPhotoAlbum (Flickr-style justified rows)
 * to produce an aspect-ratio-preserving mosaic layout. Each row fills the
 * full container width, keeping the configured target row height as close
 * as possible — exactly the algorithm used by Flickr, Google Photos, etc.
 *
 * Registered as adapter id="mosaic".
 *
 * Features:
 *  - Intelligent row packing via react-photo-album v3 (RowsPhotoAlbum)
 *  - Async dimension probing for items that lack server-supplied w/h
 *  - Video play-button overlay + "VIDEO" badge
 *  - Hover zoom-in icon for images
 *  - Full Lightbox integration
 *  - Respects settings: mosaicTargetRowHeight, thumbnailGap, imageBorderRadius
 */
import { useState, useCallback } from 'react';
import { RowsPhotoAlbum } from 'react-photo-album';
import { Box, Stack, Title, Group } from '@mantine/core';
import { IconLayoutRows, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type { RenderPhotoContext } from 'react-photo-album';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';

interface MosaicPhoto {
  src: string;
  width: number;
  height: number;
  key: string;
  /** Original media item — stored for custom renderers. */
  item: MediaItem;
  /** Position in the passed-in media array (used for lightbox). */
  originalIndex: number;
}

interface MosaicGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function MosaicGallery({ media, settings }: MosaicGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);

  // Enrich items with dimensions (from server or via image probe).
  const enriched = useMediaDimensions(media);

  const openAt = useCallback(
    (index: number) => {
      setCurrentIndex(index);
      setLightboxOpen(true);
    },
    [setCurrentIndex],
  );
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const borderRadius = settings.imageBorderRadius;
  const gap = settings.thumbnailGap ?? 6;
  const targetRowHeight = settings.mosaicTargetRowHeight ?? 200;

  // Build react-photo-album Photo objects.
  const photos: MosaicPhoto[] = enriched.map((item, idx) => ({
    src: item.thumbnail || item.url,
    width: item.width,
    height: item.height,
    key: item.id,
    item,
    originalIndex: idx,
  }));

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconLayoutRows size={18} />
          Gallery ({media.length})
        </Group>
      </Title>

      <RowsPhotoAlbum
        photos={photos}
        targetRowHeight={targetRowHeight}
        spacing={gap}
        rowConstraints={{ singleRowMaxHeight: targetRowHeight * 2 }}
        onClick={({ index }) => openAt(index)}
        render={{
          // Apply border-radius + overflow to each photo button wrapper.
          button(buttonProps, _ctx) {
            return (
              <button
                {...buttonProps}
                style={{
                  ...(buttonProps.style as React.CSSProperties),
                  borderRadius,
                  overflow: 'hidden',
                  position: 'relative',
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'block',
                  background: 'none',
                }}
              />
            );
          },
          // Custom image renderer — apply border-radius + object-fit.
          image(imageProps, _ctx) {
            return (
              <img
                {...imageProps}
                style={{
                  ...(imageProps.style as React.CSSProperties),
                  borderRadius,
                  display: 'block',
                  objectFit: 'cover',
                  width: '100%',
                  height: '100%',
                }}
              />
            );
          },
          // Overlay extras: hover icon + video badge.
          extras(_classname, ctx: RenderPhotoContext<MosaicPhoto>) {
            const { photo, width, height } = ctx;
            const isVideo = photo.item.type === 'video';
            return (
              <Box
                className="mosaic-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius,
                  pointerEvents: 'none',
                }}
              >
                {/* Hover icon */}
                <Box
                  className="mosaic-icon"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0)',
                    transition: 'background 0.2s ease',
                  }}
                >
                  {isVideo ? (
                    <IconPlayerPlay
                      size={Math.max(24, Math.min(width, height) * 0.22)}
                      color="white"
                      style={{
                        opacity: 0.75,
                        filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.8))',
                      }}
                    />
                  ) : (
                    <IconZoomIn
                      size={Math.max(20, Math.min(width, height) * 0.18)}
                      color="white"
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.2s ease',
                        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.7))',
                        // NOTE: hover opacity driven by CSS class below
                      }}
                      className="mosaic-zoom-icon"
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
                      background: 'rgba(0,0,0,0.65)',
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10,
                      color: 'white',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                    }}
                  >
                    VIDEO
                  </Box>
                )}
              </Box>
            );
          },
        }}
      />

      {/*
        Inline style block injected into the shadow root via react-photo-album/rows.css
        (imported in shadowStyles.ts). The rules below handle hover states that cannot
        be driven conveniently from JSX render closures.
      */}
      <style>{`
        .react-photo-album--row button:hover .mosaic-icon {
          background: rgba(0,0,0,0.3) !important;
        }
        .react-photo-album--row button:hover .mosaic-zoom-icon {
          opacity: 1 !important;
        }
      `}</style>

      <Lightbox
        isOpen={lightboxOpen}
        media={media}
        currentIndex={currentIndex}
        onPrev={prev}
        onNext={next}
        onClose={closeLightbox}
      />
    </Stack>
  );
}
