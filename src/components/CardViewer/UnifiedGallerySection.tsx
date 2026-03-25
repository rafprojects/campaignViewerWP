/**
 * P22-P2: Unified Gallery Section
 *
 * Renders all campaign media (images + videos) in a single adapter,
 * wrapped in a GallerySectionWrapper that provides container dimensions.
 */
import { lazy } from 'react';
import type { Campaign, GalleryBehaviorSettings, ContainerDimensions } from '@/types';
import { normalizeAdapterId, resolveAdapter } from '@/components/Galleries/Adapters/adapterRegistry';
import type { Breakpoint } from '@/hooks/useBreakpoint';
import { resolveEffectiveGallerySettings, resolveUnifiedAdapterId } from '@/utils/resolveAdapterId';
import { GallerySectionWrapper } from './GallerySectionWrapper';
const LayoutBuilderGallery = lazy(() =>
  import('@/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery').then((m) => ({ default: m.LayoutBuilderGallery })),
);

interface UnifiedGallerySectionProps {
  campaign: Campaign;
  settings: GalleryBehaviorSettings;
  breakpoint: Breakpoint;
  isAdmin: boolean;
}

export function UnifiedGallerySection({ campaign, settings: s, breakpoint, isAdmin }: UnifiedGallerySectionProps) {
  const allMedia = [...campaign.videos, ...campaign.images].sort((a, b) => a.order - b.order);
  if (allMedia.length === 0) return null;

  const resolvedSettings = resolveEffectiveGallerySettings(s, breakpoint, 'unified', campaign.galleryOverrides);
  const effectiveId = normalizeAdapterId(
    resolveUnifiedAdapterId(s, breakpoint, {
      galleryOverrides: campaign.galleryOverrides,
      legacyOverrideId: campaign.imageAdapterId,
    }),
  );

  return (
    <GallerySectionWrapper
      settings={resolvedSettings}
      bgType={resolvedSettings.unifiedBgType}
      bgColor={resolvedSettings.unifiedBgColor}
      bgGradient={resolvedSettings.unifiedBgGradient}
      bgImageUrl={resolvedSettings.unifiedBgImageUrl}
      borderRadius={resolvedSettings.imageBorderRadius}
    >
      {(containerDimensions: ContainerDimensions) => {
        if (effectiveId === 'layout-builder' && campaign.layoutTemplateId) {
          return (
            <LayoutBuilderGallery
              media={allMedia}
              settings={resolvedSettings}
              templateId={campaign.layoutTemplateId}
              isAdmin={isAdmin}
              containerDimensions={containerDimensions}
            />
          );
        }
        const Adapter = resolveAdapter(effectiveId);
        return <Adapter media={allMedia} settings={resolvedSettings} containerDimensions={containerDimensions} />;
      }}
    </GallerySectionWrapper>
  );
}
