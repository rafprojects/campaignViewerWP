/**
 * Branch-coverage tests for the adminQuery react-query hooks (hand-authored).
 * Complements adminQuery.test.tsx; focuses on enabled-gating, the campaign
 * filter/pagination branches, analytics polling, and empty/error fallbacks.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@/services/apiClient';
import { createTestQueryClient } from '@/services/queryClient';
import {
  useSpaces,
  useAdminCampaigns,
  useAllCampaignOptions,
  useAccessGrants,
  useCompanies,
  useAllCompanies,
  useMediaItems,
  useCampaignCategories,
  useCampaignTags,
  useMediaTags,
  useCampaignAnalytics,
  useCampaignMediaAnalytics,
  useAnalyticsSummary,
  useAccessSummary,
  useAccessRequests,
} from './adminQuery';

function makeApi(over: Partial<Record<string, unknown>> = {}): ApiClient {
  return {
    getBaseUrl: vi.fn().mockReturnValue('test'),
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    listCampaignCategories: vi.fn().mockResolvedValue([{ id: 'c1', name: 'Cat' }]),
    listCampaignTags: vi.fn().mockResolvedValue([{ id: 't1', name: 'Tag' }]),
    listMediaTags: vi.fn().mockResolvedValue([{ id: 'm1', name: 'MTag' }]),
    getCampaignAnalytics: vi.fn().mockResolvedValue({ totalViews: 1 }),
    getCampaignMediaAnalytics: vi.fn().mockResolvedValue({ items: [] }),
    getAnalyticsSummary: vi.fn().mockResolvedValue({ totalViews: 2 }),
    getAccessSummary: vi.fn().mockResolvedValue({ items: [] }),
    listAccessRequests: vi.fn().mockResolvedValue([{ token: 'a' }]),
    ...over,
  } as unknown as ApiClient;
}

function wrapper() {
  return function W({ children }: { children: ReactNode }) {
    const [qc] = useState(createTestQueryClient);
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useSpaces', () => {
  it('returns spaces from an array response', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue([{ id: 1 }]) });
    const { result } = renderHook(() => useSpaces(api), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.spaces).toHaveLength(1));
    expect(api.get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/spaces');
  });
  it('coerces a non-array response to an empty list', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue({ not: 'array' }) });
    const { result } = renderHook(() => useSpaces(api), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.spacesLoading).toBe(false));
    expect(result.current.spaces).toEqual([]);
  });
});

describe('useAdminCampaigns', () => {
  it('builds the query string from a scoped filter set', async () => {
    const get = vi.fn().mockResolvedValue({ items: [{ id: '1' }], page: 1, perPage: 20, total: 1, totalPages: 1 });
    const api = makeApi({ get });
    const { result } = renderHook(
      () => useAdminCampaigns(api, '3', 2, 20, { category: 'c', tag: 't', sort: 'title_asc', includeArchived: true, templateId: 'tpl' }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.campaigns).toHaveLength(1));
    const url = (get.mock.calls[0]![0]) as string;
    expect(url).toContain('space=3');
    expect(url).toContain('category=c');
    expect(url).toContain('tag=t');
    expect(url).toContain('sort=title_asc');
    expect(url).toContain('include_archived=true');
    expect(url).toContain('template_id=tpl');
  });

  it('surfaces an Error message on failure', async () => {
    const api = makeApi({ get: vi.fn().mockRejectedValue(new Error('nope')) });
    const { result } = renderHook(() => useAdminCampaigns(api), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.campaignsError).toBe('nope'));
    expect(result.current.pagination.totalPages).toBe(1);
  });
});

describe('useAllCampaignOptions', () => {
  it('walks pagination and concatenates pages', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: '1' }], totalPages: 2, page: 1 })
      .mockResolvedValueOnce({ items: [{ id: '2' }], totalPages: 2, page: 2 });
    const api = makeApi({ get });
    const { result } = renderHook(() => useAllCampaignOptions(api, 'all'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current).toHaveLength(2));
  });
  it('does not fetch when disabled', async () => {
    const get = vi.fn().mockResolvedValue({ items: [] });
    const api = makeApi({ get });
    renderHook(() => useAllCampaignOptions(api, 'all', false), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(get).not.toHaveBeenCalled();
  });
});

describe('enabled-gated hooks do not fetch without a target', () => {
  it('useAccessGrants is disabled with an empty targetId', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue([]) });
    const { result } = renderHook(() => useAccessGrants(api, 'campaign', ''), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.accessEntries).toEqual([]);
  });
  it('useMediaItems is disabled with an empty campaignId', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue([]) });
    renderHook(() => useMediaItems(api, ''), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.get).not.toHaveBeenCalled();
  });
  it('useCampaignAnalytics is disabled without a campaign', async () => {
    const api = makeApi();
    renderHook(() => useCampaignAnalytics(api, null, 'f', 't'), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.getCampaignAnalytics).not.toHaveBeenCalled();
  });
  it('useAccessRequests is disabled without a campaign', async () => {
    const api = makeApi();
    renderHook(() => useAccessRequests(api, ''), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.listAccessRequests).not.toHaveBeenCalled();
  });
});

describe('companies', () => {
  it('useCompanies fetches when enabled', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue({ items: [{ id: 1 }], totalPages: 1 }) });
    const { result } = renderHook(() => useCompanies(api, 'all', true), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.companiesLoading).toBe(false));
  });
  it('useAllCompanies walks multiple pages', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 1 }], totalPages: 2 })
      .mockResolvedValueOnce({ items: [{ id: 2 }] });
    const api = makeApi({ get });
    const { result } = renderHook(() => useAllCompanies(api, '4'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.companies).toHaveLength(2));
    expect((get.mock.calls[0]![0] as string)).toContain('space=4');
  });
});

describe('simple list hooks resolve data', () => {
  it('categories / tags / media-tags', async () => {
    const api = makeApi();
    const cats = renderHook(() => useCampaignCategories(api), { wrapper: wrapper() });
    const ctags = renderHook(() => useCampaignTags(api), { wrapper: wrapper() });
    const mtags = renderHook(() => useMediaTags(api), { wrapper: wrapper() });
    await waitFor(() => expect(cats.result.current.campaignCategories).toHaveLength(1));
    await waitFor(() => expect(ctags.result.current.campaignTags).toHaveLength(1));
    await waitFor(() => expect(mtags.result.current.mediaTags).toHaveLength(1));
  });
  it('disabled list hooks do not call the api', async () => {
    const api = makeApi();
    renderHook(() => useCampaignCategories(api, false), { wrapper: wrapper() });
    renderHook(() => useCampaignTags(api, false), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.listCampaignCategories).not.toHaveBeenCalled();
    expect(api.listCampaignTags).not.toHaveBeenCalled();
  });
});

describe('analytics hooks (incl. polling branch)', () => {
  it('campaign analytics fetches and supports the polling-active branch', async () => {
    const api = makeApi();
    const { result } = renderHook(
      () => useCampaignAnalytics(api, '7', 'f', 't', { enabled: true, intervalMs: 1000 }),
      { wrapper: wrapper() },
    );
    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(api.getCampaignAnalytics).toHaveBeenCalledWith('7', 'f', 't');
  });
  it('media analytics + summary fetch', async () => {
    const api = makeApi();
    const m = renderHook(() => useCampaignMediaAnalytics(api, '7', 'f', 't', { enabled: false }), { wrapper: wrapper() });
    const s = renderHook(() => useAnalyticsSummary(api, 'all', 'f', 't', true, { enabled: true }), { wrapper: wrapper() });
    await waitFor(() => expect(m.result.current.data).toBeTruthy());
    await waitFor(() => expect(s.result.current.data).toBeTruthy());
  });
  it('summary is disabled when enabled=false', async () => {
    const api = makeApi();
    renderHook(() => useAnalyticsSummary(api, 'all', 'f', 't', false), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(api.getAnalyticsSummary).not.toHaveBeenCalled();
  });
  it('access summary fetches when enabled and is gated otherwise', async () => {
    const api = makeApi();
    const on = renderHook(() => useAccessSummary(api, 1, 50, true), { wrapper: wrapper() });
    await waitFor(() => expect(on.result.current.data).toBeTruthy());
    const off = makeApi();
    renderHook(() => useAccessSummary(off, 1, 50, false), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 20));
    expect(off.getAccessSummary).not.toHaveBeenCalled();
  });
});
