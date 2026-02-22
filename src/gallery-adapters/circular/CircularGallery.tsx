/**
 * Circular Gallery Adapter  (adapter id = "circular")
 *
 * Responsive grid of circular-cropped photo tiles in a uniform dot-matrix
 * arrangement. No offset rows — pure flex-wrap grid. Each tile shows a
 * centered, cover-cropped circle. Supports hover bounce, border glow, and
 * border ring (via outline, which respects border-radius).
 */
import { useState, useCallback } from 'react';
import { Box, Stack, Title, Group, Text } from '@mantine/core';
import { IconCircles, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { LazyImage } from '@/components/Gallery/LazyImage';
import { buildTileStyles } from '@/gallery-adapters/_shared/tileHoverStyles';

const SCOPE = 'circle';

interface CircularGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function CircularGallery({ media, settings }: CircularGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);

  const openAt = useCallback(
    (i: number) => { setCurrentIndex(i); setLightboxOpen(true); },
    [setCurrentIndex],
  );
  const close = useCallback(() => setLightboxOpen(false), []);

  const tSize = settings.tileSize ?? 150;
  const gapX = settings.tileGapX ?? 8;
  const gapY = settings.tileGapY ?? 8;
  // Circular tiles use outline for border (respects border-radius: 50%)
  const outlineStyle = settings.tileBorderWidth
    ? `${settings.tileBorderWidth}px solid ${settings.tileBorderColor}`
    : 'none';

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconCircles size={18} />
          Gallery ({media.length})
        </Group>
      </Title>

      <style>{buildTileStyles({ scope: SCOPE, settings })}</style>

      <Box style={{ display: 'flex', flexWrap: 'wrap', gap: `${gapY}px ${gapX}px` }}>
        {media.map((item, idx) => {
          const thumbSrc = item.thumbnail || item.url;
          const isVideo = item.type === 'video';
          const label = item.caption || item.title || `${isVideo ? 'Video' : 'Image'} ${idx + 1}`;
          return (
            <Box
              key={item.id}
              component="button"
              onClick={() => openAt(idx)}
              aria-label={label}
              className={`wpsg-tile-${SCOPE}`}
              style={{
                width: tSize,
                height: tSize,
                borderRadius: '50%',
                outline: outlineStyle,
                outlineOffset: 2,
                position: 'relative',
                overflow: 'hidden',
                padding: 0,
                border: 'none',
                background: 'var(--wpsg-color-surface, #1a1a2e)',
                flexShrink: 0,
              }}
            >
              <LazyImage
                src={thumbSrc}
                alt={label}
                style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                }}
              />
              {/* Overlay */}
              <Box
                className="wpsg-circle-overlay"
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  background: 'rgba(0,0,0,0)',
                  transition: 'background 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isVideo
                  ? <IconPlayerPlay size={tSize * 0.28} color="white"
                      style={{ opacity: 0.85, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                  : <IconZoomIn size={tSize * 0.24} color="white"
                      className="wpsg-circle-zoom"
                      style={{ opacity: 0, transition: 'opacity 0.2s ease' }} />
                }
              </Box>
              {isVideo && (
                <Text
                  style={{
                    position: 'absolute', bottom: '18%', left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.65)', borderRadius: 4,
                    padding: '1px 5px', fontSize: 9, color: 'white', fontWeight: 600,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >VIDEO</Text>
              )}
            </Box>
          );
        })}
      </Box>

      <style>{`
        .wpsg-tile-circle:hover .wpsg-circle-overlay {
          background: rgba(0,0,0,0.28) !important;
        }
        .wpsg-tile-circle:hover .wpsg-circle-zoom {
          opacity: 1 !important;
        }
      `}</style>

      <Lightbox isOpen={lightboxOpen} media={media} currentIndex={currentIndex}
        onPrev={prev} onNext={next} onClose={close} />
    </Stack>
  );
}
