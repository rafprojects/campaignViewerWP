import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../../test/test-utils';
import { UnifiedCampaignModal } from './UnifiedCampaignModal';
import type { UnifiedCampaignModalHandle } from '@/hooks/useUnifiedCampaignModal';
import { getAdapterSelectOptions } from '@/components/Galleries/Adapters/adapterRegistry';

// Static import to warm module cache for the lazy-loaded responsive editor.
import '@/components/Common/GalleryConfigEditorModal';

// Stub MediaLibraryPicker to avoid its heavy data fetching
vi.mock('@/components/Campaign/MediaLibraryPicker', () => ({
  MediaLibraryPicker: () => <div data-testid="media-library-picker" />,
}));

function makeMockModal(overrides: Partial<UnifiedCampaignModalHandle> = {}): UnifiedCampaignModalHandle {
  return {
    opened: true,
    mode: 'edit',
    editingCampaignId: 'c1',
    formState: {
      title: 'Test Campaign',
      description: 'A test campaign',
      company: 'acme',
      coverImage: '',
      status: 'active',
      visibility: 'private',
      tags: 'tag1, tag2',
      publishAt: '',
      unpublishAt: '',
      layoutTemplateId: '',
      imageAdapterId: '',
      videoAdapterId: '',
      categories: [],
    },
    updateForm: vi.fn(),
    isSaving: false,
    coverImageUploading: false,
    handleSelectCoverImage: vi.fn(),
    handleUploadCoverImage: vi.fn(),
    activeTab: 'details',
    setActiveTab: vi.fn(),
    mediaItems: [],
    mediaLoading: false,
    handleRemoveMedia: vi.fn(),
    handleAddFromLibrary: vi.fn(),
    handleUploadMedia: vi.fn(),
    handleAddExternalMedia: vi.fn(),
    uploadFile: null,
    uploadProgress: null,
    addMediaUrl: '',
    setAddMediaUrl: vi.fn(),
    addMediaType: 'video',
    setAddMediaType: vi.fn(),
    addMediaCaption: '',
    setAddMediaCaption: vi.fn(),
    addMediaLoading: false,
    libraryMedia: [],
    libraryLoading: false,
    librarySearch: '',
    setLibrarySearch: vi.fn(),
    loadLibraryMedia: vi.fn(),
    openForEdit: vi.fn(),
    openForCreate: vi.fn(),
    close: vi.fn(),
    save: vi.fn(),
    ...overrides,
  };
}

async function openCampaignResponsiveConfigDialog() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));

  await screen.findByText('Campaign Responsive Gallery Config', {}, { timeout: 10000 });

  return await waitFor(() => {
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(1);
    const dialog = dialogs[dialogs.length - 1];
    expect(within(dialog).getByText('Campaign Responsive Gallery Config')).toBeInTheDocument();
    return dialog as HTMLElement;
  });
}

describe('UnifiedCampaignModal', () => {
  it('does not render when opened is false', () => {
    const modal = makeMockModal({ opened: false });
    render(<UnifiedCampaignModal modal={modal} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders Details tab with title, description, and company inputs', () => {
    const modal = makeMockModal();
    render(<UnifiedCampaignModal modal={modal} />);
    expect(screen.getByDisplayValue('Test Campaign')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test campaign')).toBeInTheDocument();
    expect(screen.getByDisplayValue('acme')).toBeInTheDocument();
  });

  it('fires updateForm when title changes', () => {
    const updateForm = vi.fn();
    const modal = makeMockModal({ updateForm });
    render(<UnifiedCampaignModal modal={modal} />);
    fireEvent.change(screen.getByDisplayValue('Test Campaign'), {
      target: { value: 'New Title' },
    });
    expect(updateForm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Title' }),
    );
  });

  it('fires updateForm when description changes', () => {
    const updateForm = vi.fn();
    const modal = makeMockModal({ updateForm });
    render(<UnifiedCampaignModal modal={modal} />);
    fireEvent.change(screen.getByDisplayValue('A test campaign'), {
      target: { value: 'Updated Desc' },
    });
    expect(updateForm).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Updated Desc' }),
    );
  });

  it('calls save when Save Changes is clicked', () => {
    const save = vi.fn();
    const modal = makeMockModal({ save });
    render(<UnifiedCampaignModal modal={modal} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(save).toHaveBeenCalled();
  });

  it('calls close (via guardedClose) when Cancel is clicked on clean form', async () => {
    const close = vi.fn();
    const modal = makeMockModal({ close });
    render(<UnifiedCampaignModal modal={modal} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(close).toHaveBeenCalled();
    });
  });

  it('shows "New Campaign" title in create mode', () => {
    const modal = makeMockModal({ mode: 'create', editingCampaignId: null });
    render(<UnifiedCampaignModal modal={modal} />);
    expect(screen.getByText('New Campaign')).toBeInTheDocument();
  });

  it('hides Media tab in create mode', () => {
    const modal = makeMockModal({ mode: 'create', editingCampaignId: null });
    render(<UnifiedCampaignModal modal={modal} />);
    expect(screen.queryByRole('tab', { name: /media/i })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /settings/i })).toBeInTheDocument();
  });

  it('shows Media tab in edit mode', () => {
    const modal = makeMockModal({ mode: 'edit' });
    render(<UnifiedCampaignModal modal={modal} />);
    expect(screen.getByRole('tab', { name: /media/i })).toBeInTheDocument();
  });

  it('renders Settings tab with status and visibility', () => {
    const modal = makeMockModal({ activeTab: 'settings' });
    render(<UnifiedCampaignModal modal={modal} />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Visibility')).toBeInTheDocument();
    expect(screen.getByText('Gallery Mode Override')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Responsive Config' })).toBeInTheDocument();
    expect(screen.getByText('Inheriting global gallery settings')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Categories')).toBeInTheDocument();
  });

  it('renders the current nested gallery mode override on the settings tab', () => {
    const modal = makeMockModal({
      activeTab: 'settings',
      formState: {
        title: 'Test Campaign',
        description: 'A test campaign',
        company: 'acme',
        coverImage: '',
        status: 'active',
        visibility: 'private',
        tags: 'tag1, tag2',
        publishAt: '',
        unpublishAt: '',
        layoutTemplateId: '',
        imageAdapterId: '',
        videoAdapterId: '',
        galleryOverrides: { mode: 'unified' },
        categories: [],
      },
    });
    render(<UnifiedCampaignModal modal={modal} />);

    expect(screen.getByDisplayValue('Unified')).toBeInTheDocument();
    expect(screen.getByLabelText('Unified Gallery', { selector: 'input' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Image Gallery')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Video Gallery')).not.toBeInTheDocument();
  });

  it('updates the quick unified gallery override from the settings tab', () => {
    const updateForm = vi.fn();
    const modal = makeMockModal({
      activeTab: 'settings',
      updateForm,
      formState: {
        title: 'Test Campaign',
        description: 'A test campaign',
        company: 'acme',
        coverImage: '',
        status: 'active',
        visibility: 'private',
        tags: 'tag1, tag2',
        publishAt: '',
        unpublishAt: '',
        layoutTemplateId: '',
        imageAdapterId: 'masonry',
        videoAdapterId: 'diamond',
        galleryOverrides: { mode: 'unified' },
        categories: [],
      },
    });
    const unifiedAdapterLabel = getAdapterSelectOptions({ context: 'unified-gallery' })
      .find((option) => option.value === 'classic')?.label;

    render(<UnifiedCampaignModal modal={modal} />);

    fireEvent.click(screen.getByLabelText('Unified Gallery', { selector: 'input' }));
    fireEvent.click(screen.getByRole('option', { name: unifiedAdapterLabel ?? 'Classic' }));

    expect(updateForm).toHaveBeenCalledWith(expect.objectContaining({
      imageAdapterId: '',
      videoAdapterId: '',
      galleryOverrides: expect.objectContaining({
        mode: 'unified',
        breakpoints: expect.objectContaining({
          desktop: expect.objectContaining({
            unified: expect.objectContaining({ adapterId: 'classic' }),
          }),
          tablet: expect.objectContaining({
            unified: expect.objectContaining({ adapterId: 'classic' }),
          }),
          mobile: expect.objectContaining({
            unified: expect.objectContaining({ adapterId: 'classic' }),
          }),
        }),
      }),
    }));
  });

  it('opens the shared responsive editor from campaign settings', async () => {
    const modal = makeMockModal({ activeTab: 'settings' });
    render(<UnifiedCampaignModal modal={modal} />);

    const dialog = await openCampaignResponsiveConfigDialog();

    expect(within(dialog).getByText('Shared Section Spacing')).toBeInTheDocument();
    expect(within(dialog).getByText('Adapter Content Padding (px)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Clear Campaign Overrides' })).toBeInTheDocument();
    expect(within(dialog).getByText(/currently inheriting global gallery settings/i)).toBeInTheDocument();
  });

  it('shows overridden-state messaging when campaign gallery overrides exist', async () => {
    const modal = makeMockModal({
      activeTab: 'settings',
      formState: {
        title: 'Test Campaign',
        description: 'A test campaign',
        company: 'acme',
        coverImage: '',
        status: 'active',
        visibility: 'private',
        tags: 'tag1, tag2',
        publishAt: '',
        unpublishAt: '',
        layoutTemplateId: '',
        imageAdapterId: 'masonry',
        videoAdapterId: '',
        galleryOverrides: {
          mode: 'per-type',
        },
        categories: [],
      },
    });
    render(<UnifiedCampaignModal modal={modal} />);

    const dialog = await openCampaignResponsiveConfigDialog();

    expect(within(dialog).getByText(/currently stores custom gallery overrides/i)).toBeInTheDocument();
  });

  it('shows live campaign override summaries and supports inline reset to inherited settings', () => {
    const updateForm = vi.fn();
    const modal = makeMockModal({
      activeTab: 'settings',
      updateForm,
      formState: {
        title: 'Test Campaign',
        description: 'A test campaign',
        company: 'acme',
        coverImage: '',
        status: 'active',
        visibility: 'private',
        tags: 'tag1, tag2',
        publishAt: '',
        unpublishAt: '',
        layoutTemplateId: '',
        imageAdapterId: '',
        videoAdapterId: '',
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: {
              image: {
                common: {
                  sectionPadding: 24,
                },
              },
              video: {
                adapterId: 'diamond',
              },
            },
          },
        },
        categories: [],
      },
    });

    render(<UnifiedCampaignModal modal={modal} />);

    expect(screen.getByText('Custom gallery overrides')).toBeInTheDocument();
    expect(screen.getByText('Responsive settings: customized')).toBeInTheDocument();
    expect(screen.getByText('Video: breakpoint-specific override')).toBeInTheDocument();
    expect(screen.getByText('Mode: per-type')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Use Inherited Gallery Settings' }));

    expect(updateForm).toHaveBeenCalledWith(expect.objectContaining({
      imageAdapterId: '',
      videoAdapterId: '',
      galleryOverrides: undefined,
    }));
  });

  it('saves unified adapter overrides from the shared responsive editor', async () => {
    const updateForm = vi.fn();
    const modal = makeMockModal({ activeTab: 'settings', updateForm });
    const unifiedAdapterLabel = getAdapterSelectOptions({ context: 'unified-gallery' })
      .find((option) => option.value === 'classic')?.label;

    render(<UnifiedCampaignModal modal={modal} />);

    const dialog = await openCampaignResponsiveConfigDialog();

    const galleryModeInput = await within(dialog).findByLabelText('Gallery Mode', { selector: 'input' }, { timeout: 10000 });
    fireEvent.click(galleryModeInput);
    fireEvent.click(await screen.findByRole('option', { name: 'Unified' }));

    expect(await within(dialog).findByLabelText('Unified Gallery Adapter', { selector: 'input' })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByLabelText('Unified Gallery Adapter', { selector: 'input' }));
    fireEvent.click(await screen.findByRole('option', { name: unifiedAdapterLabel ?? 'Classic' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply Campaign Gallery Config' }));

    await waitFor(() => {
      expect(updateForm).toHaveBeenCalledWith(expect.objectContaining({
        imageAdapterId: 'classic',
        videoAdapterId: 'classic',
        galleryOverrides: expect.objectContaining({
          mode: 'unified',
          breakpoints: expect.objectContaining({
            desktop: expect.objectContaining({
              unified: expect.objectContaining({ adapterId: 'classic' }),
            }),
            tablet: expect.objectContaining({
              unified: expect.objectContaining({ adapterId: 'classic' }),
            }),
            mobile: expect.objectContaining({
              unified: expect.objectContaining({ adapterId: 'classic' }),
            }),
          }),
        }),
      }));
    });
  });

  it('renders media grid with items on media tab', () => {
    const mediaItem = {
      id: 'm1',
      type: 'image' as const,
      source: 'upload' as const,
      url: 'https://example.com/img.jpg',
      thumbnail: 'https://example.com/img.jpg',
      caption: 'Test Image',
      order: 1,
    };
    const handleRemoveMedia = vi.fn();
    const modal = makeMockModal({
      activeTab: 'media',
      mediaItems: [mediaItem],
      handleRemoveMedia,
    });
    render(<UnifiedCampaignModal modal={modal} />);
    const removeBtn = screen.getByRole('button', { name: /remove from campaign/i });
    fireEvent.click(removeBtn);
    expect(handleRemoveMedia).toHaveBeenCalledWith(mediaItem);
  });
});
