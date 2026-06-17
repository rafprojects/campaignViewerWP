import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { AdminPanel } from './AdminPanel';

// AdminPanel reads useAuth().isSystemAdmin (P53-A). The test render harness does
// not wrap AuthProvider, so mock the hook. `mockIsSystemAdmin` is mutable so a
// test can model an editor (false) vs a system admin (true, the default).
let mockIsSystemAdmin = true;
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'admin@example.com', role: mockIsSystemAdmin ? 'admin' : 'editor' },
    permissions: [],
    isAuthenticated: true,
    isReady: true,
    isAdmin: true,
    isSystemAdmin: mockIsSystemAdmin,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

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
    mockIsSystemAdmin = true;
  });

  afterEach(() => {
    localStorage.clear();
    mockIsSystemAdmin = true;
  });

  /** Inject stubs for methods AdminPanel calls through query-backed loaders to prevent unhandled
   *  errors that delay renders and leak timers across sequential tests. */
  function withDefaults(partial: Record<string, unknown>) {
    const base = {
      getBaseUrl: vi.fn().mockReturnValue('test'),
      getLayoutTemplates: vi.fn().mockResolvedValue([]),
      listCampaignCategories: vi.fn().mockResolvedValue([]),
      getAccessSummary: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, perPage: 50, totalPages: 0 }),
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

    render(
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

  it('hides system-admin-only surfaces for an editor (P53-A)', async () => {
    mockIsSystemAdmin = false;
    const apiClient = withDefaults({
      get: vi.fn((path: string) => {
        if (path.includes('/campaigns?per_page=50') || path.includes('/campaigns?page=')) {
          return Promise.resolve(campaignsPayload);
        }
        return Promise.resolve([]);
      }),
      post: vi.fn().mockResolvedValue({ message: 'ok' }),
      delete: vi.fn().mockResolvedValue({ message: 'ok' }),
    });

    render(
      <AdminPanel
        apiClient={apiClient}
        onClose={() => undefined}
        onCampaignsUpdated={() => undefined}
        onNotify={vi.fn()}
      />,
    );

    // The editor still sees the panel + the Campaigns tab.
    await screen.findAllByText('Admin Campaign');
    // …but not the System Audit tab or the (system-admin) campaign Import button.
    expect(screen.queryByRole('tab', { name: 'System Audit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Import campaigns|^Import$/ })).not.toBeInTheDocument();
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
    // P47-F: campaign creation is gated to a concrete space — "New campaign" is
    // disabled in the default "All spaces" view. Pre-select a space (persisted
    // via useReloadSafeView under the default 'root' rootId) so the button is enabled.
    localStorage.setItem('wpsg_view_root_admin_space', JSON.stringify('1'));
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

    // Click "New Campaign" — template picker appears first.
    fireEvent.click(screen.getByRole('button', { name: 'Create new campaign' }));
    // Picker may load asynchronously; wait for the "Start Blank" option.
    const startBlank = await screen.findByText('Start Blank', {}, { timeout: 15000 });

    // Pick "Start Blank" to open the campaign form with no template.
    fireEvent.click(startBlank);
    await waitFor(
      () => expect(screen.getByRole('heading', { name: /New Campaign/ })).toBeInTheDocument(),
      { timeout: 15000 },
    );

    fireEvent.change(await screen.findByPlaceholderText('Campaign title'), { target: { value: 'New Campaign' } });
    fireEvent.change(screen.getByPlaceholderText('Campaign description'), { target: { value: 'Desc' } });
    fireEvent.change(screen.getByPlaceholderText('Search or add company…'), { target: { value: 'acme' } });

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
