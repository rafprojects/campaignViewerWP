/**
 * Masonry Gallery Adapter  (adapter id = "masonry")
 *
 * True masonry layout: images are placed in N columns, each at their
 * natural aspect ratio. Items fill the shortest column first, producing
 * the classic "brick wall" look without any forced row alignment.
 *
 * Uses react-photo-album's MasonryPhotoAlbum which implements masonry
 * via CSS multi-column layout — no JavaScript layout calculation needed
 * at paint time, so it is performant and fully responsive.
 *
 * Column count is responsive by default but the user can pin it via
 * the `masonryColumns` setting (0 = auto/responsive).
 */
import { useState, useCallback } from 'react';
import { MasonryPhotoAlbum } from 'react-photo-album';
import { Box, Stack, Title, Group } from '@mantine/core';
import { IconColumns, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { buildBoxShadowStyles } from '@/gallery-adapters/_shared/tileHoverStyles';

const SCOPE = 'masonry';

interface RpaPhoto {
  src: string;
  width: number;
  height: number;
  key: string;
  item: MediaItem;
}

interface MasonryGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function MasonryGallery({ media, settings }: MasonryGalleryProps) {
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
  const pinned = settings.masonryColumns ?? 0;

  // Responsive column function — honour user's pin when set, otherwise auto.
  const columns = pinned > 0
    ? pinned
    : (containerWidth: number) => {
        if (containerWidth < 400) return 1;
        if (containerWidth < 700) return 2;
        if (containerWidth < 1000) return 3;
        return 4;
      };

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
          <IconColumns size={18} />
          Gallery ({media.length})
        </Group>
      </Title>

      <style>{buildBoxShadowStyles(SCOPE, settings)}</style>

      <MasonryPhotoAlbum
        photos={photos}
        columns={columns}
        spacing={gap}
        onClick={({ index }) => openAt(index)}
        render={{
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
                  // Masonry items break across columns — display must stay block
                  display: 'block',
                  width: '100%',
                  breakInside: 'avoid',
                }}
              />
            );
          },
          extras(_cls, { photo, width, height }) {
            const p = photo as RpaPhoto;
            const isVideo = p.item.type === 'video';
            const iconSize = Math.max(22, Math.min(width, height) * 0.2);
            return (
              <Box
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius }}
                className="wpsg-mas-overlay"
              >
                <Box
                  className="wpsg-mas-icon-wrap"
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
                        className="wpsg-mas-zoom"
                        style={{ opacity: 0, transition: 'opacity 0.2s ease',
                          filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))' }} />
                  }
                </Box>
                {isVideo && (
                  <Box style={{
                    position: 'absolute', top: 5, left: 5,
                    background: 'rgba(0,0,0,0.65)',
                    borderRadius: 4, padding: '2px 5px',
                    fontSize: 10, color: 'white', fontWeight: 600,
                  }}>VIDEO</Box>
                )}
              </Box>
            );
          },
        }}
      />

      <style>{`
        .react-photo-album--masonry .react-photo-album--button:hover .wpsg-mas-icon-wrap {
          background: rgba(0,0,0,0.28) !important;
        }
        .react-photo-album--masonry .react-photo-album--button:hover .wpsg-mas-zoom {
          opacity: 1 !important;
        }
      `}</style>

      <Lightbox isOpen={lightboxOpen} media={media} currentIndex={currentIndex}
        onPrev={prev} onNext={next} onClose={close} />
    </Stack>
  );
}
