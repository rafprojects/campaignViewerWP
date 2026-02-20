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
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { buildTileStyles } from '@/gallery-adapters/_shared/tileHoverStyles';

const SCOPE = 'hex';
/** Pointy-top hexagon — tip at 12 o'clock and 6 o'clock. */
const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
/** Row overlap ratio: rows are this * tileSize apart vertically (3/4 = classic honeycomb). */
const V_OVERLAP = 0.25;

interface HexagonalGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function HexagonalGallery({ media, settings }: HexagonalGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
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

  const tSize = settings.tileSize ?? 150;
  const gapX = settings.tileGapX ?? 8;
  const gapY = settings.tileGapY ?? 8;
  const border = settings.tileBorderWidth
    ? `${settings.tileBorderWidth}px solid ${settings.tileBorderColor}`
    : 'none';

  // How many tiles fit in one row (min 2 so offset rows still look good)
  const tilesPerRow = containerWidth > 0
    ? Math.max(2, Math.floor((containerWidth + gapX) / (tSize + gapX)))
    : 4;

  // Split items into rows
  const rows: MediaItem[][] = [];
  for (let i = 0; i < media.length; i += tilesPerRow) {
    rows.push(media.slice(i, i + tilesPerRow));
  }

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconHexagon size={18} />
          Gallery ({media.length})
        </Group>
      </Title>

      <style>{buildTileStyles({ scope: SCOPE, settings })}</style>

      <Box ref={containerRef} style={{ width: '100%', position: 'relative' }}>
        {rows.map((row, rowIdx) => {
          const isOffset = rowIdx % 2 === 1;
          return (
            <Box
              key={rowIdx}
              style={{
                display: 'flex',
                gap: gapX,
                marginTop: rowIdx === 0 ? 0 : -tSize * V_OVERLAP + gapY,
                paddingLeft: isOffset ? (tSize + gapX) / 2 : 0,
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
                      width: tSize,
                      height: tSize,
                      clipPath: HEX_CLIP,
                      border,
                      position: 'relative',
                      overflow: 'hidden',
                      padding: 0,
                      background: 'none',
                    }}
                  >
                    {/* Background image */}
                    <img
                      src={thumbSrc}
                      alt={label}
                      loading="lazy"
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
                        ? <IconPlayerPlay size={tSize * 0.25} color="white"
                            style={{ opacity: 0.85, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                        : <IconZoomIn size={tSize * 0.22} color="white"
                            className="wpsg-hex-zoom"
                            style={{ opacity: 0, transition: 'opacity 0.2s ease' }} />
                      }
                    </Box>
                    {isVideo && (
                      <Text
                        style={{
                          position: 'absolute', bottom: '28%', left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(0,0,0,0.65)', borderRadius: 4,
                          padding: '1px 5px', fontSize: 9, color: 'white', fontWeight: 600,
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
        <Box style={{ height: tSize * V_OVERLAP }} />
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
        onPrev={prev} onNext={next} onClose={close} />
    </Stack>
  );
}
