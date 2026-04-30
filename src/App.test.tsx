import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from './test/test-utils';
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

describe('App', () => {
  beforeEach(() => {
    mutate(() => true, undefined);
    vi.clearAllMocks();
    localStorage.clear();
    delete (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__;
    delete window.__WPSG_CONFIG__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    delete (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__;
    delete window.__WPSG_CONFIG__;
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
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/token/validate')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response);
      }
      if (url.includes('/campaigns')) {
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

  it('shows compact sign-in trigger when auth provider is configured', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => campaignResponse,
    } as Response);

    render(<App />);

    const menuBtn = await screen.findByRole('button', { name: 'Admin menu' });
    fireEvent.click(menuBtn);

    expect(await screen.findByText('Sign in to access private campaigns.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows offline banner when browser is offline', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => campaignResponse,
    } as Response);

    render(<App />);

    expect(await screen.findByText('You appear to be offline. Some features are unavailable.')).toBeInTheDocument();

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('uses first campaign media thumbnail when campaign thumbnail is missing', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/wp-json/jwt-auth/v1/token/validate')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
      }

      if (url.includes('/wp-json/wp-super-gallery/v1/permissions')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ campaignIds: ['101'], isAdmin: true }),
        } as Response);
      }

      if (url.includes('/wp-json/wp-super-gallery/v1/campaigns?include_media=1') && method === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: '101',
                companyId: 'acme',
                title: 'Campaign Alpha',
                description: 'Test description',
                thumbnail: '',
                coverImage: '',
                status: 'active',
                visibility: 'public',
                tags: ['launch'],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
              },
            ],
            mediaByCampaign: {
              '101': [
                {
                  id: 'm1',
                  type: 'image',
                  source: 'upload',
                  url: 'https://example.com/image-original.jpg',
                  thumbnail: 'https://example.com/image-thumb.jpg',
                  caption: 'Representative media',
                  order: 1,
                },
              ],
            },
          }),
        } as Response);
      }

      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });

    render(<App />);

    const campaignImage = await screen.findByAltText('Campaign Alpha');
    expect(campaignImage).toHaveAttribute('src', expect.stringContaining('image-thumb.jpg'));
  });

  it('uses campaigns include_media response without per-campaign media fetches', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/wp-json/wp-super-gallery/v1/campaigns?include_media=1') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: '101',
                companyId: 'acme',
                title: 'Campaign Alpha',
                description: 'Test description',
                thumbnail: '',
                coverImage: '',
                status: 'active',
                visibility: 'public',
                tags: ['launch'],
                createdAt: '2026-01-01T00:00:00.000Z',
                updatedAt: '2026-01-02T00:00:00.000Z',
              },
            ],
            mediaByCampaign: {
              '101': [
                {
                  id: 'm1',
                  type: 'image',
                  source: 'upload',
                  url: 'https://example.com/image-original.jpg',
                  thumbnail: 'https://example.com/image-thumb.jpg',
                  caption: 'Bulk media',
                  order: 1,
                },
              ],
            },
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);

    render(<App />);

    expect(await screen.findByText('Campaign Alpha')).toBeInTheDocument();

    const calledPerCampaignMedia = fetchMock.mock.calls.some(([url]) =>
      String(url).includes('/wp-json/wp-super-gallery/v1/campaigns/101/media'),
    );
    expect(calledPerCampaignMedia).toBe(false);
  });

  it('shows session expired message on 401 responses', async () => {
    (window as Window & { __WPSG_AUTH_PROVIDER__?: string }).__WPSG_AUTH_PROVIDER__ = 'wp-jwt';
    localStorage.setItem('wpsg_access_token', 'token');
    localStorage.setItem('wpsg_user', JSON.stringify({ id: '1', email: 'admin@example.com', role: 'admin' }));

    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('/token/validate')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        } as Response);
      }
      if (url.includes('/campaigns')) {
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
