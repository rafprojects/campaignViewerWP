import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@/test/test-utils';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type MediaItem } from '@/types';

import { MediaCarouselInner } from './MediaCarouselAdapter';

vi.mock('@/components/Galleries/Shared/Lightbox', () => ({
  Lightbox: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="lightbox-open" /> : null),
}));

function makeImage(id: string, caption: string, order: number): MediaItem {
  return {
    id,
    type: 'image',
    source: 'upload',
    url: `https://example.com/${id}.jpg`,
    thumbnail: `https://example.com/${id}-thumb.jpg`,
    caption,
    order,
    width: 800,
    height: 600,
  };
}

describe('MediaCarouselInner', () => {
  const media = [
    makeImage('one', 'Caption One', 0),
    makeImage('two', 'Caption Two', 1),
    makeImage('three', 'Caption Three', 2),
    makeImage('four', 'Caption Four', 3),
  ];

  const settings = {
    ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
    carouselVisibleCards: 3,
    carouselLoop: true,
    carouselDarkenUnfocused: true,
    dotNavEnabled: true,
    dotNavPosition: 'below' as const,
  };

  it('treats the centered multi-card slide as the active item', () => {
    render(
      <MediaCarouselInner
        media={media}
        settings={settings}
        breakpoint="desktop"
        maxWidth={1200}
      />,
    );

    expect(screen.getByText('Caption Two')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Go to slide 2' })).toHaveAttribute('aria-selected', 'true');
  });

  it('advances the centered focus as arrows move the carousel', () => {
    render(
      <MediaCarouselInner
        media={media}
        settings={settings}
        breakpoint="desktop"
        maxWidth={1200}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next image (overlay)' }));

    expect(screen.getByText('Caption Three')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Go to slide 3' })).toHaveAttribute('aria-selected', 'true');
  });

  it('centers the requested slide when dot navigation is used', () => {
    render(
      <MediaCarouselInner
        media={media}
        settings={settings}
        breakpoint="desktop"
        maxWidth={1200}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Go to slide 4' }));

    expect(screen.getByText('Caption Four')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Go to slide 4' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps small multi-card loop sets instead of stopping on an empty trailing frame', () => {
    render(
      <MediaCarouselInner
        media={media}
        settings={settings}
        breakpoint="desktop"
        maxWidth={1200}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next image (overlay)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next image (overlay)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next image (overlay)' }));

    expect(screen.getByText('Caption One')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Go to slide 1' })).toHaveAttribute('aria-selected', 'true');
  });

  // P25-K: Autoplay lifecycle tests
  it('renders without crash when autoplay is enabled', () => {
    const autoplaySettings = {
      ...settings,
      carouselAutoplay: true,
      carouselAutoplaySpeed: 3000,
    };

    render(
      <MediaCarouselInner
        media={media}
        settings={autoplaySettings}
        breakpoint="desktop"
        maxWidth={1200}
      />,
    );

    // Verify it rendered without crash (uses same assertion as other tests in this suite)
    expect(screen.getByText('Caption Two')).toBeInTheDocument();
  });

  it('renders without autoplay plugin when autoplay is disabled', () => {
    const noAutoplaySettings = {
      ...settings,
      carouselAutoplay: false,
    };

    render(
      <MediaCarouselInner
        media={media}
        settings={noAutoplaySettings}
        breakpoint="desktop"
        maxWidth={1200}
      />,
    );

    expect(screen.getByText('Caption Two')).toBeInTheDocument();
  });
});