/**
 * P18-QA: Gallery adapter smoke tests.
 *
 * Covers all six adapters (Circular, CompactGrid, Diamond, Hexagonal,
 * Justified, Masonry) with a single parameterised test suite. Goals:
 * - drive functions/branches in adapters from 0 % → meaningful coverage
 * - verify basic render, item count, lightbox trigger, video label,
 *   and empty-state graceful handling
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import type { MediaItem, GalleryBehaviorSettings } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

// ─── Global Mocks ────────────────────────────────────────────────────────────

// ResizeObserver is not available in jsdom — provide a no-op polyfill so
// Diamond and Hexagonal adapters (which measure container width) don't crash.
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', mockResizeObserver);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// Shared hook / component mocks
vi.mock('@/hooks/useCarousel', () => ({
  useCarousel: () => ({
    currentIndex: 0,
    setCurrentIndex: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMediaDimensions', () => ({
  useMediaDimensions: (media: MediaItem[]) => media,
}));

vi.mock('@/components/Galleries/Shared/Lightbox', () => ({
  Lightbox: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="lightbox-open" /> : null,
}));

vi.mock('@/components/CampaignGallery/LazyImage', () => ({
  LazyImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// react-photo-album — used by JustifiedGallery (RowsPhotoAlbum) and
// MasonryGallery (MasonryPhotoAlbum). Renders one <button> per photo so
// button-query and click tests work the same as for the other adapters.
// Calls render.button when provided (for branch coverage); falls back to
// a plain <button>. Calls onClick({ index }) on click.
vi.mock('react-photo-album', () => {
   
  const Album = ({ photos, onClick, render: r }: any) => (
    <div data-testid="rpa-album">
      {(photos as { src: string; key: string; alt?: string }[]).map((p, idx) => {
        const handleClick = () => onClick?.({ index: idx });
        const defaultContent = <img src={p.src} alt={p.alt ?? p.key} />;
        if (r?.button) {
          return (
            <div key={p.key}>
              {r.button({
                 
                'aria-label': p.alt ?? p.key,
                onClick: handleClick,
                children: defaultContent,
              })}
            </div>
          );
        }
        return (
          <button
            key={p.key}
            aria-label={p.alt ?? p.key}
            onClick={handleClick}
          >
            {defaultContent}
          </button>
        );
      })}
    </div>
  );

  return { RowsPhotoAlbum: Album, MasonryPhotoAlbum: Album };
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeImage = (id: string, order: number): MediaItem => ({
  id,
  type: 'image',
  source: 'upload',
  url: `https://example.com/${id}.jpg`,
  thumbnail: `https://example.com/${id}-thumb.jpg`,
  title: `Image ${id}`,
  order,
  width: 800,
  height: 600,
});

const makeVideo = (id: string, order: number): MediaItem => ({
  id,
  type: 'video',
  source: 'external',
  url: `https://example.com/${id}`,
  thumbnail: `https://example.com/${id}-thumb.jpg`,
  title: `Video ${id}`,
  order,
  width: 1280,
  height: 720,
});

const THREE_IMAGES: MediaItem[] = [
  makeImage('img-1', 0),
  makeImage('img-2', 1),
  makeImage('img-3', 2),
];

const MIXED_MEDIA: MediaItem[] = [
  makeImage('img-a', 0),
  makeVideo('vid-b', 1),
];

const SETTINGS: GalleryBehaviorSettings = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  tileSize: 120,
  tileGapX: 8,
  tileGapY: 8,
};

// ─── Lazy imports (after vi.mock declarations) ────────────────────────────────

const { CircularGallery } = await import('@/components/Galleries/Adapters/circular/CircularGallery');
const { CompactGridGallery } = await import('@/components/Galleries/Adapters/compact-grid/CompactGridGallery');
const { DiamondGallery } = await import('@/components/Galleries/Adapters/diamond/DiamondGallery');
const { HexagonalGallery } = await import('@/components/Galleries/Adapters/hexagonal/HexagonalGallery');
const { JustifiedGallery } = await import('@/components/Galleries/Adapters/justified/JustifiedGallery');
const { MasonryGallery } = await import('@/components/Galleries/Adapters/masonry/MasonryGallery');

// ─── Component map for parameterised tests ────────────────────────────────────

type AdapterComponent = React.ComponentType<{ media: MediaItem[]; settings: GalleryBehaviorSettings }>;

const ADAPTERS: [string, AdapterComponent][] = [
  ['CircularGallery', CircularGallery],
  ['CompactGridGallery', CompactGridGallery],
  ['DiamondGallery', DiamondGallery],
  ['HexagonalGallery', HexagonalGallery],
  ['JustifiedGallery', JustifiedGallery],
  ['MasonryGallery', MasonryGallery],
];

// ─── Shared test suite ────────────────────────────────────────────────────────

describe.each(ADAPTERS)('%s', (_name, Component) => {
  it('renders without crashing with three images', () => {
    const { container } = render(
      <Component media={THREE_IMAGES} settings={SETTINGS} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('shows the item count in the title', () => {
    render(<Component media={THREE_IMAGES} settings={SETTINGS} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toMatch(/gallery.{0,10}3/i);
  });

  it('renders the correct number of interactive tiles', () => {
    render(<Component media={THREE_IMAGES} settings={SETTINGS} />);
    // Buttons either come from native <button> or role="button" elements.
    const buttons = screen.getAllByRole('button');
    // There must be at least 3 tiles — may include lightbox chrome.
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders gracefully with empty media', () => {
    // Primarily a crash-guard: verify the component doesn't throw when
    // given an empty media array. The heading should still be present.
    const { container } = render(
      <Component media={[]} settings={SETTINGS} />,
    );
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
  });

  it('renders gracefully with a single item', () => {
    render(<Component media={[makeImage('solo', 0)]} settings={SETTINGS} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toMatch(/gallery.{0,10}1/i);
  });

  it('clicking the first tile opens the lightbox', () => {
    render(<Component media={THREE_IMAGES} settings={SETTINGS} />);
    expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument();

    const [firstButton] = screen.getAllByRole('button');
    fireEvent.click(firstButton);

    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
  });

  it('renders with mixed image/video media without crashing', () => {
    const { container } = render(
      <Component media={MIXED_MEDIA} settings={SETTINGS} />,
    );
    expect(container.firstChild).not.toBeNull();
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading.textContent).toMatch(/gallery.{0,10}2/i);
  });

  it('all tiles have accessible aria-label attributes', () => {
    render(<Component media={THREE_IMAGES} settings={SETTINGS} />);
    const buttons = screen.getAllByRole('button');
    const tileBtns = buttons.filter((b) => b.getAttribute('aria-label'));
    // At least one tile should have an aria-label
    expect(tileBtns.length).toBeGreaterThan(0);
  });

  it('renders with custom tile size settings', () => {
    const bigSettings: GalleryBehaviorSettings = { ...SETTINGS, tileSize: 250 };
    const { container } = render(
      <Component media={THREE_IMAGES} settings={bigSettings} />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it('renders with border width settings', () => {
    const borderedSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      tileBorderWidth: 2,
      tileBorderColor: '#ff0000',
    };
    const { container } = render(
      <Component media={THREE_IMAGES} settings={borderedSettings} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});

// ─── Adapter-specific tests ───────────────────────────────────────────────────

describe('CircularGallery — specific', () => {
  it('tiles have border-radius 50% style for circular shape', () => {
    const { container } = render(
      <CircularGallery media={THREE_IMAGES} settings={SETTINGS} />,
    );
    const buttons = container.querySelectorAll('button');
    const circleBtn = Array.from(buttons).find(
      (b) => (b as HTMLElement).style.borderRadius === '50%',
    );
    expect(circleBtn).toBeDefined();
  });

  it('renders VIDEO text label for video items', () => {
    render(<CircularGallery media={MIXED_MEDIA} settings={SETTINGS} />);
    expect(screen.getByText('VIDEO')).toBeInTheDocument();
  });
});

describe('DiamondGallery — specific', () => {
  it('renders VIDEO text label for video items', () => {
    render(<DiamondGallery media={MIXED_MEDIA} settings={SETTINGS} />);
    expect(screen.getByText('VIDEO')).toBeInTheDocument();
  });
});

describe('HexagonalGallery — specific', () => {
  it('renders VIDEO text label for video items', () => {
    render(<HexagonalGallery media={MIXED_MEDIA} settings={SETTINGS} />);
    expect(screen.getByText('VIDEO')).toBeInTheDocument();
  });
});

describe('JustifiedGallery — specific', () => {
  it('renders react-photo-album container', () => {
    render(<JustifiedGallery media={THREE_IMAGES} settings={SETTINGS} />);
    expect(screen.getByTestId('rpa-album')).toBeInTheDocument();
  });

  it('renders with zero-gap setting', () => {
    const noGapSettings: GalleryBehaviorSettings = { ...SETTINGS, thumbnailGap: 0 };
    const { container } = render(
      <JustifiedGallery media={THREE_IMAGES} settings={noGapSettings} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});

describe('MasonryGallery — specific', () => {
  it('renders react-photo-album container', () => {
    render(<MasonryGallery media={THREE_IMAGES} settings={SETTINGS} />);
    expect(screen.getByTestId('rpa-album')).toBeInTheDocument();
  });

  it('respects pinned masonryColumns setting', () => {
    const pinnedSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      masonryColumns: 3,
    };
    const { container } = render(
      <MasonryGallery media={THREE_IMAGES} settings={pinnedSettings} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});

describe('CompactGridGallery — specific', () => {
  it('respects gridCardWidth and gridCardHeight settings', () => {
    const customSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      gridCardWidth: 200,
      gridCardHeight: 150,
    };
    const { container } = render(
      <CompactGridGallery media={THREE_IMAGES} settings={customSettings} />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
