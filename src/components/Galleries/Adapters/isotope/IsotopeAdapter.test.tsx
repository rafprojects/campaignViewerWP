/**
 * P50-D: IsotopeAdapter colocated test suite.
 *
 * Covers filter/sort UI, FLIP animation safety in jsdom, lightbox
 * integration, accessibility, and registry smoke block.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import '@testing-library/jest-dom/vitest';

import type { MediaItem, GalleryBehaviorSettings } from '@/types';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS } from '@/types';

// ── Global mocks ─────────────────────────────────────────────────────────────

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

// useCarousel now lives in the shared-utils barrel (P51-B): spread the real
// module and override just the hook.
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
  };
});

vi.mock('@wp-super-gallery/shared-ui', () => ({
  Lightbox: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="lightbox-open" /> : null,
}));

vi.mock('@/components/CampaignGallery/LazyImage', () => ({
  LazyImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeImage = (id: string, order: number, date?: string): MediaItem => ({
  id,
  type: 'image',
  source: 'upload',
  url: `https://example.com/${id}.jpg`,
  thumbnail: `https://example.com/${id}-thumb.jpg`,
  title: `Image ${id}`,
  order,
  dateUploaded: date,
});

const makeVideo = (id: string, order: number): MediaItem => ({
  id,
  type: 'video',
  source: 'external',
  url: `https://example.com/${id}`,
  thumbnail: `https://example.com/${id}-thumb.jpg`,
  title: `Video ${id}`,
  order,
});

const SETTINGS: GalleryBehaviorSettings = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
};

const THREE_IMAGES = [makeImage('a', 0), makeImage('b', 1), makeImage('c', 2)];

const MIXED = [
  makeImage('img1', 0, '2024-01-01 10:00:00'),
  makeVideo('vid1', 1),
  makeImage('img2', 2, '2024-03-01 10:00:00'),
];

// ── Lazy imports ──────────────────────────────────────────────────────────────

const { IsotopeAdapter } = await import('./IsotopeAdapter');
const { getAdapterRegistration } = await import('../adapterRegistry');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IsotopeAdapter — core render', () => {
  it('renders without crashing with three images', () => {
    const { container } = render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders gracefully with empty media', () => {
    const { container } = render(<IsotopeAdapter media={[]} settings={SETTINGS} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders gracefully with a single item', () => {
    const { container } = render(<IsotopeAdapter media={[makeImage('solo', 0)]} settings={SETTINGS} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('renders the correct number of tile buttons', () => {
    render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('renders aria-labels on tile buttons', () => {
    render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    const buttons = screen.getAllByRole('button');
    const labeled = buttons.filter((b) => b.getAttribute('aria-label'));
    expect(labeled.length).toBeGreaterThan(0);
  });
});

describe('IsotopeAdapter — filter chips', () => {
  it('does NOT show filter chips when all media is the same type', () => {
    render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    // Chip.Group renders chips; when hidden there should be no "All" chip
    expect(screen.queryByText('All')).not.toBeInTheDocument();
  });

  it('shows filter chips (All / Images / Videos) with mixed media', () => {
    render(<IsotopeAdapter media={MIXED} settings={SETTINGS} />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Videos')).toBeInTheDocument();
  });

  it('clicking "Images" chip hides the video tile', () => {
    render(<IsotopeAdapter media={MIXED} settings={SETTINGS} />);

    // Before filtering: all three tile buttons visible (plus chips)
    const buttonsBefore = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('aria-label') !== null && !b.textContent?.match(/All|Images|Videos/),
    );
    // Find the images chip and click it
    const imagesChip = screen.getByText('Images').closest('button') ?? screen.getByText('Images');
    fireEvent.click(imagesChip);

    // After filtering: only image tiles visible (aria-labels say "View image N")
    const tileButtons = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('aria-label')?.startsWith('View image') || b.getAttribute('aria-label')?.startsWith('View:'),
    );
    expect(tileButtons.length).toBe(2); // 2 images in MIXED
    expect(buttonsBefore.length).toBe(3); // ensure we had 3 before
  });

  it('clicking "All" chip restores all tiles after filtering', () => {
    render(<IsotopeAdapter media={MIXED} settings={SETTINGS} />);

    // Filter to images first
    const imagesChip = screen.getByText('Images').closest('button') ?? screen.getByText('Images');
    fireEvent.click(imagesChip);

    // Restore with All
    const allChip = screen.getByText('All').closest('button') ?? screen.getByText('All');
    fireEvent.click(allChip);

    // All tiles (image + video) back
    const tileButtons = screen.getAllByRole('button').filter(
      (b) => !!b.getAttribute('aria-label') && (
        b.getAttribute('aria-label')!.startsWith('View') ||
        b.getAttribute('aria-label')!.startsWith('Play')
      ),
    );
    expect(tileButtons.length).toBe(3);
  });
});

describe('IsotopeAdapter — sort', () => {
  it('renders the sort select', () => {
    render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    expect(screen.getByRole('combobox', { name: /sort order/i })).toBeInTheDocument();
  });

  it('sort select shows the default label on initial render', () => {
    render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    const select = screen.getByRole('combobox', { name: /sort order/i }) as HTMLInputElement;
    // Mantine Select renders the selected label as the input value
    expect(select.value).toBe('Default order');
  });
});

describe('IsotopeAdapter — lightbox', () => {
  it('clicking a tile opens the lightbox', () => {
    render(<IsotopeAdapter media={THREE_IMAGES} settings={SETTINGS} />);
    expect(screen.queryByTestId('lightbox-open')).not.toBeInTheDocument();

    const [firstTile] = screen.getAllByRole('button').filter(
      (b) => !!b.getAttribute('aria-label'),
    );
    fireEvent.click(firstTile);
    expect(screen.getByTestId('lightbox-open')).toBeInTheDocument();
  });
});

describe('IsotopeAdapter — FLIP animation safety', () => {
  it('filter change does not throw in jsdom (zero-rect environment)', () => {
    render(<IsotopeAdapter media={MIXED} settings={SETTINGS} />);
    // In jsdom all getBoundingClientRect() calls return zeros.
    // The FLIP effect should detect dx===0 && dy===0 and skip without error.
    expect(() => {
      const imagesChip = screen.getByText('Images').closest('button') ?? screen.getByText('Images');
      fireEvent.click(imagesChip);
    }).not.toThrow();
  });
});

describe('IsotopeAdapter — registry smoke', () => {
  it('is registered with id "isotope"', () => {
    const reg = getAdapterRegistration('isotope');
    expect(reg).toBeDefined();
    expect(reg?.id).toBe('isotope');
    expect(reg?.capabilities).toContain('grid-layout');
    expect(reg?.capabilities).toContain('lightbox');
  });
});
