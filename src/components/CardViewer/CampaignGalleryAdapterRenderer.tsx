import { lazy } from 'react';

import { resolveAdapter } from '@/components/Galleries/Adapters/adapterRegistry';
import type {
  Campaign,
  ContainerDimensions,
  GalleryBehaviorSettings,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';

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
}

export function CampaignGalleryAdapterRenderer({
  adapterId,
  media,
  settings,
  runtime,
  containerDimensions,
  campaign,
  isAdmin,
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
      />
    );
  }

  const Adapter = resolveAdapter(adapterId);
  return <Adapter media={media} settings={settings} runtime={runtime} containerDimensions={containerDimensions} />;
}