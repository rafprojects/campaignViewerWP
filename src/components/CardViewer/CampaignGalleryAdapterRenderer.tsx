import { lazy } from 'react';

import { resolveAdapter } from '@/components/Galleries/Adapters/adapterRegistry';
import type { ApiClient } from '@/services/apiClient';
import type {
  Campaign,
  ContainerDimensions,
  GalleryBehaviorSettings,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const LayoutBuilderGallery = lazy(() =>
  import('@/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery').then((module) => ({
    default: module.LayoutBuilderGallery,
  })),
);

interface CampaignGalleryAdapterRendererProps {
  adapterId: string;
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime: ResolvedGallerySectionRuntime;
  containerDimensions: ContainerDimensions;
  campaign: Campaign;
  isAdmin: boolean;
  apiClient?: ApiClient | undefined;
}

export function CampaignGalleryAdapterRenderer({
  adapterId,
  media,
  settings,
  runtime,
  containerDimensions,
  campaign,
  isAdmin,
  apiClient,
}: CampaignGalleryAdapterRendererProps) {
  if (adapterId === 'layout-builder' && campaign.layoutTemplateId) {
    return (
      <LayoutBuilderGallery
        media={media}
        settings={settings}
        runtime={runtime}
        templateId={campaign.layoutTemplateId}
        isAdmin={isAdmin}
        containerDimensions={containerDimensions}
        campaignId={String(campaign.id)}
        apiClient={apiClient}
      />
    );
  }

  const Adapter = resolveAdapter(adapterId);
  return <Adapter media={media} settings={settings} runtime={runtime} containerDimensions={containerDimensions} />;
}

setWpsgDebugDisplayName(CampaignGalleryAdapterRenderer, 'CampaignGalleryAdapterRenderer');
