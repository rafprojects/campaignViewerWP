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
import { OVERLAY_BG, OVERLAY_TEXT } from '../_shared/overlayStyles';
import { MasonryPhotoAlbum } from 'react-photo-album';
import { Box, Stack, Title, Group } from '@mantine/core';
import { IconColumns, IconZoomIn, IconPlayerPlay } from '@tabler/icons-react';
import type {
  GalleryBehaviorSettings,
  MediaItem,
  ContainerDimensions,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { useMediaDimensions } from '@/hooks/useMediaDimensions';
import { useTypographyStyle } from '@/hooks/useTypographyStyle';
import { useCarousel } from '@/hooks/useCarousel';
import { Lightbox } from '@/components/Galleries/Shared/Lightbox';
import { LazyImage } from '@/components/CampaignGallery/LazyImage';
import { buildBoxShadowStyles } from '@/components/Galleries/Adapters/_shared/tileHoverStyles';
import { toCssOrNumber } from '@/utils/cssUnits';
import { resolveColumnsFromWidth } from '@/utils/resolveColumnsFromWidth';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { resolveAdapterShellStyle, resolveGalleryComponentCommonSettings, resolveGalleryHeading } from '../_shared/runtimeCommon';

const SCOPE = 'masonry';

interface RpaPhoto {
  src: string;
  width: number;
  height: number;
  key: string;
  item: MediaItem;
  alt?: string;
}

interface MasonryGalleryProps {
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
  containerDimensions?: ContainerDimensions;
}

export function MasonryGallery({ media, settings, runtime, containerDimensions: _containerDimensions }: MasonryGalleryProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { currentIndex, setCurrentIndex, next, prev } = useCarousel(media.length);
  const enriched = useMediaDimensions(media);
  const galleryLabelStyle = useTypographyStyle('galleryLabel', settings);
  const common = resolveGalleryComponentCommonSettings(settings, runtime);
  const heading = resolveGalleryHeading(common, media, runtime?.scope);

  const openAt = useCallback(
    (i: number) => { setCurrentIndex(i); setLightboxOpen(true); },
    [setCurrentIndex],
  );
  const close = useCallback(() => setLightboxOpen(false), []);

  const gap = settings.thumbnailGap ?? 6;
  const pinned = settings.masonryColumns ?? 0;

  // P31-G: Waterfall entrance animation
  const waterfallEnabled = (settings.masonryEntranceAnimation ?? 'none') === 'waterfall';
  const entranceStagger = Math.max(0, Math.min(300, settings.masonryEntranceStagger ?? 60));
  // Duration for one tile's entrance (total tile anim time before next starts).
  const ENTRANCE_DURATION_MS = 400;

  // Responsive column function — uses shared helper; honours user's pin when set.
  const columns = pinned > 0
    ? pinned
    : (containerWidth: number) => resolveColumnsFromWidth(containerWidth, 0, settings.masonryAutoColumnBreakpoints);

  // Normalize all photos to a consistent reference height so large-resolution
  // images don't dominate the layout. react-photo-album uses width/height
  // ratios for column packing — absolute values don't matter, only ratios do.
  const NORMALIZE_HEIGHT = 400;
  const photos: RpaPhoto[] = enriched.map((item) => {
    const ratio = item.width / item.height;
    return {
      src: item.thumbnail || item.url,
      width: Math.round(NORMALIZE_HEIGHT * ratio),
      height: NORMALIZE_HEIGHT,
      key: item.id,
      item,
      alt: item.caption || item.title || '',
    };
  });

  const adapterPad = Math.max(0, Math.min(24, common.adapterContentPadding ?? 0));
  const adapterPadUnit = common.adapterContentPaddingUnit ?? 'px';
  const adapterSizing = resolveAdapterShellStyle(common);

  return (
    <Stack {...getWpsgDebugProps('MasonryGallery')} gap="md" style={{ ...adapterSizing, ...(adapterPad ? { padding: toCssOrNumber(adapterPad, adapterPadUnit) } : {}) }}>
      {heading.visible && (
        <Title order={3} size="h5" ta={common.galleryLabelJustification || 'left'} style={galleryLabelStyle}>
          <Group gap={8} component="span" justify={common.galleryLabelJustification || 'left'}>
            {common.showGalleryLabelIcon && <IconColumns size={18} />}
            {heading.label}
          </Group>
        </Title>
      )}

      <style>{buildBoxShadowStyles(SCOPE, settings)}</style>

      <MasonryPhotoAlbum
        photos={photos}
        columns={columns}
        spacing={gap}
        onClick={({ index }) => openAt(index)}
        render={{
          button({ style, className, ...props }, { photo, index }) {
            const isVideo = (photo as RpaPhoto).item.type === 'video';
            const borderRadius = toCssOrNumber(
              isVideo ? settings.videoBorderRadius : settings.imageBorderRadius,
              (isVideo ? settings.videoBorderRadiusUnit : settings.imageBorderRadiusUnit) ?? 'px',
            );

            return (
              <button
                {...props}
                {...getWpsgDebugProps('MasonryGallery', 'tile')}
                className={`wpsg-tile-${SCOPE}${waterfallEnabled ? ' wpsg-waterfall-tile' : ''} ${className ?? ''}`}
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
                  background: 'var(--wpsg-color-surface, #1a1a2e)',
                  // P31-G: per-tile entrance stagger delay (overridden by reduced-motion rule)
                  ...(waterfallEnabled ? { animationDelay: `${index * entranceStagger}ms` } : {}),
                }}
              />
            );
          },
          image({ style: imgStyle, ...imgProps }) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return <LazyImage {...(imgProps as any)} {...(imgStyle !== undefined ? { style: imgStyle } : {})} />;
          },
          extras(_cls, { photo, width, height }) {
            const p = photo as RpaPhoto;
            const isVideo = p.item.type === 'video';
            const borderRadius = toCssOrNumber(
              isVideo ? settings.videoBorderRadius : settings.imageBorderRadius,
              (isVideo ? settings.videoBorderRadiusUnit : settings.imageBorderRadiusUnit) ?? 'px',
            );
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
                      style={{
                        opacity: 0, transition: 'opacity 0.2s ease',
                        filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))'
                      }} />
                  }
                </Box>
                {isVideo && (
                  <Box style={{
                    position: 'absolute', top: 5, left: 5,
                    background: OVERLAY_BG,
                    borderRadius: 4, padding: '2px 5px',
                    fontSize: 10, color: OVERLAY_TEXT, fontWeight: 600,
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
        ${waterfallEnabled ? `
        /* P31-G: Waterfall entrance animation.
           Applies on initial mount; fill-mode 'both' keeps tiles visible after
           completion. Reduced-motion users get no motion — opacity still fades in
           so the tile is not permanently invisible when animation: none is applied. */
        @keyframes wpsg-waterfall-enter {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wpsg-waterfall-tile {
          animation: wpsg-waterfall-enter ${ENTRANCE_DURATION_MS}ms ease both;
        }
        @media (prefers-reduced-motion: reduce) {
          .wpsg-waterfall-tile {
            animation: none !important;
          }
        }` : ''}
      `}</style>

      <Lightbox isOpen={lightboxOpen} media={media} currentIndex={currentIndex}
        onPrev={prev} onNext={next} onClose={close}
        videoMaxWidth={settings.lightboxVideoMaxWidth} videoMaxWidthUnit={settings.lightboxVideoMaxWidthUnit}
        videoHeight={settings.lightboxVideoHeight} videoHeightUnit={settings.lightboxVideoHeightUnit}
        mediaMaxHeight={settings.lightboxMediaMaxHeight} />
    </Stack>
  );
}

setWpsgDebugDisplayName(MasonryGallery, 'MasonryGallery');
