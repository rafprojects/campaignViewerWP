/**
 * P51-E: regression test that the fixed-stage adapters (Coverflow, Stacked)
 * bind their stage height through resolveBoundedSectionHeight — so an unbounded
 * measured height in the default `auto` mode is ignored (fixed fallback) and a
 * measured height is only adopted when the section is height-bounded.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import type {
  GalleryBehaviorSettings,
  GalleryCommonSettings,
  MediaItem,
  ResolvedGallerySectionRuntime,
} from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import { CoverflowAdapter } from '../coverflow/CoverflowAdapter';
import { StackedDeckAdapter } from '../stacked/StackedDeckAdapter';

vi.mock('@/hooks/useCarousel', () => ({
  useCarousel: () => ({ currentIndex: 0, setCurrentIndex: vi.fn(), next: vi.fn(), prev: vi.fn() }),
}));
vi.mock('@/hooks/useLightbox', () => ({
  useLightbox: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock('@wp-super-gallery/shared-ui', () => ({
  Lightbox: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="lightbox-open" /> : null),
}));
vi.mock('@/components/CampaignGallery/LazyImage', () => ({
  LazyImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const settings: GalleryBehaviorSettings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS };
const media: MediaItem[] = [
  { id: '1', url: 'a.jpg', type: 'image' } as MediaItem,
  { id: '2', url: 'b.jpg', type: 'image' } as MediaItem,
  { id: '3', url: 'c.jpg', type: 'image' } as MediaItem,
];

function runtimeWithHeightMode(
  mode: GalleryCommonSettings['sectionHeightMode'],
): ResolvedGallerySectionRuntime {
  return {
    breakpoint: 'desktop',
    scope: 'image',
    common: { sectionHeightMode: mode } as GalleryCommonSettings,
    background: { type: 'none', color: '', gradient: '', imageUrl: '' },
    adapterSettings: {},
  } as ResolvedGallerySectionRuntime;
}

/** All inline pixel heights present in the rendered tree. */
function pixelHeights(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('div')]
    .map((d) => d.style.height)
    .filter((h) => h.endsWith('px'));
}

describe.each([
  ['CoverflowAdapter', CoverflowAdapter, 500],
  ['StackedDeckAdapter', StackedDeckAdapter, 480],
] as const)('%s stage height binding', (_name, Adapter, fallback) => {
  it('ignores an unbounded measured height in auto mode', () => {
    const { container } = render(
      <Adapter
        media={media}
        settings={settings}
        runtime={runtimeWithHeightMode('auto')}
        containerDimensions={{ width: 800, height: 99999 }}
      />,
    );
    const heights = pixelHeights(container);
    expect(heights).toContain(`${fallback}px`);
    expect(heights).not.toContain('99999px');
  });

  it('adopts the measured height when the section is height-bounded', () => {
    const { container } = render(
      <Adapter
        media={media}
        settings={settings}
        runtime={runtimeWithHeightMode('viewport')}
        containerDimensions={{ width: 800, height: 620 }}
      />,
    );
    expect(pixelHeights(container)).toContain('620px');
  });
});
