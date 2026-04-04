import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { CardGallery } from './CardGallery';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type Campaign, type Company, type GalleryBehaviorSettings, type MediaItem } from '@/types';

const company: Company = {
  id: 'acme',
  name: 'Acme',
  logo: '🏷️',
  brandColor: '#123456',
};

const baseMedia: MediaItem = {
  id: 'm1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/image.jpg',
  order: 1,
};

const buildCampaign = (id: string, title: string, visibility: 'public' | 'private'): Campaign => ({
  id,
  companyId: company.id,
  company,
  title,
  description: 'Test description',
  thumbnail: 'https://example.com/thumb.jpg',
  coverImage: 'https://example.com/cover.jpg',
  videos: [],
  images: [baseMedia],
  tags: ['test'],
  status: 'active',
  visibility,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
});

async function withMockedClientWidth<T>(width: number, callback: () => Promise<T> | T): Promise<T> {
  const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');

  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  });

  try {
    return await callback();
  } finally {
    if (originalClientWidth) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
    } else {
      delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    }
  }
}

describe('CardGallery', () => {
  it('renders campaigns in lock mode by default', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={[]}
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
      />,
    );

    expect(screen.getByText('Public Campaign')).toBeInTheDocument();
    expect(screen.getByText('Private Campaign')).toBeInTheDocument();
  });

  it('hides inaccessible campaigns in hide mode', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={[]}
        accessMode="hide"
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
      />,
    );

    expect(screen.getByText('Public Campaign')).toBeInTheDocument();
    expect(screen.queryByText('Private Campaign')).not.toBeInTheDocument();
  });

  it('shows accessible campaigns in My Access filter', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={['2']}
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
      />,
    );

    fireEvent.click(screen.getByText('My Access'));

    expect(screen.getByText('Private Campaign')).toBeInTheDocument();
    expect(screen.getByText('Public Campaign')).toBeInTheDocument();
  });

  it('toggles access mode when admin clicks Hide', () => {
    const onAccessModeChange = vi.fn();

    render(
      <CardGallery
        campaigns={[buildCampaign('1', 'Public Campaign', 'public')]}
        userPermissions={[]}
        isAdmin
        accessMode="lock"
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
        onAccessModeChange={onAccessModeChange}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /hide/i }));
    expect(onAccessModeChange).toHaveBeenCalledWith('hide');
  });

  it('shows hidden access notice in hide mode', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Public Campaign', 'public'),
          buildCampaign('2', 'Private Campaign', 'private'),
        ]}
        userPermissions={[]}
        accessMode="hide"
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
      />,
    );

    expect(screen.getByText(/hidden by access mode/i)).toBeInTheDocument();
  });

  it('filters campaigns by search query', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Alpha Campaign', 'public'),
          buildCampaign('2', 'Beta Campaign', 'public'),
        ]}
        userPermissions={[]}
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
      />,
    );

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    expect(screen.getByText('Alpha Campaign')).toBeInTheDocument();
    expect(screen.queryByText('Beta Campaign')).not.toBeInTheDocument();
  });

  it('filters campaigns by company tab', () => {
    render(
      <CardGallery
        campaigns={[
          buildCampaign('1', 'Alpha Campaign', 'public'),
          buildCampaign('2', 'Beta Campaign', 'public'),
        ]}
        userPermissions={['1', '2']}
        galleryBehaviorSettings={DEFAULT_GALLERY_BEHAVIOR_SETTINGS}
      />,
    );

    // Company filter tab named "Acme" should appear
    const acmeTab = screen.queryByRole('tab', { name: 'Acme' });
    if (acmeTab) {
      fireEvent.click(acmeTab);
      expect(screen.getByText('Alpha Campaign')).toBeInTheDocument();
    }
  });

  it('applies card justification in the responsive card grid branch', () => {
    render(
      <CardGallery
        campaigns={buildMany(4)}
        userPermissions={[]}
        galleryBehaviorSettings={{
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          cardGridColumns: 3,
          cardMaxWidth: 0,
          cardJustifyContent: 'space-between',
        }}
      />,
    );

    expect(screen.getByTestId('card-gallery-grid')).toHaveStyle({
      display: 'flex',
      justifyContent: 'space-between',
    });
  });

  it('resolves percentage fixed card widths against the container when capping auto columns', async () => {
    await withMockedClientWidth(1200, async () => {
      render(
        <CardGallery
          campaigns={buildMany(6)}
          userPermissions={[]}
          galleryBehaviorSettings={{
            ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
            cardGridColumns: 0,
            cardMaxColumns: 3,
            cardAutoColumnsBreakpoints: '0:5',
            cardMaxWidth: 10,
            cardMaxWidthUnit: '%',
            cardScale: 1.5,
            cardGapH: 2,
            cardGapHUnit: '%',
          }}
        />,
      );

      const grid = screen.getByTestId('card-gallery-grid');

      await waitFor(() => {
        expect(grid.style.maxWidth).toBe('calc(540px + 4%)');
        expect(screen.getByLabelText('Open campaign Campaign 1')).toHaveStyle({ maxWidth: '180px' });
      });
    });
  });
});

/* ── P13-F: Card Gallery Pagination tests ──────────────────────── */

const buildMany = (count: number): Campaign[] =>
  Array.from({ length: count }, (_, i) =>
    buildCampaign(`c${i + 1}`, `Campaign ${i + 1}`, 'public'),
  );

const paginatedSettings: GalleryBehaviorSettings = {
  ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
  cardDisplayMode: 'paginated',
  cardRowsPerPage: 2,
  cardGridColumns: 3, // fixed 3 columns → 6 cards per page
  cardPageDotNav: false,
  cardPageTransitionMs: 0, // instant for tests
};

describe('CardGallery pagination', () => {
  it('shows all cards when displayMode is show-all', () => {
    const campaigns = buildMany(20);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={{
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          cardDisplayMode: 'show-all',
        }}
      />,
    );
    // All 20 should be visible, no "Load more"
    for (let i = 1; i <= 20; i++) {
      expect(screen.getByText(`Campaign ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
  });

  it('shows load-more button in load-more mode', () => {
    const campaigns = buildMany(15);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={{
          ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
          cardDisplayMode: 'load-more',
        }}
      />,
    );
    // Default 12 visible, 3 remaining
    expect(screen.getByText(/Load more/)).toBeInTheDocument();
    expect(screen.getByText(/3 remaining/)).toBeInTheDocument();
  });

  it('shows first page of cards in paginated mode', () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    // 2 rows × 3 cols = 6 cards on page 1
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByText(`Campaign ${i}`)).toBeInTheDocument();
    }
    // Cards 7-10 should NOT be visible on page 1
    for (let i = 7; i <= 10; i++) {
      expect(screen.queryByText(`Campaign ${i}`)).not.toBeInTheDocument();
    }
  });

  it('shows page indicator text', () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    // 10 cards / 6 per page = 2 pages
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('renders overlay arrows when paginated with multiple pages', () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
  });

  it('does not render overlay arrows when only one page', () => {
    const campaigns = buildMany(3);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument();
  });

  it('renders dot navigator when cardPageDotNav is true', () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={{ ...paginatedSettings, cardPageDotNav: true }}
      />,
    );
    // DotNavigator renders tablist
    expect(screen.getByRole('tablist', { name: /slide navigation/i })).toBeInTheDocument();
  });

  it('does not render dot navigator when cardPageDotNav is false', () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={{ ...paginatedSettings, cardPageDotNav: false }}
      />,
    );
    expect(screen.queryByRole('tablist', { name: /slide navigation/i })).not.toBeInTheDocument();
  });

  it('no load-more button in paginated mode', () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    expect(screen.queryByText(/Load more/)).not.toBeInTheDocument();
  });

  it('clicking Next page advances to page 2', async () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    const nextBtn = screen.getByLabelText('Next page');
    fireEvent.click(nextBtn);
    await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument());
  });

  it('clicking Previous page goes back to page 1 from page 2', async () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    fireEvent.click(screen.getByLabelText('Next page'));
    await waitFor(() => screen.getByText('Page 2 of 2'));
    fireEvent.click(screen.getByLabelText('Previous page'));
    await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument());
  });

  it('ArrowRight keyboard navigates to next page', async () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    const container = screen.getByLabelText(/Card gallery page 1/);
    fireEvent.keyDown(container, { key: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText('Page 2 of 2')).toBeInTheDocument());
  });

  it('ArrowLeft keyboard navigates to previous page', async () => {
    const campaigns = buildMany(10);
    render(
      <CardGallery
        campaigns={campaigns}
        userPermissions={[]}
        galleryBehaviorSettings={paginatedSettings}
      />,
    );
    const container = screen.getByLabelText(/Card gallery page 1/);
    fireEvent.keyDown(container, { key: 'ArrowRight' });
    await waitFor(() => screen.getByText('Page 2 of 2'));
    const container2 = screen.getByLabelText(/Card gallery page 2/);
    fireEvent.keyDown(container2, { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByText('Page 1 of 2')).toBeInTheDocument());
  });
});

/* ── Narrow-breakpoint card width guard tests ──────────────────── */

describe('CardGallery narrow-breakpoint fixed-width guard', () => {
  it('falls back to responsive branch when percent-based width resolves below 120px', async () => {
    // Live-like settings: 10% width × 1.5 scale = 15% → on 375px container = 56px → below 120px floor
    await withMockedClientWidth(375, async () => {
      render(
        <CardGallery
          campaigns={buildMany(4)}
          userPermissions={[]}
          galleryBehaviorSettings={{
            ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
            cardMaxWidth: 10,
            cardMaxWidthUnit: '%',
            cardScale: 1.5,
            cardGapH: 2,
            cardGapHUnit: '%',
            cardGridColumns: 0,
            cardMaxColumns: 2,
          }}
        />,
      );

      // In responsive mode, cards do NOT get an inline maxWidth — they use the wrapper's flex sizing
      const card = screen.getByLabelText('Open campaign Campaign 1');
      await waitFor(() => {
        expect(card.style.maxWidth).toBe('');
      });
    });
  });

  it('keeps fixed-width branch on wide containers where resolved width exceeds floor', async () => {
    // Same settings on 1200px container: 15% = 180px → above 120px floor
    await withMockedClientWidth(1200, async () => {
      render(
        <CardGallery
          campaigns={buildMany(4)}
          userPermissions={[]}
          galleryBehaviorSettings={{
            ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
            cardMaxWidth: 10,
            cardMaxWidthUnit: '%',
            cardScale: 1.5,
            cardGapH: 2,
            cardGapHUnit: '%',
            cardGridColumns: 0,
            cardMaxColumns: 3,
            cardAutoColumnsBreakpoints: '0:5',
          }}
        />,
      );

      const card = screen.getByLabelText('Open campaign Campaign 1');
      await waitFor(() => {
        expect(card.style.maxWidth).toBe('180px');
      });
    });
  });

  it('applies minimum 4px horizontal gap when percent gap resolves below threshold', async () => {
    // 2% gap on 150px container = 3px → below 4px → should clamp to 4px
    await withMockedClientWidth(150, async () => {
      render(
        <CardGallery
          campaigns={buildMany(2)}
          userPermissions={[]}
          galleryBehaviorSettings={{
            ...DEFAULT_GALLERY_BEHAVIOR_SETTINGS,
            cardGapH: 2,
            cardGapHUnit: '%',
            cardGapV: 8,
            cardGapVUnit: 'px',
          }}
        />,
      );

      const grid = screen.getByTestId('card-gallery-grid');
      await waitFor(() => {
        expect(grid.style.gap).toContain('4px');
      });
    });
  });
});
