import { Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';

vi.mock('./GallerySectionWrapper', () => ({
  GallerySectionWrapper: ({
    bgType,
    bgColor,
    bgGradient,
    bgImageUrl,
    borderRadius,
    children,
  }: {
    bgType: string;
    bgColor: string;
    bgGradient: string;
    bgImageUrl: string;
    borderRadius?: number;
    children: (dimensions: { width: number; height: number }) => React.ReactNode;
  }) => (
    <div
      data-testid="gallery-section-wrapper"
      data-bg-type={bgType}
      data-bg-color={bgColor}
      data-bg-gradient={bgGradient}
      data-bg-image-url={bgImageUrl}
      data-border-radius={borderRadius}
    >
      {children({ width: 800, height: 600 })}
    </div>
  ),
}));

vi.mock('@/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery', () => ({
  LayoutBuilderGallery: ({ media, templateId }: { media: Array<{ id: string }>; templateId: string }) => (
    <div data-testid="layout-builder-gallery" data-template-id={templateId}>
      {media.map((item) => item.id).join(',')}
    </div>
  ),
}));

vi.mock('@/components/Galleries/Adapters/adapterRegistry', async () => {
  const actual = await vi.importActual<typeof import('@/components/Galleries/Adapters/adapterRegistry')>('@/components/Galleries/Adapters/adapterRegistry');

  return {
    ...actual,
    resolveAdapter: (id: string) => {
      function MockAdapter({ media }: { media: Array<{ id: string }> }) {
        return <div data-testid={`adapter-${id}`}>{media.map((item) => item.id).join(',')}</div>;
      }

      return MockAdapter;
    },
  };
});

import { UnifiedGallerySection } from './UnifiedGallerySection';
import { PerTypeGallerySection } from './PerTypeGallerySection';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type Campaign, type Company, type GalleryBehaviorSettings, type MediaItem } from '@/types';

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: '',
  brandColor: '#123456',
};

const image: MediaItem = {
  id: 'image-1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 2,
};

const video: MediaItem = {
  id: 'video-1',
  type: 'video',
  source: 'upload',
  url: 'https://example.com/video.mp4',
  thumbnail: 'https://example.com/video.jpg',
  order: 1,
};

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: '1',
    companyId: company.id,
    company,
    title: 'Campaign',
    description: 'Description',
    thumbnail: 'https://example.com/thumb.jpg',
    coverImage: 'https://example.com/cover.jpg',
    videos: [video],
    images: [image],
    tags: ['tag'],
    status: 'active',
    visibility: 'private',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function renderWithSuspense(node: React.ReactNode) {
  return render(<Suspense fallback={<div data-testid="loading-gallery" />}>{node}</Suspense>);
}

function makeSettings(overrides: Partial<GalleryBehaviorSettings> = {}): GalleryBehaviorSettings {
  return {
    ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
    ...overrides,
  };
}

describe('UnifiedGallerySection', () => {
  it('renders the layout builder gallery when the resolved unified adapter is layout-builder and a template is assigned', async () => {
    const settings = makeSettings({
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'layout-builder',
            },
          },
        },
      },
    });

    renderWithSuspense(
      <UnifiedGallerySection
        campaign={makeCampaign({ layoutTemplateId: 'template-1' })}
        settings={settings}
        breakpoint="desktop"
        isAdmin={false}
      />,
    );

    expect(await screen.findByTestId('layout-builder-gallery')).toHaveAttribute('data-template-id', 'template-1');
    expect(screen.getByTestId('layout-builder-gallery')).toHaveTextContent('video-1,image-1');
  });

  it('falls back to the shared adapter resolver output when layout-builder is unsupported on mobile', () => {
    const settings = makeSettings({
      unifiedGalleryAdapterId: 'layout-builder',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          mobile: {
            unified: {
              adapterId: 'layout-builder',
            },
          },
        },
      },
    });

    renderWithSuspense(
      <UnifiedGallerySection
        campaign={makeCampaign()}
        settings={settings}
        breakpoint="mobile"
        isAdmin={false}
      />,
    );

    expect(screen.getByTestId('adapter-classic')).toHaveTextContent('video-1,image-1');
    expect(screen.queryByTestId('layout-builder-gallery')).not.toBeInTheDocument();
  });

  it('projects nested unified viewport background settings onto the wrapper props', () => {
    const settings = makeSettings({
      unifiedBgType: 'none',
      unifiedBgColor: '#000000',
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'classic',
              common: {
                viewportBgType: 'solid',
                viewportBgColor: '#112233',
              },
            },
          },
        },
      },
    });

    renderWithSuspense(
      <UnifiedGallerySection
        campaign={makeCampaign()}
        settings={settings}
        breakpoint="desktop"
        isAdmin={false}
      />,
    );

    expect(screen.getByTestId('gallery-section-wrapper')).toHaveAttribute('data-bg-type', 'solid');
    expect(screen.getByTestId('gallery-section-wrapper')).toHaveAttribute('data-bg-color', '#112233');
  });

  it('uses the max unified media border radius on the wrapper props', () => {
    const settings = makeSettings({
      imageBorderRadius: 8,
      videoBorderRadius: 8,
      galleryConfig: {
        mode: 'unified',
        breakpoints: {
          desktop: {
            unified: {
              adapterId: 'classic',
              adapterSettings: {
                imageBorderRadius: 14,
                videoBorderRadius: 18,
              },
            },
          },
        },
      },
    });

    renderWithSuspense(
      <UnifiedGallerySection
        campaign={makeCampaign()}
        settings={settings}
        breakpoint="desktop"
        isAdmin={false}
      />,
    );

    expect(screen.getByTestId('gallery-section-wrapper')).toHaveAttribute('data-border-radius', '18');
  });
});

describe('PerTypeGallerySection', () => {
  it('renders the layout builder gallery for per-type sections when the resolved adapter is layout-builder and a template is assigned', async () => {
    const settings = makeSettings({
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          desktop: {
            image: {
              adapterId: 'layout-builder',
            },
            video: {
              adapterId: 'classic',
            },
          },
        },
      },
    });

    renderWithSuspense(
      <PerTypeGallerySection
        campaign={makeCampaign({ layoutTemplateId: 'template-2' })}
        settings={settings}
        breakpoint="desktop"
        isAdmin={true}
      />,
    );

    expect(await screen.findByTestId('layout-builder-gallery')).toHaveAttribute('data-template-id', 'template-2');
    expect(screen.getByTestId('layout-builder-gallery')).toHaveTextContent('image-1');
    expect(screen.getByTestId('adapter-classic')).toHaveTextContent('video-1');
  });

  it('falls back from unsupported mobile layout-builder selections to classic for per-type sections', () => {
    const settings = makeSettings({
      imageGalleryAdapterId: 'classic',
      galleryConfig: {
        mode: 'per-type',
        breakpoints: {
          mobile: {
            image: {
              adapterId: 'layout-builder',
            },
          },
        },
      },
    });

    renderWithSuspense(
      <PerTypeGallerySection
        campaign={makeCampaign({ videos: [], images: [image] })}
        settings={settings}
        breakpoint="mobile"
        isAdmin={false}
      />,
    );

    expect(screen.getByTestId('adapter-classic')).toHaveTextContent('image-1');
    expect(screen.queryByTestId('layout-builder-gallery')).not.toBeInTheDocument();
  });
});