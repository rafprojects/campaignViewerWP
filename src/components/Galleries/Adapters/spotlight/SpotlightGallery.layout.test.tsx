/**
 * P51-E: tests for the spotlight hero layout fixes —
 *  - `spotlightHeroMaxWidth` caps the hero+strip block (so raising it enlarges
 *    the hero instead of just shifting the gallery), and
 *  - the block is positioned by the shared `adapterJustifyContent` setting
 *    (giving the previously-missing justification control in "Below" mode).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import type { GalleryBehaviorSettings, MediaItem } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import { SpotlightGallery } from './SpotlightGallery';

// useCarousel + useLightbox now live in the shared-utils barrel (P51-B): spread
// the real module and override just these two.
vi.mock('@wp-super-gallery/shared-utils', async () => {
  const actual = await vi.importActual<typeof import('@wp-super-gallery/shared-utils')>('@wp-super-gallery/shared-utils');
  return {
    ...actual,
    useCarousel: () => ({ currentIndex: 0, setCurrentIndex: vi.fn(), next: vi.fn(), prev: vi.fn() }),
    useLightbox: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
  };
});
vi.mock('@wp-super-gallery/shared-ui', () => ({
  Lightbox: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="lightbox-open" /> : null),
}));
vi.mock('@/components/CampaignGallery/LazyImage', () => ({
  LazyImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const media: MediaItem[] = [
  { id: '1', url: 'a.jpg', type: 'image' } as MediaItem,
  { id: '2', url: 'b.jpg', type: 'image' } as MediaItem,
];

const divStyles = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('div')];

describe('SpotlightGallery hero layout', () => {
  it('caps the hero+strip block at the configured Hero Max Width', () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      spotlightHeroMaxWidth: 400,
      spotlightHeroMaxWidthUnit: 'px',
    };
    const { container } = render(<SpotlightGallery media={media} settings={settings} />);
    const capped = divStyles(container).filter((d) => d.style.maxWidth === '400px');
    expect(capped.length).toBeGreaterThan(0);
    // The capped block also fills available width so the hero grows up to the cap.
    expect(capped.some((d) => d.style.width === '100%')).toBe(true);
  });

  it('positions the block using the dedicated spotlightHeroJustification setting', () => {
    const settings: GalleryBehaviorSettings = {
      ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
      spotlightHeroMaxWidth: 400,
      spotlightHeroMaxWidthUnit: 'px',
      spotlightHeroJustification: 'end',
    };
    const { container } = render(<SpotlightGallery media={media} settings={settings} />);
    expect(divStyles(container).some((d) => d.style.justifyContent === 'flex-end')).toBe(true);
  });
});
