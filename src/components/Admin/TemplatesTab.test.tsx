import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { TemplatesTab } from './TemplatesTab';
import type { CampaignTemplate } from '@/services/apiClient';

const builtinTemplate: CampaignTemplate = {
  id: 'tpl-builtin-1',
  name: 'Classic Grid',
  description: 'A classic grid layout',
  source: 'builtin',
  editable: false,
  settings: { visibility: 'public', galleryOverrides: null, layoutTemplateId: null },
  createdAt: '2026-01-01T00:00:00.000Z',
};

const userTemplate: CampaignTemplate = {
  id: 'tpl-user-1',
  name: 'My Custom Template',
  description: '',
  source: 'user',
  editable: true,
  settings: { visibility: 'private', galleryOverrides: null, layoutTemplateId: null },
  createdAt: '2026-02-01T00:00:00.000Z',
};

const campaigns = [
  { id: '1', title: 'Spring Campaign', companyId: 'acme', status: 'active' },
  { id: '2', title: 'Winter Campaign', companyId: 'acme', status: 'draft' },
];

function makeApiClient(overrides: Record<string, unknown> = {}) {
  return {
    listCampaignTemplates: vi.fn().mockResolvedValue([builtinTemplate, userTemplate]),
    deleteCampaignTemplate: vi.fn().mockResolvedValue(undefined),
    createCampaignTemplate: vi.fn().mockResolvedValue({ ...userTemplate, id: 'tpl-new', name: 'New Template' }),
    ...overrides,
  } as any;
}

describe('TemplatesTab', () => {
  it('shows a loader then renders built-in and custom sections', async () => {
    render(
      <TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />,
    );
    expect(await screen.findByText('Classic Grid')).toBeInTheDocument();
    expect(screen.getByText('My Custom Template')).toBeInTheDocument();
    // Section headers
    expect(screen.getAllByText('Built-in').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Custom').length).toBeGreaterThan(0);
  });

  it('shows "No custom templates yet." when only built-ins exist', async () => {
    const client = makeApiClient({
      listCampaignTemplates: vi.fn().mockResolvedValue([builtinTemplate]),
    });
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={vi.fn()} />);
    expect(await screen.findByText('No custom templates yet.')).toBeInTheDocument();
  });

  it('shows builtin badge for built-in templates', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('Classic Grid');
    // "Built-in" label appears as a badge text
    const badges = screen.getAllByText('Built-in');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows Custom badge for user templates', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('My Custom Template');
    const badges = screen.getAllByText('Custom');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('does not render delete button for non-editable templates', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('Classic Grid');
    expect(screen.queryByRole('button', { name: /delete template classic grid/i })).not.toBeInTheDocument();
  });

  it('renders delete button for editable user templates', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('My Custom Template');
    expect(screen.getByRole('button', { name: /delete template my custom template/i })).toBeInTheDocument();
  });

  it('deletes a user template and notifies', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={onNotify} />);
    await screen.findByText('My Custom Template');

    fireEvent.click(screen.getByRole('button', { name: /delete template my custom template/i }));

    await waitFor(() => {
      expect(client.deleteCampaignTemplate).toHaveBeenCalledWith('tpl-user-1');
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('notifies error when delete fails', async () => {
    const client = makeApiClient({
      deleteCampaignTemplate: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const onNotify = vi.fn();
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={onNotify} />);
    await screen.findByText('My Custom Template');

    fireEvent.click(screen.getByRole('button', { name: /delete template my custom template/i }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });

  it('notifies error when loading templates fails', async () => {
    const client = makeApiClient({
      listCampaignTemplates: vi.fn().mockRejectedValue(new Error('Network error')),
    });
    const onNotify = vi.fn();
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={onNotify} />);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error', text: 'Failed to load templates.' }),
      );
    });
  });

  // ── New Template modal ──────────────────────────────────────────────────────

  it('opens the New Template modal when button is clicked', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('Classic Grid');

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/weddings default/i)).toBeInTheDocument();
  });

  it('Create Template button is disabled when name is blank', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('Classic Grid');

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    await screen.findByRole('dialog');

    expect(screen.getByRole('button', { name: 'Create Template' })).toBeDisabled();
  });

  it('shows a live character count for the template description field', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    await screen.findByText('Classic Grid');

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    await screen.findByRole('dialog');

    expect(screen.getByText('0 characters')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/standard wedding campaign layout/i), {
      target: { value: 'abc' },
    });
    expect(screen.getByText('3 characters')).toBeInTheDocument();
  });

  it('creates a template and notifies on success', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={onNotify} />);
    await screen.findByText('Classic Grid');

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    await screen.findByRole('dialog');

    fireEvent.change(screen.getByPlaceholderText(/weddings default/i), {
      target: { value: 'My New Layout' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Template' }));

    await waitFor(() => {
      expect(client.createCampaignTemplate).toHaveBeenCalledWith({ name: 'My New Layout', description: '' });
    });
    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
    });
  });

  it('notifies error when create template fails', async () => {
    const client = makeApiClient({
      createCampaignTemplate: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const onNotify = vi.fn();
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={onNotify} />);
    await screen.findByText('Classic Grid');

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    await screen.findByRole('dialog');

    fireEvent.change(screen.getByPlaceholderText(/weddings default/i), {
      target: { value: 'Bad Template' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Template' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });
  });

  it('shows template description when present', async () => {
    render(<TemplatesTab apiClient={makeApiClient()} campaigns={campaigns} onNotify={vi.fn()} />);
    expect(await screen.findByText('A classic grid layout')).toBeInTheDocument();
  });

  it('reloads templates after creation', async () => {
    const client = makeApiClient();
    const onNotify = vi.fn();
    render(<TemplatesTab apiClient={client} campaigns={campaigns} onNotify={onNotify} />);
    await screen.findByText('Classic Grid');

    fireEvent.click(screen.getByRole('button', { name: /new template/i }));
    await screen.findByRole('dialog');

    fireEvent.change(screen.getByPlaceholderText(/weddings default/i), { target: { value: 'Reload Test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Template' }));

    await waitFor(() => {
      expect(client.listCampaignTemplates).toHaveBeenCalledTimes(2);
    });
  });
});
