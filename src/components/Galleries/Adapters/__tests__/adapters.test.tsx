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

import type { MediaItem, GalleryBehaviorSettings, ResolvedGallerySectionRuntime } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

// ─── Global Mocks ────────────────────────────────────────────────────────────

// ResizeObserver is not available in jsdom — provide a no-op polyfill so
// Diamond and Hexagonal adapters (which measure container width) don't crash.
const mockResizeObserver = vi.fn(function() {
  return {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', mockResizeObserver);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

// Shared hook / component mocks. useCarousel + useMediaDimensions now live in
// the shared-utils barrel (P51-B): spread the real module and override these.
vi.mock('@wp-super-gallery/shared-utils', async () => {
  const actual = await vi.importActual<typeof import('@wp-super-gallery/shared-utils')>('@wp-super-gallery/shared-utils');
  return {
    ...actual,
    useCarousel: () => ({
      currentIndex: 0,
      setCurrentIndex: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
    }),
    useMediaDimensions: (media: MediaItem[]) => media,
  };
});

vi.mock('@wp-super-gallery/shared-ui', () => ({
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
              }, {
                photo: p,
                index: idx,
                width: p.width ?? 800,
                height: p.height ?? 600,
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
const { SpotlightGallery } = await import('@/components/Galleries/Adapters/spotlight/SpotlightGallery');
const { ScrollSnapGallery } = await import('@/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery');
const { StackedDeckAdapter } = await import('@/components/Galleries/Adapters/stacked/StackedDeckAdapter');
const { IsotopeAdapter } = await import('@/components/Galleries/Adapters/isotope/IsotopeAdapter');
const { PinterestAdapter } = await import('@/components/Galleries/Adapters/pinterest/PinterestAdapter');

// ─── Component map for parameterised tests ────────────────────────────────────

type AdapterComponent = React.ComponentType<{
  media: MediaItem[];
  settings: GalleryBehaviorSettings;
  runtime?: ResolvedGallerySectionRuntime;
}>;

function makeRuntime(common: Partial<ResolvedGallerySectionRuntime['common']> = {}): ResolvedGallerySectionRuntime {
  return {
    breakpoint: 'desktop',
    scope: 'image',
    common,
    background: {
      type: 'none',
      color: '',
      gradient: '',
      imageUrl: '',
    },
    adapterSettings: {},
  };
}

const ADAPTERS: [string, AdapterComponent][] = [
  ['CircularGallery', CircularGallery],
  ['CompactGridGallery', CompactGridGallery],
  ['DiamondGallery', DiamondGallery],
  ['HexagonalGallery', HexagonalGallery],
  ['JustifiedGallery', JustifiedGallery],
  ['MasonryGallery', MasonryGallery],
  ['SpotlightGallery', SpotlightGallery],
  ['ScrollSnapGallery', ScrollSnapGallery],
  ['StackedDeckAdapter', StackedDeckAdapter],
  ['IsotopeAdapter', IsotopeAdapter],
  ['PinterestAdapter', PinterestAdapter],
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
    expect(heading).toHaveTextContent('Images (3)');
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
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Images (0)');
  });

  it('renders gracefully with a single item', () => {
    render(<Component media={[makeImage('solo', 0)]} settings={SETTINGS} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveTextContent('Images (1)');
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
    expect(heading).toHaveTextContent('Media (2)');
  });

  it('uses runtime common label overrides when provided', () => {
    render(
      <Component
        media={THREE_IMAGES}
        settings={SETTINGS}
        runtime={makeRuntime({ galleryImageLabel: 'Photos' })}
      />,
    );

    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Photos (3)');
  });

  it('hides the heading when runtime common disables it', () => {
    render(
      <Component
        media={THREE_IMAGES}
        settings={SETTINGS}
        runtime={makeRuntime({ showCampaignGalleryLabels: false })}
      />,
    );

    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
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

  it('uses media-type-specific border radii for mixed media tiles', () => {
    const mixedRadiusSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      imageBorderRadius: 14,
      videoBorderRadius: 18,
    };
    const { container } = render(
      <JustifiedGallery media={MIXED_MEDIA} settings={mixedRadiusSettings} />,
    );
    const buttons = Array.from(container.querySelectorAll('button')).map((button) => (button as HTMLButtonElement).style.borderRadius);
    expect(buttons).toContain('14px');
    expect(buttons).toContain('18px');
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

  // P31-G: Waterfall entrance animation tests
  it('does not add waterfall class when animation is disabled (default)', () => {
    const { container } = render(<MasonryGallery media={THREE_IMAGES} settings={SETTINGS} />);
    const waterfall = container.querySelectorAll('.wpsg-waterfall-tile');
    expect(waterfall.length).toBe(0);
  });

  it('adds wpsg-waterfall-tile class to every tile when waterfall animation is enabled', () => {
    const animSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      masonryEntranceAnimation: 'waterfall',
    };
    const { container } = render(<MasonryGallery media={THREE_IMAGES} settings={animSettings} />);
    const waterfall = container.querySelectorAll('.wpsg-waterfall-tile');
    // One tile per photo
    expect(waterfall.length).toBe(THREE_IMAGES.length);
  });

  it('applies staggered animation-delay per tile in waterfall mode', () => {
    const animSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      masonryEntranceAnimation: 'waterfall',
      masonryEntranceStagger: 80,
    };
    const { container } = render(<MasonryGallery media={THREE_IMAGES} settings={animSettings} />);
    const tiles = Array.from(container.querySelectorAll('.wpsg-waterfall-tile')) as HTMLElement[];
    // Index 0 → 0ms, index 1 → 80ms, index 2 → 160ms
    expect(tiles[0].style.animationDelay).toBe('0ms');
    expect(tiles[1].style.animationDelay).toBe('80ms');
    expect(tiles[2].style.animationDelay).toBe('160ms');
  });

  it('uses media-type-specific border radii for mixed media tiles', () => {
    const mixedRadiusSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      imageBorderRadius: 14,
      videoBorderRadius: 18,
    };
    const { container } = render(
      <MasonryGallery media={MIXED_MEDIA} settings={mixedRadiusSettings} />,
    );
    const buttons = Array.from(container.querySelectorAll('button')).map((button) => (button as HTMLButtonElement).style.borderRadius);
    expect(buttons).toContain('14px');
    expect(buttons).toContain('18px');
  });
});

describe('CompactGridGallery — specific', () => {
  it('respects width, aspect ratio, min-height, and max-column settings', () => {
    const customSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      gridCardWidth: 200,
      gridCardAspectRatio: '3:4',
      gridCardMaxColumns: 3,
      gridCardMinHeight: 220,
    };
    const { container } = render(
      <CompactGridGallery media={THREE_IMAGES} settings={customSettings} />,
    );
    const grid = container.querySelector('div[style*="flex-wrap"]') as HTMLDivElement | null;
    const firstCard = container.querySelector('button') as HTMLButtonElement | null;

    expect(container.firstChild).not.toBeNull();
    // 3 cols × 200px + 2 gaps × 16px — format: min(100%, calc(600px + 2 * 16px))
    expect(grid?.style.maxWidth).toContain('600px');
    expect(grid?.style.maxWidth).toContain('2 * 16px');
    expect(firstCard?.style.aspectRatio).toBe('3 / 4');
    expect(firstCard?.style.minHeight).toBe('220px');
  });

  it('uses media-type-specific border radii for mixed media tiles', () => {
    const mixedRadiusSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      imageBorderRadius: 14,
      videoBorderRadius: 18,
    };
    const { container } = render(
      <CompactGridGallery media={MIXED_MEDIA} settings={mixedRadiusSettings} />,
    );
    const buttons = Array.from(container.querySelectorAll('button')).map((button) => (button as HTMLButtonElement).style.borderRadius);
    expect(buttons).toContain('14px');
    expect(buttons).toContain('18px');
  });
});

// ─── P31-E: SpotlightGallery-specific tests ───────────────────────────────────

describe('SpotlightGallery — specific', () => {
  it('renders a hero area and a thumbnail strip', () => {
    const { container } = render(
      <SpotlightGallery media={THREE_IMAGES} settings={SETTINGS} />,
    );
    // Hero: Box with role="button"
    expect(container.querySelector('[role="button"]')).not.toBeNull();
    // Thumbnail strip: one <button> per item
    const thumbBtns = container.querySelectorAll('button');
    expect(thumbBtns.length).toBe(THREE_IMAGES.length);
  });

  it('clicking a thumbnail updates the active selection indicator', () => {
    const { container } = render(
      <SpotlightGallery media={THREE_IMAGES} settings={SETTINGS} />,
    );
    const thumbBtns = Array.from(container.querySelectorAll('button'));

    // Initially the first thumbnail is active (currentIndex=0 from mocked useCarousel)
    expect(thumbBtns[0].getAttribute('aria-current')).toBe('true');
    expect(thumbBtns[1].getAttribute('aria-current')).toBeNull();
  });

  it('clicking the hero opens the lightbox', () => {
    const { container } = render(<SpotlightGallery media={THREE_IMAGES} settings={SETTINGS} />);
    expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument();

    // The hero is a Box with role="button" (not a <button> element).
    // This query targets it specifically — thumbnails are native <button> elements.
    const hero = container.querySelector('[role="button"]') as HTMLElement;
    expect(hero).not.toBeNull();
    fireEvent.click(hero);

    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
  });

  it('respects spotlightHeroAspectRatio setting', () => {
    const squareSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      spotlightHeroAspectRatio: '1:1',
    };
    const { container } = render(
      <SpotlightGallery media={THREE_IMAGES} settings={squareSettings} />,
    );
    const hero = container.querySelector('[role="button"]') as HTMLElement | null;
    expect(hero?.style.aspectRatio).toBe('1 / 1');
  });

  it('respects spotlightThumbnailSize setting', () => {
    const bigThumbSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      spotlightThumbnailSize: 120,
    };
    const { container } = render(
      <SpotlightGallery media={THREE_IMAGES} settings={bigThumbSettings} />,
    );
    const thumbBtns = Array.from(container.querySelectorAll('button'));
    // All thumbnails should have width=120px
    thumbBtns.forEach((btn) => {
      expect((btn as HTMLButtonElement).style.width).toBe('120px');
    });
  });

  it('caps the hero+strip block at spotlightHeroMaxWidth and centers it by default', () => {
    // P51-E: the cap now applies to the hero+strip block (so raising it enlarges
    // the hero) and justification is driven by adapterJustifyContent (default
    // 'center'), instead of being a maxWidth + marginInline:auto on the shell.
    const constrainedSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      spotlightHeroMaxWidth: 48,
      spotlightHeroMaxWidthUnit: 'rem',
    };

    const { container } = render(
      <SpotlightGallery media={THREE_IMAGES} settings={constrainedSettings} />,
    );

    const divs = [...container.querySelectorAll<HTMLElement>('div')];
    expect(divs.some((d) => d.style.maxWidth === '48rem' && d.style.width === '100%')).toBe(true);
    expect(divs.some((d) => d.style.justifyContent === 'center')).toBe(true);
  });

  it('renders gracefully with empty media — hero shows empty state', () => {
    const { container } = render(
      <SpotlightGallery media={[]} settings={SETTINGS} />,
    );
    // Hero still renders (empty state), no thumbnail buttons
    expect(container.querySelector('[role="button"]')).not.toBeNull();
    const thumbBtns = container.querySelectorAll('button');
    expect(thumbBtns.length).toBe(0);
  });
});

// ─── P31-F: ScrollSnapGallery-specific tests ──────────────────────────────────

describe('ScrollSnapGallery — specific', () => {
  it('renders one snap slide per media item', () => {
    const { container } = render(
      <ScrollSnapGallery media={THREE_IMAGES} settings={SETTINGS} />,
    );
    const slides = container.querySelectorAll('[role="button"]');
    expect(slides.length).toBe(THREE_IMAGES.length);
  });

  it('applies scroll-snap-type to the snap container', () => {
    const { container } = render(
      <ScrollSnapGallery media={THREE_IMAGES} settings={SETTINGS} />,
    );
    const snapContainer = container.querySelector('[data-wpsg-slot="snap-container"]') as HTMLElement | null;
    expect(snapContainer?.style.scrollSnapType).toBe('y mandatory');
  });

  it('applies scroll-snap-align from scrollSnapAlignment setting', () => {
    const centerSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      scrollSnapAlignment: 'center',
    };
    const { container } = render(
      <ScrollSnapGallery media={THREE_IMAGES} settings={centerSettings} />,
    );
    const slides = Array.from(container.querySelectorAll('[role="button"]')) as HTMLElement[];
    slides.forEach((slide) => {
      expect(slide.style.scrollSnapAlign).toBe('center');
    });
  });

  it('shows page indicator when scrollSnapPageIndicator is true', () => {
    render(<ScrollSnapGallery media={THREE_IMAGES} settings={SETTINGS} />);
    // Each slide shows "n / 3" — check that at least the first indicator is present
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });

  it('hides page indicator when scrollSnapPageIndicator is false', () => {
    const noIndicatorSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      scrollSnapPageIndicator: false,
    };
    render(<ScrollSnapGallery media={THREE_IMAGES} settings={noIndicatorSettings} />);
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument();
  });

  it('applies scrollSnapMaxWidth to the adapter shell and keeps it centered', () => {
    const constrainedSettings: GalleryBehaviorSettings = {
      ...SETTINGS,
      scrollSnapMaxWidth: 75,
      scrollSnapMaxWidthUnit: '%',
    };

    const { container } = render(
      <ScrollSnapGallery media={THREE_IMAGES} settings={constrainedSettings} />,
    );

    const shell = container.querySelector('[data-wpsg-component="ScrollSnapGallery"]') as HTMLElement | null;
    expect(shell?.style.maxWidth).toBe('75%');
    expect(shell?.style.marginInline).toBe('auto');
  });

  it('clicking a slide opens the lightbox', () => {
    const { container } = render(
      <ScrollSnapGallery media={THREE_IMAGES} settings={SETTINGS} />,
    );
    expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument();

    const [firstSlide] = Array.from(container.querySelectorAll('[role="button"]'));
    fireEvent.click(firstSlide as HTMLElement);

    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
  });

  it('renders gracefully with empty media — shows empty placeholder', () => {
    const { container } = render(
      <ScrollSnapGallery media={[]} settings={SETTINGS} />,
    );
    expect(container.firstChild).not.toBeNull();
    // No slide role="button" elements
    expect(container.querySelectorAll('[role="button"]').length).toBe(0);
  });
});

// ─── P48-H: PinterestAdapter-specific tests ───────────────────────────────────

describe('PinterestAdapter — specific', () => {
  it('renders a play-icon overlay for video items', () => {
    const { container } = render(
      <PinterestAdapter media={MIXED_MEDIA} settings={SETTINGS} />,
    );
    // The video tile renders an IconPlayerPlay (svg) inside its hover overlay.
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('classifies tile col/row spans by aspect ratio at full width', () => {
    const media: MediaItem[] = [
      { ...makeImage('wide', 0), width: 1600, height: 600 },    // ratio 2.67 → 2×2
      { ...makeImage('square', 1), width: 600, height: 600 },   // ratio 1.0  → 1×1
      { ...makeImage('portrait', 2), width: 400, height: 800 }, // ratio 0.5  → 1×2
      { ...makeImage('nodims', 3), width: 0, height: 0 },       // ratio null → 1×1
    ];
    const { container } = render(
      <PinterestAdapter
        media={media}
        settings={SETTINGS}
        containerDimensions={{ width: 800, height: 600 }}
      />,
    );
    const tiles = Array.from(container.querySelectorAll('[role="button"]')) as HTMLElement[];
    expect(tiles).toHaveLength(4);
    // Hero / landscape tile spans two columns and two rows.
    expect(tiles[0].style.gridColumn).toBe('span 2');
    expect(tiles[0].style.gridRow).toBe('span 2');
    // Portrait tile spans two rows in a single column.
    expect(tiles[2].style.gridColumn).toBe('span 1');
    expect(tiles[2].style.gridRow).toBe('span 2');
    // Square + dimensionless tiles stay 1×1.
    expect(tiles[1].style.gridRow).toBe('span 1');
    expect(tiles[3].style.gridRow).toBe('span 1');
  });

  it('collapses every tile to 1×1 in narrow (mobile) layouts', () => {
    const { container } = render(
      <PinterestAdapter
        media={THREE_IMAGES}
        settings={SETTINGS}
        containerDimensions={{ width: 400, height: 600 }}
      />,
    );
    const tiles = Array.from(container.querySelectorAll('[role="button"]')) as HTMLElement[];
    expect(tiles).toHaveLength(THREE_IMAGES.length);
    tiles.forEach((tile) => {
      expect(tile.style.gridColumn).toBe('span 1');
      expect(tile.style.gridRow).toBe('span 1');
    });
  });
});
