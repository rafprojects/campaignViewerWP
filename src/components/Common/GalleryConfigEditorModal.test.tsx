import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen } from '@/test/test-utils';

import { GalleryConfigEditorModal } from './GalleryConfigEditorModal';

describe('GalleryConfigEditorModal', () => {
  it('renders the first schema-driven adapter-specific field for masonry selections', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'masonry',
                adapterSettings: {
                  masonryColumns: 3,
                },
              },
              video: {
                adapterId: 'classic',
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByText('Adapter-Specific Settings')).toBeInTheDocument();
    expect(screen.getByText('Masonry Columns (0 = auto)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  it('renders registry-driven compact grid fields for matching adapters', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'compact-grid',
                adapterSettings: {
                  gridCardWidth: 180,
                  gridCardHeight: 240,
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText('Card Min Width (px)')).toBeInTheDocument();
    expect(screen.getByLabelText('Card Height (px)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('180')).toBeInTheDocument();
    expect(screen.getByDisplayValue('240')).toBeInTheDocument();
  });

  it('renders schema-driven carousel adapter fields for classic selections', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'unified',
          breakpoints: {
            desktop: {
              unified: {
                adapterId: 'classic',
                adapterSettings: {
                  imageViewportHeight: 560,
                  videoViewportHeight: 500,
                  carouselVisibleCards: 3,
                  carouselLoop: false,
                  carouselAutoplayDirection: 'rtl',
                  navArrowPosition: 'bottom',
                  navArrowSize: 42,
                  navArrowColor: '#ff8800',
                  navArrowBgColor: 'rgba(1,2,3,0.5)',
                  dotNavEnabled: false,
                  dotNavPosition: 'overlay-top',
                  dotNavActiveColor: '#00ffaa',
                  dotNavInactiveColor: 'rgba(4,5,6,0.25)',
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByText('Adapter-Specific Settings')).toBeInTheDocument();
    expect(screen.getByLabelText('Image Viewport Height (px)')).toHaveValue('560');
    expect(screen.getByLabelText('Video Viewport Height (px)')).toHaveValue('500');
    expect(screen.getByLabelText('Visible Cards')).toHaveValue('3');
    expect(screen.getByLabelText('Loop', { selector: 'input' })).toHaveValue('Off');
    expect(screen.getByLabelText('Autoplay Direction', { selector: 'input' })).toHaveValue('Right to Left');
    expect(screen.getByLabelText('Arrow Vertical Position', { selector: 'input' })).toHaveValue('Bottom');
    expect(screen.getByLabelText('Arrow Size (px)')).toHaveValue('42');
    expect(screen.getByLabelText('Arrow Color')).toHaveValue('#ff8800');
    expect(screen.getByLabelText('Arrow Background Color')).toHaveValue('rgba(1,2,3,0.5)');
    expect(screen.getByLabelText('Enable Dot Navigator', { selector: 'input' })).toHaveValue('Off');
    expect(screen.getByLabelText('Dot Position', { selector: 'input' })).toHaveValue('Overlay Top');
    expect(screen.getByLabelText('Active Dot Color')).toHaveValue('#00ffaa');
    expect(screen.getByLabelText('Inactive Dot Color')).toHaveValue('rgba(4,5,6,0.25)');
  });

  it('renders shared common adapter spacing controls from nested common settings', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'compact-grid',
                common: {
                  adapterItemGap: 20,
                  adapterJustifyContent: 'space-between',
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Space Between')).toBeInTheDocument();
  });

  it('renders shared section sizing controls from nested common settings', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'compact-grid',
                common: {
                  sectionMaxWidth: 1200,
                  sectionMinWidth: 350,
                  sectionHeightMode: 'manual',
                  sectionMaxHeight: 640,
                  sectionMinHeight: 240,
                  perTypeSectionEqualHeight: true,
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('1200')).toBeInTheDocument();
    expect(screen.getByDisplayValue('350')).toBeInTheDocument();
    expect(screen.getByLabelText('Section Height Mode', { selector: 'input' })).toHaveValue(
      'Manual (fixed max height)',
    );
    expect(screen.getByDisplayValue('640')).toBeInTheDocument();
    expect(screen.getByDisplayValue('240')).toBeInTheDocument();
    expect(screen.getByLabelText('Equal Height Sections (Per-Type)', { selector: 'input' })).toHaveValue('On');
  });

  it('renders shared adapter sizing controls from nested common settings', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'compact-grid',
                common: {
                  adapterSizingMode: 'manual',
                  adapterMaxWidthPct: 85,
                  adapterMaxHeightPct: 90,
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Manual (custom %)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('85')).toBeInTheDocument();
    expect(screen.getByDisplayValue('90')).toBeInTheDocument();
  });

  it('renders shared gallery height controls from nested common settings', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'classic',
                common: {
                  gallerySizingMode: 'manual',
                  galleryManualHeight: '75vh',
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByText('Shared Gallery Height')).toBeInTheDocument();
    expect(screen.getByLabelText('Height Constraint', { selector: 'input' })).toHaveValue('Manually control height');
    expect(screen.getByLabelText('Manual Gallery Height')).toHaveValue('75vh');
  });

  it('renders shared gallery presentation controls from nested common settings', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'compact-grid',
                common: {
                  galleryImageLabel: 'Photos',
                  galleryVideoLabel: 'Clips',
                  galleryLabelJustification: 'center',
                  showGalleryLabelIcon: true,
                  showCampaignGalleryLabels: false,
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Photos')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Clips')).toBeInTheDocument();
    expect(screen.getByLabelText('Gallery Label Justification', { selector: 'input' })).toHaveValue('Center');
    expect(screen.getByLabelText('Show Gallery Label Icons', { selector: 'input' })).toHaveValue('On');
    expect(screen.getByLabelText('Show Gallery Section Labels', { selector: 'input' })).toHaveValue('Off');
  });

  it('renders scope-specific viewport background controls from nested common settings', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'compact-grid',
                common: {
                  viewportBgType: 'solid',
                  viewportBgColor: '#112233',
                },
              },
              video: {
                adapterId: 'classic',
                common: {
                  viewportBgType: 'gradient',
                  viewportBgGradient: 'linear-gradient(135deg, #123456 0%, #654321 100%)',
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(await screen.findByText('Viewport Backgrounds')).toBeInTheDocument();
    expect(screen.getByLabelText('Image Gallery Background', { selector: 'input' })).toHaveValue('Solid Color');
    expect(screen.getByLabelText('Image Gallery Background Color')).toHaveValue('#112233');
    expect(screen.getByLabelText('Video Gallery Background', { selector: 'input' })).toHaveValue('Gradient');
    expect(screen.getByLabelText('Video Gallery Background Gradient')).toHaveValue(
      'linear-gradient(135deg, #123456 0%, #654321 100%)',
    );
  });

  it('resets draft changes back to the opened baseline', async () => {
    const onSave = vi.fn();

    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                adapterId: 'masonry',
                adapterSettings: {
                  masonryColumns: 3,
                },
              },
            },
          },
        }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    const input = await screen.findByDisplayValue('3');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset All Changes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply Gallery Config' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            image: expect.objectContaining({
              adapterSettings: expect.objectContaining({ masonryColumns: 3 }),
            }),
          }),
        }),
      }),
    );
  });

  it('renders the optional clear action when provided', async () => {
    render(
      <GalleryConfigEditorModal
        opened={true}
        title="Responsive Gallery Config"
        value={{ mode: 'per-type' }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onClear={vi.fn()}
        contextSummary="This campaign is currently inheriting global gallery settings."
        clearLabel="Clear Campaign Overrides"
      />,
    );

    expect(await screen.findByRole('button', { name: 'Clear Campaign Overrides' })).toBeInTheDocument();
    expect(screen.getByText('This campaign is currently inheriting global gallery settings.')).toBeInTheDocument();
  });
});