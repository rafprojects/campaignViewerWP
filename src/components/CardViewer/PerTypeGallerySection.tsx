/**
 * P22-P2: Per-Type Gallery Section
 *
 * Renders separate Video and Image gallery sections, each wrapped in
 * its own GallerySectionWrapper. Supports optional equal-height
 * side-by-side layout via SimpleGrid at tablet+.
 */
import { lazy, type ComponentType } from 'react';
import { SimpleGrid, Stack } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings, ContainerDimensions, MediaItem } from '@/types';
import type { GalleryAdapterProps } from '@/components/Galleries/Adapters/GalleryAdapter';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { resolveAdapterId } from '@/utils/resolveAdapterId';
import { GallerySectionWrapper } from './GallerySectionWrapper';

const VideoCarousel = lazy(() =>
  import('@/components/Galleries/Shared/VideoCarousel').then((m) => ({ default: m.VideoCarousel })),
);
const ImageCarousel = lazy(() =>
  import('@/components/Galleries/Shared/ImageCarousel').then((m) => ({ default: m.ImageCarousel })),
);
const CompactGridGallery = lazy(() =>
  import('@/components/Galleries/Adapters/compact-grid/CompactGridGallery').then((m) => ({ default: m.CompactGridGallery })),
);
const JustifiedGallery = lazy(() =>
  import('@/components/Galleries/Adapters/justified/JustifiedGallery').then((m) => ({ default: m.JustifiedGallery })),
);
const MasonryGallery = lazy(() =>
  import('@/components/Galleries/Adapters/masonry/MasonryGallery').then((m) => ({ default: m.MasonryGallery })),
);
const HexagonalGallery = lazy(() =>
  import('@/components/Galleries/Adapters/hexagonal/HexagonalGallery').then((m) => ({ default: m.HexagonalGallery })),
);
const CircularGallery = lazy(() =>
  import('@/components/Galleries/Adapters/circular/CircularGallery').then((m) => ({ default: m.CircularGallery })),
);
const DiamondGallery = lazy(() =>
  import('@/components/Galleries/Adapters/diamond/DiamondGallery').then((m) => ({ default: m.DiamondGallery })),
);
const LayoutBuilderGallery = lazy(() =>
  import('@/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery').then((m) => ({ default: m.LayoutBuilderGallery })),
);

function resolveAdapterComponent(id: string): ComponentType<GalleryAdapterProps> {
  switch (id) {
    case 'justified':
    case 'mosaic':
      return JustifiedGallery as ComponentType<GalleryAdapterProps>;
    case 'masonry':
      return MasonryGallery as ComponentType<GalleryAdapterProps>;
    case 'hexagonal':
      return HexagonalGallery as ComponentType<GalleryAdapterProps>;
    case 'circular':
      return CircularGallery as ComponentType<GalleryAdapterProps>;
    case 'diamond':
      return DiamondGallery as ComponentType<GalleryAdapterProps>;
    case 'compact-grid':
    default:
      return CompactGridGallery as ComponentType<GalleryAdapterProps>;
  }
}

function renderAdapterForSection(
  id: string,
  media: MediaItem[],
  settings: GalleryBehaviorSettings,
  containerDimensions: ContainerDimensions,
  campaign: Campaign,
  isAdmin: boolean,
) {
  if (id === 'layout-builder' && campaign.layoutTemplateId) {
    return (
      <LayoutBuilderGallery
        media={media}
        settings={settings}
        templateId={campaign.layoutTemplateId}
        isAdmin={isAdmin}
        containerDimensions={containerDimensions}
      />
    );
  }
  const Adapter = resolveAdapterComponent(id);
  return <Adapter media={media} settings={settings} containerDimensions={containerDimensions} />;
}

interface PerTypeGallerySectionProps {
  campaign: Campaign;
  settings: GalleryBehaviorSettings;
  breakpoint: Breakpoint;
  isAdmin: boolean;
}

export function PerTypeGallerySection({ campaign, settings: s, breakpoint, isAdmin }: PerTypeGallerySectionProps) {
  const hasVideos = campaign.videos.length > 0;
  const hasImages = campaign.images.length > 0;

  const videoId = campaign.videoAdapterId || resolveAdapterId(s, 'video', breakpoint);
  const imageId = campaign.imageAdapterId || resolveAdapterId(s, 'image', breakpoint);
  const videoSettings = { ...s, tileSize: s.videoTileSize ?? s.tileSize };
  const imageSettings = { ...s, tileSize: s.imageTileSize ?? s.tileSize };

  const videoSection = hasVideos && (
    <GallerySectionWrapper
      settings={s}
      bgType={s.videoBgType}
      bgColor={s.videoBgColor}
      bgGradient={s.videoBgGradient}
      bgImageUrl={s.videoBgImageUrl}
      borderRadius={s.videoBorderRadius}
      style={s.perTypeSectionEqualHeight ? { minHeight: '100%' } : undefined}
    >
      {(dims: ContainerDimensions) =>
        videoId === 'classic'
          ? <VideoCarousel videos={campaign.videos} settings={videoSettings} breakpoint={breakpoint} maxWidth={dims.width} />
          : renderAdapterForSection(videoId, campaign.videos, videoSettings, dims, campaign, isAdmin)
      }
    </GallerySectionWrapper>
  );

  const imageSection = hasImages && (
    <GallerySectionWrapper
      settings={s}
      bgType={s.imageBgType}
      bgColor={s.imageBgColor}
      bgGradient={s.imageBgGradient}
      bgImageUrl={s.imageBgImageUrl}
      borderRadius={s.imageBorderRadius}
      style={s.perTypeSectionEqualHeight ? { minHeight: '100%' } : undefined}
    >
      {(dims: ContainerDimensions) =>
        imageId === 'classic'
          ? <ImageCarousel images={campaign.images} settings={imageSettings} breakpoint={breakpoint} maxWidth={dims.width} />
          : renderAdapterForSection(imageId, campaign.images, imageSettings, dims, campaign, isAdmin)
      }
    </GallerySectionWrapper>
  );

  if (s.perTypeSectionEqualHeight && hasVideos && hasImages) {
    return (
      <SimpleGrid
        cols={{ base: 1, md: 2 }}
        spacing={s.modalGalleryGap ?? 32}
        style={{ alignItems: 'stretch' }}
      >
        {videoSection}
        {imageSection}
      </SimpleGrid>
    );
  }

  return (
    <Stack gap={s.modalGalleryGap ?? 32} style={{ width: '100%' }}>
      {videoSection}
      {imageSection}
    </Stack>
  );
}
