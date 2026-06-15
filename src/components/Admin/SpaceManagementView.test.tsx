import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { SpaceManagementView } from './SpaceManagementView';
import type { ApiClient } from '@/services/apiClient';

const DELEGATED_SPACE = {
  id: 10,
  slug: 'delegated-space',
  name: 'Delegated Space',
  isolationMode: 'delegated' as const,
  isDefault: false,
  archived: false,
  grantCount: 0,
  effectiveLevel: 'owner' as const,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const OPEN_SPACE = {
  id: 11,
  slug: 'open-space',
  name: 'Open Space',
  isolationMode: 'open' as const,
  isDefault: true,
  archived: false,
  grantCount: 0,
  effectiveLevel: 'owner' as const,
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const ASSET_A = { id: 'ov-uuid-1', url: 'https://ex.com/ov1.png', name: 'Asset Alpha', isUniversal: false, tags: [], uploadedAt: '2025-01-01' };
const ASSET_B = { id: 'ov-uuid-2', url: 'https://ex.com/ov2.png', name: 'Asset Beta', isUniversal: false, tags: [], uploadedAt: '2025-01-01' };
const FONT_A = { id: 'fo-uuid-1', url: 'https://ex.com/fa.woff2', name: 'Font Alpha', filename: 'fa.woff2', format: 'woff2', uploadedAt: '2025-01-01' };

function createMockApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  const get = vi.fn().mockImplementation((url: string) => {
    if (/\/spaces\/\d+\/library/.test(url)) {
      return Promise.resolve({ asset: ['ov-uuid-1'], font: [] });
    }
    if (/\/spaces\/\d+\/access/.test(url)) {
      return Promise.resolve([]);
    }
    if (/\/spaces($|\?)/.test(url) || url.endsWith('/spaces')) {
      return Promise.resolve([DELEGATED_SPACE, OPEN_SPACE]);
    }
    if (url.includes('/admin/asset-library')) {
      return Promise.resolve([ASSET_A, ASSET_B]);
    }
    if (url.includes('/admin/font-library')) {
      return Promise.resolve([FONT_A]);
    }
    return Promise.resolve([]);
  });

  return {
    get,
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    postForm: vi.fn().mockResolvedValue({}),
    getBaseUrl: vi.fn().mockReturnValue('http://test'),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as ApiClient;
}

async function selectSpace(name: string) {
  await waitFor(() => expect(screen.getByText(name)).toBeInTheDocument());
  fireEvent.click(screen.getByText(name));
}

async function clickTab(label: string) {
  const tab = screen.getByRole('tab', { name: label });
  fireEvent.click(tab);
}

function renderView(apiClient: ApiClient) {
  render(
    <SpaceManagementView
      apiClient={apiClient}
      onNotify={vi.fn()}
      onSpacesChanged={vi.fn()}
    />,
  );
}

describe('SpaceManagementView — Library tab', () => {
  let apiClient: ReturnType<typeof createMockApiClient>;

  beforeEach(() => {
    apiClient = createMockApiClient();
    vi.clearAllMocks();
  });

  it('Library tab is disabled when no space is selected', async () => {
    renderView(apiClient);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Library' })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('data-disabled', 'true');
  });

  it('Library tab is enabled for open spaces and explains why there is nothing to manage', async () => {
    renderView(apiClient);
    await selectSpace('Open Space');
    const tab = screen.getByRole('tab', { name: 'Library' });
    expect(tab).not.toHaveAttribute('data-disabled', 'true');
    await clickTab('Library');
    await waitFor(() =>
      expect(screen.getByText(/per-space selection only applies to/i)).toBeInTheDocument(),
    );
  });

  it('Library tab is enabled for delegated spaces', async () => {
    renderView(apiClient);
    await selectSpace('Delegated Space');
    expect(screen.getByRole('tab', { name: 'Library' })).not.toHaveAttribute('data-disabled', 'true');
  });

  it('shows the asset grid and font controls after selecting Library tab', async () => {
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Asset Alpha' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Asset Beta' })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Font Alpha' })).toBeInTheDocument();
    });
  });

  it('reflects current associations — associated asset is selected', async () => {
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Asset Alpha' })).toBeInTheDocument());

    // ov-uuid-1 is associated → checked; ov-uuid-2 is not.
    expect(screen.getByRole('checkbox', { name: 'Asset Alpha' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Asset Beta' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Font Alpha' })).not.toBeChecked();
  });

  it('calls POST with assetType "asset" when an asset is associated', async () => {
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Asset Beta' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Asset Beta' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/spaces/10/library'),
        { assetType: 'asset', assetId: 'ov-uuid-2' },
      );
    });
  });

  it('calls DELETE with assetType=asset query params when an asset is dissociated', async () => {
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Asset Alpha' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Asset Alpha' }));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalled();
      const deleteUrl = (apiClient.delete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(deleteUrl).toContain('/spaces/10/library');
      expect(deleteUrl).toContain('assetType=asset');
      expect(deleteUrl).toContain('assetId=ov-uuid-1');
    });
  });

  it('shows empty-state text when the global asset library is empty', async () => {
    const emptyClient = createMockApiClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (/\/spaces\/\d+\/library/.test(url)) return Promise.resolve({ asset: [], font: [] });
        if (/\/spaces($|\?)/.test(url) || url.endsWith('/spaces')) return Promise.resolve([DELEGATED_SPACE]);
        if (url.includes('/admin/asset-library')) return Promise.resolve([]);
        if (url.includes('/admin/font-library')) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
    });
    renderView(emptyClient);
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByText(/No assets in the global library yet/i)).toBeInTheDocument());
  });
});

describe('SpaceManagementView — Access tab role dropdown (P51-H)', () => {
  const GRANT = {
    userId: 42,
    user: { displayName: 'Dana', email: 'dana@example.com' },
    access_level: 'viewer',
    grantedAt: '2025-01-01',
  };

  function clientWithGrants() {
    return createMockApiClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (/\/spaces\/\d+\/access/.test(url)) return Promise.resolve([GRANT]);
        if (/\/spaces($|\?)/.test(url) || url.endsWith('/spaces')) return Promise.resolve([DELEGATED_SPACE]);
        return Promise.resolve([]);
      }),
    });
  }

  beforeEach(() => vi.clearAllMocks());

  it('renders the grant role as an editable dropdown reflecting the current level', async () => {
    const apiClient = clientWithGrants();
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Access');

    const input = await screen.findByLabelText('Role for Dana', { selector: 'input' });
    expect((input as HTMLInputElement).value).toMatch(/viewer/i);
  });

  it('POSTs the new access_level to the space /access endpoint on change', async () => {
    const apiClient = clientWithGrants();
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Access');

    const input = await screen.findByLabelText('Role for Dana', { selector: 'input' });
    fireEvent.click(input);
    fireEvent.click(screen.getByRole('option', { name: 'Owner' }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/wp-json/wp-super-gallery/v1/spaces/10/access',
        { userId: 42, access_level: 'owner' },
      );
    });
  });

  it('does not POST when the same role is re-selected', async () => {
    const apiClient = clientWithGrants();
    renderView(apiClient);
    await selectSpace('Delegated Space');
    await clickTab('Access');

    const input = await screen.findByLabelText('Role for Dana', { selector: 'input' });
    fireEvent.click(input);
    fireEvent.click(screen.getByRole('option', { name: 'Viewer' }));

    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
