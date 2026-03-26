import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { UnifiedCampaignModal } from './UnifiedCampaignModal';
import type { UnifiedCampaignModalHandle } from '@/hooks/useUnifiedCampaignModal';

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
  });

  it('opens the shared responsive editor from campaign settings', async () => {
    const modal = makeMockModal({ activeTab: 'settings' });
    render(<UnifiedCampaignModal modal={modal} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Responsive Config' }));

    expect(await screen.findByText('Shared Section Spacing')).toBeInTheDocument();
    expect(screen.getByText('Adapter Content Padding (px)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear Campaign Overrides' })).toBeInTheDocument();
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
