import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { EditCampaignModal } from './EditCampaignModal';
import type { Campaign, MediaItem } from '@/types';

// Stub MediaLibraryPicker to avoid its heavy data fetching
vi.mock('./MediaLibraryPicker', () => ({
  MediaLibraryPicker: () => <div data-testid="media-library-picker" />,
}));

const campaign: Campaign = {
  id: '101',
  title: 'Test Campaign',
  description: 'Desc',
  company: 'acme',
  status: 'active',
  visibility: 'private',
  tags: [],
  thumbnail: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const mediaItem: MediaItem = {
  id: 'm1',
  type: 'image',
  source: 'upload',
  url: 'https://example.com/img.jpg',
  thumbnail: 'https://example.com/img.jpg',
  caption: 'Test Image',
  order: 1,
};

function defaultProps(overrides = {}) {
  return {
    opened: true,
    campaign,
    editMediaTab: 'details',
    onEditMediaTabChange: vi.fn(),
    editTitle: 'Test Campaign',
    onEditTitleChange: vi.fn(),
    editDescription: 'Desc',
    onEditDescriptionChange: vi.fn(),
    editCoverImage: '',
    onEditCoverImageChange: vi.fn(),
    onUploadCoverImage: vi.fn(),
    coverImageUploading: false,
    onClose: vi.fn(),
    onConfirmEdit: vi.fn(),
    editMediaLoading: false,
    editCampaignMedia: [],
    onRemoveMedia: vi.fn(),
    libraryMedia: [],
    libraryLoading: false,
    librarySearch: '',
    onLibrarySearchChange: vi.fn(),
    onLoadLibrary: vi.fn(),
    onAddFromLibrary: vi.fn(),
    uploadFile: null,
    uploadProgress: null,
    onUploadFile: vi.fn(),
    addMediaType: 'video' as const,
    onAddMediaTypeChange: vi.fn(),
    addMediaUrl: '',
    onAddMediaUrlChange: vi.fn(),
    addMediaCaption: '',
    onAddMediaCaptionChange: vi.fn(),
    addMediaLoading: false,
    onAddExternalMedia: vi.fn(),
    ...overrides,
  };
}

describe('EditCampaignModal', () => {
  it('does not render when opened is false', () => {
    render(<EditCampaignModal {...defaultProps({ opened: false })} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders Details tab with title and description inputs', () => {
    render(<EditCampaignModal {...defaultProps()} />);
    expect(screen.getByDisplayValue('Test Campaign')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Desc')).toBeInTheDocument();
  });

  it('fires onEditTitleChange when title input changes', () => {
    const onEditTitleChange = vi.fn();
    render(<EditCampaignModal {...defaultProps({ onEditTitleChange })} />);
    fireEvent.change(screen.getByDisplayValue('Test Campaign'), {
      target: { value: 'New Title' },
    });
    expect(onEditTitleChange).toHaveBeenCalledWith('New Title');
  });

  it('fires onEditDescriptionChange when description changes', () => {
    const onEditDescriptionChange = vi.fn();
    render(<EditCampaignModal {...defaultProps({ onEditDescriptionChange })} />);
    fireEvent.change(screen.getByDisplayValue('Desc'), {
      target: { value: 'New Desc' },
    });
    expect(onEditDescriptionChange).toHaveBeenCalledWith('New Desc');
  });

  it('calls onConfirmEdit when Save Changes is clicked', () => {
    const onConfirmEdit = vi.fn();
    render(<EditCampaignModal {...defaultProps({ onConfirmEdit })} />);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(onConfirmEdit).toHaveBeenCalled();
  });

  it('calls onClose (guardedClose) when Cancel is clicked', async () => {
    const onClose = vi.fn();
    render(<EditCampaignModal {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('renders list tab with media items and fires onRemoveMedia', async () => {
    const onRemoveMedia = vi.fn();
    render(
      <EditCampaignModal
        {...defaultProps({
          editMediaTab: 'list',
          editCampaignMedia: [mediaItem],
          onRemoveMedia,
        })}
      />,
    );
    const removeBtn = screen.getByRole('button', { name: /remove from campaign/i });
    fireEvent.click(removeBtn);
    expect(onRemoveMedia).toHaveBeenCalledWith(mediaItem);
  });

  it('shows Add Media button on empty list tab and fires tab change', () => {
    const onEditMediaTabChange = vi.fn();
    render(
      <EditCampaignModal
        {...defaultProps({ editMediaTab: 'list', onEditMediaTabChange })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add media/i }));
    expect(onEditMediaTabChange).toHaveBeenCalledWith('add');
  });

  it('renders add tab and fires URL/caption/type input lambdas', () => {
    const onAddMediaUrlChange = vi.fn();
    const onAddMediaCaptionChange = vi.fn();
    render(
      <EditCampaignModal
        {...defaultProps({ editMediaTab: 'add', onAddMediaUrlChange, onAddMediaCaptionChange })}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/youtube|image url/i), {
      target: { value: 'https://example.com/video.mp4' },
    });
    expect(onAddMediaUrlChange).toHaveBeenCalledWith('https://example.com/video.mp4');

    fireEvent.change(screen.getByPlaceholderText(/describe this media/i), {
      target: { value: 'My caption' },
    });
    expect(onAddMediaCaptionChange).toHaveBeenCalledWith('My caption');
  });

  it('fires onAddExternalMedia when Add External Media button is clicked', () => {
    const onAddExternalMedia = vi.fn();
    render(
      <EditCampaignModal
        {...defaultProps({
          editMediaTab: 'add',
          addMediaUrl: 'https://example.com/v.mp4',
          onAddExternalMedia,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add external media/i }));
    expect(onAddExternalMedia).toHaveBeenCalled();
  });

  it('fires onEditMediaTabChange when Back to Media List is clicked', () => {
    const onEditMediaTabChange = vi.fn();
    render(
      <EditCampaignModal {...defaultProps({ editMediaTab: 'add', onEditMediaTabChange })} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /back to media list/i }));
    expect(onEditMediaTabChange).toHaveBeenCalledWith('list');
  });

  it('fires Add More button on list tab with media to switch to add tab', () => {
    const onEditMediaTabChange = vi.fn();
    render(
      <EditCampaignModal
        {...defaultProps({
          editMediaTab: 'list',
          editCampaignMedia: [mediaItem],
          onEditMediaTabChange,
        })}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /add more/i }));
    expect(onEditMediaTabChange).toHaveBeenCalledWith('add');
  });
});
