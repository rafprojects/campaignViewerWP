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

const OVERLAY_A = { id: 'ov-uuid-1', url: 'https://ex.com/ov1.png', name: 'Overlay Alpha', uploadedAt: '2025-01-01' };
const OVERLAY_B = { id: 'ov-uuid-2', url: 'https://ex.com/ov2.png', name: 'Overlay Beta', uploadedAt: '2025-01-01' };
const FONT_A = { id: 'fo-uuid-1', url: 'https://ex.com/fa.woff2', name: 'Font Alpha', filename: 'fa.woff2', format: 'woff2', uploadedAt: '2025-01-01' };

function createMockApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  const get = vi.fn().mockImplementation((url: string) => {
    if (/\/spaces\/\d+\/library/.test(url)) {
      return Promise.resolve({ overlay: ['ov-uuid-1'], font: [] });
    }
    if (/\/spaces\/\d+\/access/.test(url)) {
      return Promise.resolve([]);
    }
    if (/\/spaces($|\?)/.test(url) || url.endsWith('/spaces')) {
      return Promise.resolve([DELEGATED_SPACE, OPEN_SPACE]);
    }
    if (url.includes('/admin/overlay-library')) {
      return Promise.resolve([OVERLAY_A, OVERLAY_B]);
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

describe('SpaceManagementView — Library tab', () => {
  let apiClient: ReturnType<typeof createMockApiClient>;
  const onNotify = vi.fn();
  const onSpacesChanged = vi.fn();

  beforeEach(() => {
    apiClient = createMockApiClient();
    vi.clearAllMocks();
  });

  it('Library tab is disabled when no space is selected', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Library' })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('data-disabled', 'true');
  });

  it('Library tab is disabled for open-mode spaces', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Open Space');
    expect(screen.getByRole('tab', { name: 'Library' })).toHaveAttribute('data-disabled', 'true');
  });

  it('Library tab is enabled for delegated spaces', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Delegated Space');
    expect(screen.getByRole('tab', { name: 'Library' })).not.toHaveAttribute('data-disabled', 'true');
  });

  it('shows overlay and font checkboxes after selecting Library tab', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => {
      expect(screen.getByLabelText('Overlay Alpha')).toBeInTheDocument();
      expect(screen.getByLabelText('Overlay Beta')).toBeInTheDocument();
      expect(screen.getByLabelText('Font Alpha')).toBeInTheDocument();
    });
  });

  it('reflects current associations — associated overlay is checked', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByLabelText('Overlay Alpha')).toBeInTheDocument());

    // ov-uuid-1 is in the associations list → checked
    expect(screen.getByLabelText('Overlay Alpha')).toBeChecked();
    // ov-uuid-2 is not → unchecked
    expect(screen.getByLabelText('Overlay Beta')).not.toBeChecked();
    // font is not associated → unchecked
    expect(screen.getByLabelText('Font Alpha')).not.toBeChecked();
  });

  it('calls POST when an asset is checked', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByLabelText('Overlay Beta')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Overlay Beta'));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/spaces/10/library'),
        { assetType: 'overlay', assetId: 'ov-uuid-2' },
      );
    });
  });

  it('calls DELETE with query params when an asset is unchecked', async () => {
    render(
      <SpaceManagementView
        apiClient={apiClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => expect(screen.getByLabelText('Overlay Alpha')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('Overlay Alpha'));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith(
        expect.stringContaining('/spaces/10/library'),
      );
      const deleteUrl = (apiClient.delete as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(deleteUrl).toContain('assetType=overlay');
      expect(deleteUrl).toContain('assetId=ov-uuid-1');
    });
  });

  it('shows empty-state text when global library has no overlays', async () => {
    const emptyClient = createMockApiClient({
      get: vi.fn().mockImplementation((url: string) => {
        if (/\/spaces\/\d+\/library/.test(url)) return Promise.resolve({ overlay: [], font: [] });
        if (/\/spaces($|\?)/.test(url) || url.endsWith('/spaces')) return Promise.resolve([DELEGATED_SPACE]);
        if (url.includes('/admin/overlay-library')) return Promise.resolve([]);
        if (url.includes('/admin/font-library')) return Promise.resolve([]);
        return Promise.resolve([]);
      }),
    });

    render(
      <SpaceManagementView
        apiClient={emptyClient}
        onNotify={onNotify}
        onSpacesChanged={onSpacesChanged}
      />,
    );
    await selectSpace('Delegated Space');
    await clickTab('Library');

    await waitFor(() => {
      expect(screen.getByText('No overlays in the global library.')).toBeInTheDocument();
      expect(screen.getByText('No fonts in the global library.')).toBeInTheDocument();
    });
  });
});
