/**
 * P51-E: regression test for the scroll-snap "infinite growth" bug.
 *
 * The pager must take a bounded, fixed height. The measured section height
 * (`containerDimensions.height`) is only safe to adopt when the section is
 * itself height-bounded (`viewport`/`manual` modes). In the default `auto`
 * mode the section is content-sized, so adopting the measurement would feed a
 * runaway growth loop — the adapter must fall back to its fixed default instead.
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
import { ScrollSnapGallery } from './ScrollSnapGallery';

const settings: GalleryBehaviorSettings = { ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS };

/**
 * Build a runtime whose resolved `common.sectionHeightMode` is fixed. The
 * adapter (like GallerySectionWrapper) reads the height mode from the resolved
 * common settings, so the runtime override is the source of truth here.
 */
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

const media: MediaItem[] = [
  { id: '1', url: 'a.jpg', type: 'image' } as MediaItem,
  { id: '2', url: 'b.jpg', type: 'image' } as MediaItem,
  { id: '3', url: 'c.jpg', type: 'image' } as MediaItem,
];

/** Find the scroll-snap container by its inline scroll-snap-type style. */
function findSnapContainer(root: HTMLElement): HTMLElement {
  const el = root.querySelector('div[style*="scroll-snap-type"]');
  if (!el) throw new Error('snap container not found');
  return el as HTMLElement;
}

describe('ScrollSnapGallery height binding', () => {
  it('ignores an unbounded measured height in auto mode (fixed fallback)', () => {
    const { container } = render(
      <ScrollSnapGallery
        media={media}
        settings={settings}
        runtime={runtimeWithHeightMode('auto')}
        containerDimensions={{ width: 800, height: 99999 }}
      />,
    );
    const snap = findSnapContainer(container);
    expect(snap.style.height).toBe('500px');
    expect(snap.style.height).not.toBe('99999px');
  });

  it('adopts the measured height when the section is height-bounded', () => {
    const { container } = render(
      <ScrollSnapGallery
        media={media}
        settings={settings}
        runtime={runtimeWithHeightMode('viewport')}
        containerDimensions={{ width: 800, height: 600 }}
      />,
    );
    const snap = findSnapContainer(container);
    expect(snap.style.height).toBe('600px');
  });
});
