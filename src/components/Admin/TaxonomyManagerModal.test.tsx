import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { TaxonomyManagerModal } from './TaxonomyManagerModal';
import type { CampaignCategoryEntry, TagEntry } from '@/services/apiClient';

const mockCategory: CampaignCategoryEntry = {
  id: '1',
  name: 'Weddings',
  slug: 'weddings',
  count: 3,
  parent_id: 0,
};

const mockChildCategory: CampaignCategoryEntry = {
  id: '2',
  name: 'Indoor',
  slug: 'indoor',
  count: 1,
  parent_id: 1,
};

const mockTag: TagEntry = { id: 10, name: 'Spring', slug: 'spring', count: 2 };
const mockMediaTag: TagEntry = { id: 20, name: 'Landscape', slug: 'landscape', count: 5 };

function makeApiClient(overrides: Record<string, unknown> = {}) {
  return new Proxy(
    {
      listCampaignCategories: vi.fn().mockResolvedValue([mockCategory]),
      listCampaignTags: vi.fn().mockResolvedValue([mockTag]),
      listMediaTags: vi.fn().mockResolvedValue([mockMediaTag]),
      createCampaignCategory: vi.fn().mockResolvedValue({ ...mockCategory, id: '99', name: 'New Cat' }),
      updateCampaignCategory: vi.fn().mockResolvedValue({ ...mockCategory, name: 'Renamed' }),
      deleteCampaignCategory: vi.fn().mockResolvedValue(undefined),
      createCampaignTag: vi.fn().mockResolvedValue({ id: 11, name: 'Summer', slug: 'summer', count: 0 }),
      deleteCampaignTag: vi.fn().mockResolvedValue(undefined),
      createMediaTag: vi.fn().mockResolvedValue({ id: 21, name: 'Portrait', slug: 'portrait', count: 0 }),
      deleteMediaTag: vi.fn().mockResolvedValue(undefined),
      getBaseUrl: vi.fn().mockReturnValue('http://localhost'),
      ...overrides,
    },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return vi.fn().mockResolvedValue([]);
      },
    },
  ) as any;
}

const baseProps = {
  opened: true,
  onClose: vi.fn(),
  onNotify: vi.fn(),
};

describe('TaxonomyManagerModal', () => {
  it('renders nothing when closed', () => {
    render(
      <TaxonomyManagerModal {...baseProps} opened={false} apiClient={makeApiClient()} />,
    );
    expect(screen.queryByText('Manage Taxonomy')).not.toBeInTheDocument();
  });

  it('renders the modal title and tabs when opened', async () => {
    render(<TaxonomyManagerModal {...baseProps} apiClient={makeApiClient()} />);
    expect(await screen.findByText('Manage Taxonomy')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Campaign Tags' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Media Tags' })).toBeInTheDocument();
  });

  it('shows loaded categories in the Categories tab', async () => {
    render(<TaxonomyManagerModal {...baseProps} apiClient={makeApiClient()} />);
    expect(await screen.findByText('Weddings')).toBeInTheDocument();
  });

  it('shows child category indented under parent', async () => {
    const client = makeApiClient({
      listCampaignCategories: vi.fn().mockResolvedValue([mockCategory, mockChildCategory]),
    });
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    expect(await screen.findByText('Indoor')).toBeInTheDocument();
    // "Weddings" appears as both the parent row name and as the child's parent badge
    expect(screen.getAllByText('Weddings').length).toBeGreaterThanOrEqual(1);
  });

  it('shows "No categories yet." when list is empty', async () => {
    const client = makeApiClient({ listCampaignCategories: vi.fn().mockResolvedValue([]) });
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
  });

  it('calls createCampaignCategory when Add is clicked', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    await screen.findByText('Weddings');

    const input = screen.getByRole('textbox', { name: /new category name/i });
    fireEvent.change(input, { target: { value: 'Events' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(client.createCampaignCategory).toHaveBeenCalledWith('Events');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('calls createCampaignCategory on Enter keypress', async () => {
    const client = makeApiClient();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    await screen.findByText('Weddings');

    const input = screen.getByRole('textbox', { name: /new category name/i });
    fireEvent.change(input, { target: { value: 'Portraits' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(client.createCampaignCategory).toHaveBeenCalledWith('Portraits');
    });
  });

  it('notifies error when createCampaignCategory fails', async () => {
    const client = makeApiClient({
      createCampaignCategory: vi.fn().mockRejectedValue(new Error('Server error')),
    });
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    await screen.findByText('Weddings');

    const input = screen.getByRole('textbox', { name: /new category name/i });
    fireEvent.change(input, { target: { value: 'Bad' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });

  // ── Campaign Tags tab ───────────────────────────────────────────────────────

  it('shows campaign tags in the Campaign Tags tab', async () => {
    render(<TaxonomyManagerModal {...baseProps} apiClient={makeApiClient()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign Tags' }));
    expect(await screen.findByText('Spring')).toBeInTheDocument();
  });

  it('calls createCampaignTag when Add is clicked on Campaign Tags tab', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign Tags' }));
    await screen.findByText('Spring');

    const input = screen.getByRole('textbox', { name: /new campaign tag/i });
    fireEvent.change(input, { target: { value: 'Autumn' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(client.createCampaignTag).toHaveBeenCalledWith('Autumn');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('calls deleteCampaignTag when delete button is clicked', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign Tags' }));
    await screen.findByText('Spring');

    fireEvent.click(screen.getByRole('button', { name: /delete spring/i }));

    await waitFor(() => {
      expect(client.deleteCampaignTag).toHaveBeenCalledWith('10');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('notifies error when deleteCampaignTag fails', async () => {
    const client = makeApiClient({
      deleteCampaignTag: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign Tags' }));
    await screen.findByText('Spring');

    fireEvent.click(screen.getByRole('button', { name: /delete spring/i }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });

  it('shows "No campaign tags yet." when list is empty', async () => {
    const client = makeApiClient({ listCampaignTags: vi.fn().mockResolvedValue([]) });
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Campaign Tags' }));
    expect(await screen.findByText('No campaign tags yet.')).toBeInTheDocument();
  });

  // ── Media Tags tab ──────────────────────────────────────────────────────────

  it('shows media tags in the Media Tags tab', async () => {
    render(<TaxonomyManagerModal {...baseProps} apiClient={makeApiClient()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Media Tags' }));
    expect(await screen.findByText('Landscape')).toBeInTheDocument();
  });

  it('calls createMediaTag when Add is clicked on Media Tags tab', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Media Tags' }));
    await screen.findByText('Landscape');

    const input = screen.getByRole('textbox', { name: /new media tag/i });
    fireEvent.change(input, { target: { value: 'Abstract' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(client.createMediaTag).toHaveBeenCalledWith('Abstract');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('calls deleteMediaTag when delete button is clicked', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Media Tags' }));
    await screen.findByText('Landscape');

    fireEvent.click(screen.getByRole('button', { name: /delete landscape/i }));

    await waitFor(() => {
      expect(client.deleteMediaTag).toHaveBeenCalledWith('20');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('notifies error when deleteMediaTag fails', async () => {
    const client = makeApiClient({
      deleteMediaTag: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Media Tags' }));
    await screen.findByText('Landscape');

    fireEvent.click(screen.getByRole('button', { name: /delete landscape/i }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });

  it('shows "No media tags yet." when list is empty', async () => {
    const client = makeApiClient({ listMediaTags: vi.fn().mockResolvedValue([]) });
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Media Tags' }));
    expect(await screen.findByText('No media tags yet.')).toBeInTheDocument();
  });

  // ── CategoryRow editing ─────────────────────────────────────────────────────

  it('enters edit mode and saves a renamed category', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /rename weddings/i }));

    const editInput = screen.getByRole('textbox', { name: /edit category name/i });
    fireEvent.change(editInput, { target: { value: 'Ceremonies' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(client.updateCampaignCategory).toHaveBeenCalledWith('1', { name: 'Ceremonies' });
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('cancels category edit when Cancel is clicked', async () => {
    render(<TaxonomyManagerModal {...baseProps} apiClient={makeApiClient()} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /rename weddings/i }));
    expect(screen.getByRole('textbox', { name: /edit category name/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('textbox', { name: /edit category name/i })).not.toBeInTheDocument();
    expect(screen.getByText('Weddings')).toBeInTheDocument();
  });

  it('saves category on Enter key in edit input', async () => {
    const client = makeApiClient();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /rename weddings/i }));
    const editInput = screen.getByRole('textbox', { name: /edit category name/i });
    fireEvent.change(editInput, { target: { value: 'Receptions' } });
    fireEvent.keyDown(editInput, { key: 'Enter' });

    await waitFor(() => {
      expect(client.updateCampaignCategory).toHaveBeenCalledWith('1', { name: 'Receptions' });
    });
  });

  it('cancels category edit on Escape key', async () => {
    render(<TaxonomyManagerModal {...baseProps} apiClient={makeApiClient()} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /rename weddings/i }));
    const editInput = screen.getByRole('textbox', { name: /edit category name/i });
    fireEvent.keyDown(editInput, { key: 'Escape' });

    expect(screen.queryByRole('textbox', { name: /edit category name/i })).not.toBeInTheDocument();
  });

  it('calls deleteCampaignCategory when delete is clicked', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /delete weddings/i }));

    await waitFor(() => {
      expect(client.deleteCampaignCategory).toHaveBeenCalledWith('1');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('notifies error when deleteCampaignCategory fails', async () => {
    const client = makeApiClient({
      deleteCampaignCategory: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const onNotify = vi.fn();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} onNotify={onNotify} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /delete weddings/i }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });

  it('does not call updateCampaignCategory when name is unchanged', async () => {
    const client = makeApiClient();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    await screen.findByText('Weddings');

    fireEvent.click(screen.getByRole('button', { name: /rename weddings/i }));
    // Don't change the value — click Save immediately
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: /edit category name/i })).not.toBeInTheDocument();
    });
    expect(client.updateCampaignCategory).not.toHaveBeenCalled();
  });

  it('does not call createCampaignCategory when name is blank', async () => {
    const client = makeApiClient();
    render(<TaxonomyManagerModal {...baseProps} apiClient={client} />);
    await screen.findByText('Weddings');

    // Input is blank by default; clicking Add should no-op
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(() => {
      expect(client.createCampaignCategory).not.toHaveBeenCalled();
    });
  });
});
