/**
 * P35-H: Listing-mode branch tests for all listing-compatible adapters.
 *
 * Verifies that each adapter renders the correct container and item wrappers
 * when called with `items` + `renderItem` + `listingMode`.  Also guards the
 * default CompactGrid layout with a DOM snapshot so accidental regressions
 * in the byte-identical grid are caught automatically.
 *
 * Adapters under test:
 *   - CompactGridGallery  (P35-D)  → card-gallery-grid / card-responsive-wrapper / card-fixed-wrapper
 *   - MasonryGallery      (P35-E)  → masonry-listing-grid / masonry-listing-item
 *   - JustifiedGallery    (P35-F)  → justified-listing-grid / justified-listing-item
 *   - MediaCarouselAdapter (P35-G) → campaign-listing-carousel
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import type { ReactNode } from 'react';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';
import type { ListingItem } from './GalleryAdapter';
import { CompactGridGallery } from './compact-grid/CompactGridGallery';
import { MasonryGallery } from './masonry/MasonryGallery';
import { JustifiedGallery } from './justified/JustifiedGallery';
import { MediaCarouselAdapter } from './MediaCarouselAdapter';

// ── Shared helpers ────────────────────────────────────────────────────────────

const makeItem = (id: string): ListingItem => ({ id });

const makeItems = (n: number) =>
  Array.from({ length: n }, (_, i) => makeItem(`item-${i + 1}`));

const renderItem = (item: ListingItem, _idx: number): ReactNode => (
  <div data-testid="rendered-item" data-item-id={item.id}>
    {item.id}
  </div>
);

const LISTING_MODE = { surface: 'campaign-listing' as const };

// ── CompactGridGallery (P35-D) ────────────────────────────────────────────────

describe('CompactGridGallery listing mode (P35-D)', () => {
  it('renders the grid container testid', () => {
    const items = makeItems(4);
    render(
      <CompactGridGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getByTestId('card-gallery-grid')).toBeInTheDocument();
  });

  it('renders one responsive wrapper per item when cardMaxWidth is 0', () => {
    const items = makeItems(3);
    render(
      <CompactGridGallery
        media={[]}
        settings={{ ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, cardMaxWidth: 0 }}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    const wrappers = screen.getAllByTestId('card-responsive-wrapper');
    expect(wrappers).toHaveLength(3);
  });

  it('renders one fixed wrapper per item when cardMaxWidth > 0', () => {
    const items = makeItems(3);
    render(
      <CompactGridGallery
        media={[]}
        settings={{ ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, cardMaxWidth: 200 }}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
        containerDimensions={{ width: 900, height: 0 }}
      />,
    );
    const wrappers = screen.getAllByTestId('card-fixed-wrapper');
    expect(wrappers).toHaveLength(3);
  });

  it('calls renderItem for each item', () => {
    const items = makeItems(5);
    const mockRenderItem = vi.fn(renderItem);
    render(
      <CompactGridGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={mockRenderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(mockRenderItem).toHaveBeenCalledTimes(5);
  });

  it('does not render media-mode lightbox in listing mode', () => {
    const items = makeItems(2);
    render(
      <CompactGridGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    // Lightbox portal doesn't exist in listing mode
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('snapshot: responsive-grid structure at default settings with 4 items', () => {
    const items = makeItems(4);
    const { container } = render(
      <CompactGridGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    // Snapshot the inner grid element (not the full document fragment).
    expect(container.querySelector('[data-testid="card-gallery-grid"]')).toMatchSnapshot();
  });
});

// ── MasonryGallery (P35-E) ────────────────────────────────────────────────────

describe('MasonryGallery listing mode (P35-E)', () => {
  it('renders the masonry grid container', () => {
    const items = makeItems(3);
    render(
      <MasonryGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getByTestId('masonry-listing-grid')).toBeInTheDocument();
  });

  it('renders one listing item per campaign', () => {
    const items = makeItems(5);
    render(
      <MasonryGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getAllByTestId('masonry-listing-item')).toHaveLength(5);
  });

  it('uses CSS columns layout for masonry stacking', () => {
    const items = makeItems(3);
    render(
      <MasonryGallery
        media={[]}
        settings={{ ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS, cardGridColumns: 3 }}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    const grid = screen.getByTestId('masonry-listing-grid');
    expect(grid).toHaveStyle({ columns: '3' });
  });

  it('does not render MasonryPhotoAlbum in listing mode', () => {
    const items = makeItems(2);
    render(
      <MasonryGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    // react-photo-album uses a specific class; it should not appear
    expect(document.querySelector('.react-photo-album--masonry')).not.toBeInTheDocument();
  });
});

// ── JustifiedGallery (P35-F) ──────────────────────────────────────────────────

describe('JustifiedGallery listing mode (P35-F)', () => {
  it('renders the justified grid container', () => {
    const items = makeItems(3);
    render(
      <JustifiedGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getByTestId('justified-listing-grid')).toBeInTheDocument();
  });

  it('renders one listing item per campaign', () => {
    const items = makeItems(4);
    render(
      <JustifiedGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getAllByTestId('justified-listing-item')).toHaveLength(4);
  });

  it('uses flex display for justified rows', () => {
    const items = makeItems(2);
    render(
      <JustifiedGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getByTestId('justified-listing-grid')).toHaveStyle({ display: 'flex' });
  });

  it('does not render RowsPhotoAlbum in listing mode', () => {
    const items = makeItems(2);
    render(
      <JustifiedGallery
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(document.querySelector('.react-photo-album--rows')).not.toBeInTheDocument();
  });
});

// ── MediaCarouselAdapter (P35-G) ──────────────────────────────────────────────

describe('MediaCarouselAdapter listing mode (P35-G)', () => {
  it('renders the campaign listing carousel container', () => {
    const items = makeItems(3);
    render(
      <MediaCarouselAdapter
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getByTestId('campaign-listing-carousel')).toBeInTheDocument();
  });

  it('renders all items as carousel slides', () => {
    const items = makeItems(4);
    render(
      <MediaCarouselAdapter
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(screen.getAllByRole('group')).toHaveLength(4);
  });

  it('calls renderItem for each item', () => {
    const items = makeItems(3);
    const mockRenderItem = vi.fn(renderItem);
    render(
      <MediaCarouselAdapter
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={items}
        renderItem={mockRenderItem}
        listingMode={LISTING_MODE}
      />,
    );
    expect(mockRenderItem).toHaveBeenCalledTimes(3);
  });

  it('does not render carousel when items array is empty', () => {
    render(
      <MediaCarouselAdapter
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={[]}
        renderItem={renderItem}
        listingMode={LISTING_MODE}
      />,
    );
    // Empty items → listing branch skipped (guard: items.length > 0)
    // → media.length===0 guard fires → component renders null
    expect(screen.queryByTestId('campaign-listing-carousel')).not.toBeInTheDocument();
  });

  it('does not mount listing carousel when listingMode is absent', () => {
    render(
      <MediaCarouselAdapter
        media={[]}
        settings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        items={makeItems(3)}
        renderItem={renderItem}
        // No listingMode prop → regular media path
      />,
    );
    // media.length===0 guard fires; carousel is not rendered
    expect(screen.queryByTestId('campaign-listing-carousel')).not.toBeInTheDocument();
  });
});
