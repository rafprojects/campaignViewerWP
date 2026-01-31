import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { AdminPanel } from './AdminPanel';

const campaignsPayload = {
  items: [
    {
      id: '101',
      companyId: 'acme',
      title: 'Admin Campaign',
      description: 'Admin description',
      status: 'active',
      visibility: 'private',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      tags: [],
    },
  ],
};

describe('AdminPanel', () => {
  it('loads campaigns and supports access grant/revoke', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) {
          return Promise.resolve(campaignsPayload);
        }
        if (path.includes('/access')) {
          return Promise.resolve([
            {
              userId: '55',
              campaignId: '101',
              source: 'campaign',
              grantedAt: '2026-01-01T00:00:00.000Z',
            },
          ]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn().mockResolvedValue({ message: 'ok' }),
      delete: vi.fn().mockResolvedValue({ message: 'ok' }),
    } as any;

    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    const campaignLabels = await screen.findAllByText('Admin Campaign');
    expect(campaignLabels.length).toBeGreaterThan(0);

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));

    await waitFor(
      () => {
        expect(apiClient.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/access');
      },
      { timeout: 5000 },
    );

    const userIdInput = await screen.findByLabelText('User ID');
    fireEvent.change(userIdInput, { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(
      () => {
        expect(apiClient.post).toHaveBeenCalledWith(
          '/wp-json/wp-super-gallery/v1/campaigns/101/access',
          expect.objectContaining({ userId: 42, source: 'campaign', action: 'grant' }),
        );
      },
      { timeout: 5000 },
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke access' }));

    await waitFor(
      () => {
        expect(apiClient.delete).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/access/55');
      },
      { timeout: 5000 },
    );
  }, 30000);

  it('shows error when campaigns fail to load', async () => {
    const apiClient = {
      get: vi.fn().mockRejectedValue(new Error('Load failed')),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    expect(await screen.findByText('Load failed')).toBeInTheDocument();
  });

  it('creates a new campaign and notifies', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue({ items: [] }),
      post: vi.fn().mockResolvedValue({ id: '200' }),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();
    const onCampaignsUpdated = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={onCampaignsUpdated}
        onNotify={onNotify}
      />,
    );

    // Open the campaign form modal
    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'New Campaign' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByLabelText('Company Slug'), { target: { value: 'acme' } });
    fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'a,b' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns',
        expect.objectContaining({ title: 'New Campaign' }),
      );
    });

    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text: 'Campaign created.' }),
    );
  });

  it('shows error when campaign creation fails', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue({ items: [] }),
      post: vi.fn().mockRejectedValue(new Error('Create failed')),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    // Open the campaign form modal
    fireEvent.click(screen.getByRole('button', { name: 'New Campaign' }));

    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'New Campaign' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Create failed' }),
      );
    });
  });

  it('validates access user id before applying', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) {
          return Promise.resolve(campaignsPayload);
        }
        if (path.includes('/access')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'User ID is required.' }),
    );

    fireEvent.change(screen.getByLabelText('User ID'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'User ID must be a positive numeric value.' }),
    );
  });

  it('loads audit entries when audit tab is opened', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) {
          return Promise.resolve(campaignsPayload);
        }
        if (path.includes('/audit')) {
          return Promise.resolve([
            { id: 'a1', action: 'updated', details: { field: 'title' }, userId: 7, createdAt: '2026-01-03T00:00:00.000Z' },
          ]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Audit' }));
    expect(await screen.findByText('updated')).toBeInTheDocument();
  });

  it('edits an existing campaign', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue(campaignsPayload),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn().mockResolvedValue({ id: '101' }),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
    // Wait for modal to open
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101',
        expect.objectContaining({ title: 'Updated Title' }),
      );
    });
  });

  it('grants access for a campaign', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) {
          return Promise.resolve(campaignsPayload);
        }
        if (path.includes('/access')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));
    fireEvent.change(await screen.findByLabelText('User ID'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns/101/access',
        expect.objectContaining({ userId: 42, source: 'campaign', action: 'grant' }),
      );
    });
  });

  it('shows company access helper text when source is company', async () => {
    const apiClient = {
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50')) {
          return Promise.resolve(campaignsPayload);
        }
        if (path.includes('/access')) {
          return Promise.resolve([]);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'Access' }));

    const sourceInputs = screen.getAllByLabelText('Source');
    fireEvent.mouseDown(sourceInputs[0]);
    const companyOptions = screen.getAllByText('Company');
    fireEvent.click(companyOptions[companyOptions.length - 1]);

    expect(screen.getByText(/company grants apply across all campaigns/i)).toBeInTheDocument();
  });

  it('archives campaign and handles errors', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue(campaignsPayload),
      post: vi.fn().mockRejectedValue(new Error('Archive failed')),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await screen.findByText('Archive campaign');
    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Archive failed' }),
      );
    });
  });

  it('archives campaign successfully', async () => {
    const apiClient = {
      get: vi.fn().mockResolvedValue(campaignsPayload),
      post: vi.fn().mockResolvedValue({}),
      delete: vi.fn(),
      put: vi.fn(),
    } as any;
    const onNotify = vi.fn();

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={onNotify}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    await screen.findByText('Archive campaign');
    const archiveButtons = screen.getAllByRole('button', { name: 'Archive' });
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Campaign archived.' }),
      );
    });
  });
});
