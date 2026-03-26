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