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
import { Box, Stack, Title, Group, Text } from '@mantine/core';
import { IconDiamond, IconPlayerPlay, IconZoomIn } from '@tabler/icons-react';
import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Campaign/Lightbox';
import { LazyImage } from '@/components/Gallery/LazyImage';
import { buildTileStyles } from '@/gallery-adapters/_shared/tileHoverStyles';

const SCOPE = 'diamond';
/** Diamond clip-path: rhombus with tips at 12, 3, 6, 9 o'clock positions. */
const DIAMOND_CLIP = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
/** Vertical overlap ratio — 0.5 = rows are half-a-tile apart vertically */
const V_OVERLAP = 0.5;

interface DiamondGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
}

export function DiamondGallery({ media, settings }: DiamondGalleryProps) {
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

  const tilesPerRow = containerWidth > 0
    ? Math.max(2, Math.floor((containerWidth + gapX) / (tSize + gapX)))
    : 4;

  const rows: MediaItem[][] = [];
  for (let i = 0; i < media.length; i += tilesPerRow) {
    rows.push(media.slice(i, i + tilesPerRow));
  }

  return (
    <Stack gap="md">
      <Title order={3} size="h5">
        <Group gap={8} component="span">
          <IconDiamond size={18} />
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
                const label = item.caption || item.title
                  || `${isVideo ? 'Video' : 'Image'} ${globalIdx + 1}`;
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
                        ? <IconPlayerPlay size={tSize * 0.22} color="white"
                            style={{ opacity: 0.85, filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))' }} />
                        : <IconZoomIn size={tSize * 0.2} color="white"
                            className="wpsg-diamond-zoom"
                            style={{ opacity: 0, transition: 'opacity 0.2s ease' }} />
                      }
                    </Box>
                    {isVideo && (
                      <Text
                        style={{
                          position: 'absolute', bottom: '26%', left: '50%',
                          transform: 'translateX(-50%)',
                          background: 'rgba(0,0,0,0.65)', borderRadius: 4,
                          padding: '1px 4px', fontSize: 8, color: 'white', fontWeight: 600,
                          pointerEvents: 'none',
                          whiteSpace: 'nowrap',
                        }}
                      >VIDEO</Text>
                    )}
                  </Box>
                );
              })}
            </Box>
          );
        })}

        {/* Compensate for final-row upward shift */}
        <Box style={{ height: tSize * V_OVERLAP }} />
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
        onPrev={prev} onNext={next} onClose={close} />
    </Stack>
  );
}
