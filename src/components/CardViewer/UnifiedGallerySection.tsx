/**
 * P22-P2: Unified Gallery Section
 *
 * Renders all campaign media (images + videos) in a single adapter,
 * wrapped in a GallerySectionWrapper that provides container dimensions.
 */
import { lazy, type ComponentType } from 'react';
import type { Campaign, GalleryBehaviorSettings, ContainerDimensions } from '@/types';
import type { GalleryAdapterProps } from '@/components/Galleries/Adapters/GalleryAdapter';
import { GallerySectionWrapper } from './GallerySectionWrapper';

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

interface UnifiedGallerySectionProps {
  campaign: Campaign;
  settings: GalleryBehaviorSettings;
  isAdmin: boolean;
}

export function UnifiedGallerySection({ campaign, settings: s, isAdmin }: UnifiedGallerySectionProps) {
  const allMedia = [...campaign.videos, ...campaign.images].sort((a, b) => a.order - b.order);
  if (allMedia.length === 0) return null;

  const effectiveId = campaign.imageAdapterId || s.unifiedGalleryAdapterId;

  return (
    <GallerySectionWrapper
      settings={s}
      bgType={s.unifiedBgType}
      bgColor={s.unifiedBgColor}
      bgGradient={s.unifiedBgGradient}
      bgImageUrl={s.unifiedBgImageUrl}
      borderRadius={s.imageBorderRadius}
    >
      {(containerDimensions: ContainerDimensions) => {
        if (effectiveId === 'layout-builder' && campaign.layoutTemplateId) {
          return (
            <LayoutBuilderGallery
              media={allMedia}
              settings={s}
              templateId={campaign.layoutTemplateId}
              isAdmin={isAdmin}
              containerDimensions={containerDimensions}
            />
          );
        }
        const Adapter = resolveAdapterComponent(effectiveId);
        return <Adapter media={allMedia} settings={s} containerDimensions={containerDimensions} />;
      }}
    </GallerySectionWrapper>
  );
}
