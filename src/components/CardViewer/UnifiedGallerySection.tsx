/**
 * P22-P2: Unified Gallery Section
 *
 * Renders all campaign media (images + videos) in a single adapter,
 * wrapped in a GallerySectionWrapper that provides container dimensions.
 */
import type { Campaign, GalleryBehaviorSettings } from '@/types';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import type { ApiClient } from '@/services/apiClient';
import { resolveUnifiedCampaignGalleryRenderPlan } from '@/utils/campaignGalleryRenderPlan';

import { CampaignGalleryAdapterRenderer } from './CampaignGalleryAdapterRenderer';
import { GallerySectionWrapper } from './GallerySectionWrapper';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface UnifiedGallerySectionProps {
  campaign: Campaign;
  settings: GalleryBehaviorSettings;
  breakpoint: Breakpoint;
  isAdmin: boolean;
  apiClient?: ApiClient | undefined;
}

export function UnifiedGallerySection({ campaign, settings: s, breakpoint, isAdmin, apiClient }: UnifiedGallerySectionProps) {
  const plan = resolveUnifiedCampaignGalleryRenderPlan(campaign, s, breakpoint);
  if (!plan) return null;

  return (
    <GallerySectionWrapper
      settings={plan.settings}
      runtime={plan.runtime}
      bgType={plan.wrapper.bgType}
      bgColor={plan.wrapper.bgColor}
      bgGradient={plan.wrapper.bgGradient}
      bgImageUrl={plan.wrapper.bgImageUrl}
      borderRadius={plan.wrapper.borderRadius}
    >
      {(containerDimensions) => (
        <CampaignGalleryAdapterRenderer
          adapterId={plan.adapterId}
          media={plan.media}
          settings={plan.settings}
          runtime={plan.runtime}
          campaign={campaign}
          isAdmin={isAdmin}
          containerDimensions={containerDimensions}
          apiClient={apiClient}
        />
      )}
    </GallerySectionWrapper>
  );
}

setWpsgDebugDisplayName(UnifiedGallerySection, 'UnifiedGallerySection');
