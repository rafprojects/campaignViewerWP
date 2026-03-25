/**
 * P22-P2: Per-Type Gallery Section
 *
 * Renders separate Video and Image gallery sections, each wrapped in
 * its own GallerySectionWrapper. Supports optional equal-height
 * side-by-side layout via SimpleGrid at tablet+.
 */
import { lazy } from 'react';
import { SimpleGrid, Stack } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings, ContainerDimensions, MediaItem } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { normalizeAdapterId, resolveAdapter } from '@/components/Galleries/Adapters/adapterRegistry';
import { resolveAdapterId, resolveEffectiveGallerySettings } from '@/utils/resolveAdapterId';
import { GallerySectionWrapper } from './GallerySectionWrapper';
const LayoutBuilderGallery = lazy(() =>
  import('@/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery').then((m) => ({ default: m.LayoutBuilderGallery })),
);

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
  const Adapter = resolveAdapter(id);
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

  const resolvedVideoSettings = resolveEffectiveGallerySettings(s, breakpoint, 'video', campaign.galleryOverrides);
  const resolvedImageSettings = resolveEffectiveGallerySettings(s, breakpoint, 'image', campaign.galleryOverrides);
  const videoId = normalizeAdapterId(resolveAdapterId(s, 'video', breakpoint, {
    galleryOverrides: campaign.galleryOverrides,
    legacyOverrideId: campaign.videoAdapterId,
  }));
  const imageId = normalizeAdapterId(resolveAdapterId(s, 'image', breakpoint, {
    galleryOverrides: campaign.galleryOverrides,
    legacyOverrideId: campaign.imageAdapterId,
  }));
  const videoSettings = {
    ...resolvedVideoSettings,
    tileSize: resolvedVideoSettings.videoTileSize ?? resolvedVideoSettings.tileSize,
  };
  const imageSettings = {
    ...resolvedImageSettings,
    tileSize: resolvedImageSettings.imageTileSize ?? resolvedImageSettings.tileSize,
  };
  const useEqualHeight = Boolean(videoSettings.perTypeSectionEqualHeight || imageSettings.perTypeSectionEqualHeight);

  const videoSection = hasVideos && (
    <GallerySectionWrapper
      settings={videoSettings}
      bgType={videoSettings.videoBgType}
      bgColor={videoSettings.videoBgColor}
      bgGradient={videoSettings.videoBgGradient}
      bgImageUrl={videoSettings.videoBgImageUrl}
      borderRadius={videoSettings.videoBorderRadius}
      style={useEqualHeight ? { minHeight: '100%' } : undefined}
    >
      {(dims: ContainerDimensions) =>
        renderAdapterForSection(videoId, campaign.videos, videoSettings, dims, campaign, isAdmin)
      }
    </GallerySectionWrapper>
  );

  const imageSection = hasImages && (
    <GallerySectionWrapper
      settings={imageSettings}
      bgType={imageSettings.imageBgType}
      bgColor={imageSettings.imageBgColor}
      bgGradient={imageSettings.imageBgGradient}
      bgImageUrl={imageSettings.imageBgImageUrl}
      borderRadius={imageSettings.imageBorderRadius}
      style={useEqualHeight ? { minHeight: '100%' } : undefined}
    >
      {(dims: ContainerDimensions) =>
        renderAdapterForSection(imageId, campaign.images, imageSettings, dims, campaign, isAdmin)
      }
    </GallerySectionWrapper>
  );

  if (useEqualHeight && hasVideos && hasImages) {
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
