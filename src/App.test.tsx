import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from './test/test-utils';
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
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

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

  it('executes admin actions with prompts', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      // Handle login request
      if (url.includes('/wp-json/jwt-auth/v1/token') && method === 'POST') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            token: 'mock-jwt-token',
            user_id: '1',
            user_email: 'admin@example.com',
          }),
        } as Response;
      }

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
    vi.spyOn(window, 'prompt')
      .mockImplementationOnce(() => 'Updated Title')
      .mockImplementationOnce(() => 'Updated Description')
      .mockImplementationOnce(() => 'video')
      .mockImplementationOnce(() => 'https://example.com/video')
      .mockImplementationOnce(() => 'Caption')
      .mockImplementationOnce(() => 'https://example.com/thumb.jpg');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<App />);

    // Wait for login form to appear
    const emailInput = await screen.findByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/password/i);
    const signInButton = screen.getByRole('button', { name: /sign in/i });

    // Perform login
    fireEvent.change(emailInput, { target: { value: 'admin@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password' } });
    fireEvent.click(signInButton);

    // Wait for campaigns to load and click on the card
    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    // Now perform admin actions
    fireEvent.click(screen.getByRole('button', { name: 'Edit Campaign' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage Media' }));
    fireEvent.click(screen.getByRole('button', { name: 'Archive Campaign' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/wp-json/wp-super-gallery/v1/campaigns/101'),
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/wp-json/wp-super-gallery/v1/campaigns/101/archive'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/wp-json/wp-super-gallery/v1/campaigns/101/media'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  }, 30000);

  it('does not update when edit prompt is cancelled', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();
    vi.spyOn(window, 'prompt').mockImplementationOnce(() => null);

    render(<App />);

    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Campaign' }));

    await waitFor(() => {
      const putCalled = fetchMock.mock.calls.some(([url, init]) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        return String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101') && method === 'PUT';
      });
      expect(putCalled).toBe(false);
    });
  });

  it('does not archive when confirm is cancelled', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<App />);

    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Archive Campaign' }));

    await waitFor(() => {
      const archiveCalled = fetchMock.mock.calls.some(([url, init]) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        return String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101/archive') && method === 'POST';
      });
      expect(archiveCalled).toBe(false);
    });
  });

  it('skips adding external media when type or url is invalid', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    const fetchMock = setupAdminFetch();
    vi.spyOn(window, 'prompt')
      .mockImplementationOnce(() => 'audio')
      .mockImplementationOnce(() => 'video')
      .mockImplementationOnce(() => null);

    render(<App />);

    const card = await screen.findByText('Campaign Alpha');
    fireEvent.click(card);

    fireEvent.click(screen.getByRole('button', { name: 'Manage Media' }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage Media' }));

    await waitFor(() => {
      const mediaPostCalled = fetchMock.mock.calls.some(([url, init]) => {
        const method = (init?.method ?? 'GET').toUpperCase();
        return String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101/media') && method === 'POST';
      });
      expect(mediaPostCalled).toBe(false);
    });
  });

  it('shows session expired message on 401 responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    } as Response);

    render(<App />);

    expect(await screen.findByText('Session expired. Please sign in again.')).toBeInTheDocument();
  });
});
