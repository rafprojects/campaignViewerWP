import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from './test/test-utils';
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

  // [P68-A] Regression: a listing that spans more than one server page
  // (>10 campaigns pre-fix silently showed only the first 10) must page
  // through all of them and render campaigns from beyond page 1.
  it('pages through all campaigns when the listing spans multiple pages', async () => {
    const makeCampaign = (id: string, title: string) => ({
      id,
      companyId: 'acme',
      title,
      description: 'Test description',
      thumbnail: 'https://example.com/thumb.jpg',
      coverImage: 'https://example.com/cover.jpg',
      status: 'active',
      visibility: 'public',
      tags: ['launch'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/wp-json/wp-super-gallery/v1/campaigns?include_media=1') && method === 'GET') {
        const pageMatch = url.match(/[?&]page=(\d+)/);
        const page = pageMatch ? Number(pageMatch[1]) : 1;
        const items =
          page === 1
            ? [makeCampaign('101', 'Campaign Page One')]
            : [makeCampaign('202', 'Campaign Page Two')];
        return {
          ok: true,
          status: 200,
          json: async () => ({ items, total: 2, totalPages: 2 }),
        } as Response;
      }

      return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);

    render(<App />);

    // Both a page-1 and a page-2 campaign render — the fix pages past page 1.
    expect(await screen.findByText('Campaign Page One')).toBeInTheDocument();
    expect(await screen.findByText('Campaign Page Two')).toBeInTheDocument();

    // Exactly two campaign-list requests were made (page 1 and page 2).
    const listCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('/wp-json/wp-super-gallery/v1/campaigns?include_media=1'),
    );
    expect(listCalls).toHaveLength(2);
    expect(String(listCalls[0][0])).toContain('page=1');
    expect(String(listCalls[1][0])).toContain('page=2');
  });

  // [P71-A] The campaigns query relies solely on React Query's
  // `refetchOnReconnect: true`; the old manual `isOnline && isReady` effect that
  // called `refetch()` was removed. `refetchOnReconnect` respects `staleTime`
  // (it skips a still-fresh query), whereas the manual effect's `refetch()` was
  // an UNCONDITIONAL refetch that fired on every offline→online transition. So a
  // reconnect while the just-loaded (fresh, staleTime 5s) query is still valid
  // must produce NO additional campaign-list request post-fix; pre-fix the
  // manual effect forced one.
  it('does not refetch the fresh campaign list on reconnect (no manual forced refetch) [P71-A]', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? 'GET').toUpperCase();

      if (url.includes('/wp-json/wp-super-gallery/v1/campaigns?include_media=1') && method === 'GET') {
        return {
          ok: true,
          status: 200,
          json: async () => campaignResponse,
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(fetchMock as typeof fetch);

    render(<App />);

    expect(await screen.findByText('Campaign Alpha')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const listCallCount = () =>
      fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('/wp-json/wp-super-gallery/v1/campaigns?include_media=1'),
      ).length;

    const afterLoad = listCallCount();
    expect(afterLoad).toBe(1);

    // Simulate a genuine reconnect (offline → online). Both React Query's
    // onlineManager and useOnlineStatus listen to these window events. The two
    // transitions must be committed separately, otherwise React batches
    // false→true back into "no change" and useOnlineStatus never re-fires.
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // The query is still fresh (staleTime 5s hasn't elapsed), so
    // refetchOnReconnect skips it and no extra request fires. Pre-fix, the
    // manual effect's unconditional refetch() bumped this to 2.
    expect(listCallCount()).toBe(afterLoad);
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
