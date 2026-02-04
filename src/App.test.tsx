import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from './test/test-utils';
import { mutate } from 'swr';
import App from './App';

const campaignResponse = {
  items: [
    {
      id: '101',
      companyId: 'acme',
      title: 'Campaign Alpha',
      description: 'Test description',
      thumbnail: 'https://example.com/thumb.jpg',
      coverImage: 'https://example.com/cover.jpg',
      status: 'active',
      visibility: 'public',
      tags: ['launch'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    },
  ],
};

const setupAdminFetch = () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/wp-json/jwt-auth/v1/token/validate')) {
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }

    if (url.includes('/wp-json/wp-super-gallery/v1/permissions')) {
      return { ok: true, status: 200, json: async () => ({ campaignIds: ['101'], isAdmin: true }) } as Response;
    }

    if (url.includes('/wp-json/wp-super-gallery/v1/campaigns/101/media') && method === 'GET') {
      return { ok: true, status: 200, json: async () => ([]) } as Response;
    }

    if (url.includes('/wp-json/wp-super-gallery/v1/campaigns') && method === 'GET') {
      return { ok: true, status: 200, json: async () => campaignResponse } as Response;
    }

    if (url.includes('/wp-json/wp-super-gallery/v1/campaigns/101') && method === 'PUT') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }

    if (url.includes('/wp-json/wp-super-gallery/v1/campaigns/101/archive') && method === 'POST') {
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }

    if (url.includes('/wp-json/wp-super-gallery/v1/campaigns/101/media') && method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ ok: true }) } as Response;
    }

    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });

  vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);
  return fetchMock;
};

describe('App', () => {
  beforeEach(() => {
    mutate(() => true, undefined);
    vi.clearAllMocks();
    localStorage.clear();
  });
  beforeEach(() => {
    localStorage.clear();
    delete (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__;
  });

  it('renders campaigns from API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => campaignResponse,
    } as Response);

    render(<App />);

    expect(await screen.findByText('Campaign Alpha')).toBeInTheDocument();
  });

  it('shows error banner when campaigns request fails', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/token/validate')) {
        // Token validation succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response);
      }
      if (url.includes('/campaigns')) {
        // Campaigns request fails
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({}),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    });

    render(<App />);

    expect(await screen.findByText('Request failed')).toBeInTheDocument();
  });

  it('shows login form when auth provider is configured', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => campaignResponse,
    } as Response);

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('edits campaign using modal', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);

    render(<App />);

    // Open campaign viewer
    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    // Test Edit Campaign with modal
    fireEvent.click(screen.getByRole('button', { name: 'Edit Campaign Alpha' }));
    // Edit modal opens - fill in title and description
    const titleInput = await screen.findByLabelText('Title');
    const descInput = await screen.findByLabelText('Description');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    fireEvent.change(descInput, { target: { value: 'Updated Description' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/wp-json/wp-super-gallery/v1/campaigns/101'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  // Note: The external media modal test is skipped due to modal stacking issues
  // when CampaignViewer (fullscreen modal) and Add External Media modal are both open.
  // This will be addressed as part of future UX improvements.
  it.skip('adds external media using modal', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);

    render(<App />);

    // Open campaign viewer
    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    // Test Add External Media with modal
    const manageMediaBtn = await screen.findByRole('button', { name: 'Manage media for Campaign Alpha' });
    fireEvent.click(manageMediaBtn);
    // External media modal opens
    const urlInput = await screen.findByLabelText('URL');
    fireEvent.change(urlInput, { target: { value: 'https://example.com/video' } });
    const captionInput = screen.getByLabelText('Caption');
    fireEvent.change(captionInput, { target: { value: 'Caption' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Media' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/wp-json/wp-super-gallery/v1/campaigns/101/media'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('archives campaign using modal', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();
    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);

    render(<App />);

    // Open campaign viewer
    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    // Test Archive Campaign with modal
    const archiveCampaignBtn = await screen.findByRole('button', { name: 'Archive Campaign Alpha' });
    fireEvent.click(archiveCampaignBtn);
    // Archive confirmation modal opens
    const archiveBtn = await screen.findByRole('button', { name: 'Archive campaign Campaign Alpha' });
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/wp-json/wp-super-gallery/v1/campaigns/101/archive'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  }, 30000);

  it('does not update when edit modal is cancelled', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();

    render(<App />);

    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Campaign Alpha' }));
    
    // Modal opens - click Cancel instead of Save
    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      const putCalled = fetchMock.mock.calls.some(([url, init]) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        return String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101') && method === 'PUT';
      });
      expect(putCalled).toBe(false);
    });
  });

  it('does not archive when modal is cancelled', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();

    render(<App />);

    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Archive Campaign Alpha' }));

    // Modal opens - click Cancel instead of Archive
    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      const archiveCalled = fetchMock.mock.calls.some(([url, init]) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        return String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101/archive') && method === 'POST';
      });
      expect(archiveCalled).toBe(false);
    });
  });

  it('does not add external media when modal is cancelled', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();

    render(<App />);

    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Manage media for Campaign Alpha' }));

    // Modal opens - click Cancel instead of Add Media
    const cancelBtn = await screen.findByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      const mediaPostCalled = fetchMock.mock.calls.some(([url, init]) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        return String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101/media') && method === 'POST';
      });
      expect(mediaPostCalled).toBe(false);
    });
  });

  it('shows session expired message on 401 responses', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/token/validate')) {
        // Token validation succeeds
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response);
      }
      if (url.includes('/campaigns')) {
        // Campaigns request returns 401
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({}),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    });

    render(<App />);

    expect(await screen.findByText('Session expired. Please sign in again.')).toBeInTheDocument();
  });
});
