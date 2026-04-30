import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { AdminPanel } from './AdminPanel';

// Static imports to warm the module cache for lazy-loaded modals.
// This avoids dynamic import() in beforeAll which can hang under worker pressure.
import './AdminCampaignArchiveModal';
import './AdminCampaignRestoreModal';

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
  page: 1,
  perPage: 20,
  total: 1,
  totalPages: 1,
};

describe('AdminPanel', () => {
  // AdminPanel persists active tab via useLocalStorage('wpsg_admin_active_tab').
  // Clear localStorage between tests to prevent tab state leaking across tests.
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /** Inject stubs for methods AdminPanel calls via SWR to prevent unhandled
   *  errors that delay renders and leak timers across sequential tests. */
  function withDefaults(partial: Record<string, unknown>) {
    const base = {
      getLayoutTemplates: vi.fn().mockResolvedValue([]),
      listCampaignCategories: vi.fn().mockResolvedValue([]),
      ...partial,
    };
    // Return a Proxy so any un-stubbed method returns a resolved promise
    // instead of throwing TypeError.
    return new Proxy(base, {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return vi.fn().mockResolvedValue([]);
      },
    }) as any;
  }

  it('loads campaigns list', async () => {
    const apiClient = withDefaults({
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50') || path.includes('/campaigns?page=')) {
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
    });

    const { unmount } = render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    const campaignLabels = await screen.findAllByText('Admin Campaign');
    expect(campaignLabels.length).toBeGreaterThan(0);
  }, 30000);

  it('shows error when campaigns fail to load', async () => {
    const apiClient = withDefaults({
      get: vi.fn().mockRejectedValue(new Error('Load failed')),
      post: vi.fn(),
      delete: vi.fn(),
      put: vi.fn(),
    });

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
    const apiClient = withDefaults({
      get: vi.fn().mockResolvedValue({ items: [] }),
      post: vi.fn().mockResolvedValue({ id: '200' }),
      delete: vi.fn(),
      put: vi.fn(),
    });
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

    // Open the campaign form modal (lazy-loaded — waitFor with generous timeout
    // to handle Suspense resolution under full-suite CPU load)
    fireEvent.click(screen.getByRole('button', { name: 'Create new campaign' }));
    await waitFor(
      () => expect(screen.getByRole('heading', { name: 'New Campaign' })).toBeInTheDocument(),
      { timeout: 15000 },
    );

    fireEvent.change(await screen.findByPlaceholderText('Campaign title'), { target: { value: 'New Campaign' } });
    fireEvent.change(screen.getByPlaceholderText('Campaign description'), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByPlaceholderText('company-id'), { target: { value: 'acme' } });
    fireEvent.change(screen.getByPlaceholderText('tag1, tag2, tag3'), { target: { value: 'a,b' } });

    fireEvent.click(screen.getByRole('button', { name: 'Create Campaign' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/campaigns',
        expect.objectContaining({ title: 'New Campaign' }),
      );
    });

    await waitFor(() => {
      expect(onNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'success', text: 'Campaign created.' }),
      );
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'New Campaign' })).not.toBeInTheDocument();
    });
  });

});
