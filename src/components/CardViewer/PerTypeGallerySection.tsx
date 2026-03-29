/**
 * P22-P2: Per-Type Gallery Section
 *
 * Renders separate Video and Image gallery sections, each wrapped in
 * its own GallerySectionWrapper. Supports optional equal-height
 * side-by-side layout via SimpleGrid at tablet+.
 */
import { SimpleGrid, Stack } from '@mantine/core';
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import {
  resolvePerTypeCampaignGalleryRenderPlan,
  shouldUseEqualHeightPerTypeLayout,
} from '@/utils/campaignGalleryRenderPlan';

import { CampaignGalleryAdapterRenderer } from './CampaignGalleryAdapterRenderer';
import { GallerySectionWrapper } from './GallerySectionWrapper';

interface PerTypeGallerySectionProps {
  campaign: Campaign;
  settings: GalleryBehaviorSettings;
  breakpoint: Breakpoint;
  isAdmin: boolean;
}

export function PerTypeGallerySection({ campaign, settings: s, breakpoint, isAdmin }: PerTypeGallerySectionProps) {
  const videoPlan = resolvePerTypeCampaignGalleryRenderPlan(campaign, s, breakpoint, 'video');
  const imagePlan = resolvePerTypeCampaignGalleryRenderPlan(campaign, s, breakpoint, 'image');
  const useEqualHeight = shouldUseEqualHeightPerTypeLayout(videoPlan, imagePlan);

  const videoSection = videoPlan && (
    <GallerySectionWrapper
      settings={videoPlan.settings}
      bgType={videoPlan.wrapper.bgType}
      bgColor={videoPlan.wrapper.bgColor}
      bgGradient={videoPlan.wrapper.bgGradient}
      bgImageUrl={videoPlan.wrapper.bgImageUrl}
      borderRadius={videoPlan.wrapper.borderRadius}
      style={useEqualHeight ? { minHeight: '100%' } : undefined}
    >
      {(dims) => (
        <CampaignGalleryAdapterRenderer
          adapterId={videoPlan.adapterId}
          media={videoPlan.media}
          settings={videoPlan.settings}
          campaign={campaign}
          isAdmin={isAdmin}
          containerDimensions={dims}
        />
      )}
    </GallerySectionWrapper>
  );

  const imageSection = imagePlan && (
    <GallerySectionWrapper
      settings={imagePlan.settings}
      bgType={imagePlan.wrapper.bgType}
      bgColor={imagePlan.wrapper.bgColor}
      bgGradient={imagePlan.wrapper.bgGradient}
      bgImageUrl={imagePlan.wrapper.bgImageUrl}
      borderRadius={imagePlan.wrapper.borderRadius}
      style={useEqualHeight ? { minHeight: '100%' } : undefined}
    >
      {(dims) => (
        <CampaignGalleryAdapterRenderer
          adapterId={imagePlan.adapterId}
          media={imagePlan.media}
          settings={imagePlan.settings}
          campaign={campaign}
          isAdmin={isAdmin}
          containerDimensions={dims}
        />
      )}
    </GallerySectionWrapper>
  );

  if (useEqualHeight && videoPlan && imagePlan) {
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
