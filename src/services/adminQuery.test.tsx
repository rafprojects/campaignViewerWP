import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/services/apiClient';
import { createTestQueryClient } from '@/services/queryClient';

import { useAuditEntries, useAllCompanies } from './adminQuery';
import type { CompanyInfo } from './adminQuery';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getBaseUrl: vi.fn().mockReturnValue('test'),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as ApiClient;
}

function makeCompany(slug: string, name: string): CompanyInfo {
  return { id: 1, name, slug, campaignCount: 0, activeCampaigns: 0, archivedCampaigns: 0, accessGrantCount: 0, campaigns: [] };
}

function makeWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(createTestQueryClient);

    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe('adminQuery', () => {
  it('loads audit entries for the selected campaign', async () => {
    const get = vi.fn().mockResolvedValue([
      { id: 'a1', action: 'updated', details: { field: 'title' }, userId: 7, createdAt: '2026-01-03T00:00:00.000Z' },
    ]);
    const apiClient = makeApiClient({ get });

    const { result } = renderHook(() => useAuditEntries(apiClient, '101'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => {
      expect(result.current.auditEntries).toHaveLength(1);
    });

    expect(get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/campaigns/101/audit');
    expect(result.current.auditEntries[0]?.action).toBe('updated');
  });

  it('does not fetch audit entries without a campaign id', () => {
    const get = vi.fn();
    const apiClient = makeApiClient({ get });

    const { result } = renderHook(() => useAuditEntries(apiClient, ''), {
      wrapper: makeWrapper(),
    });

    expect(get).not.toHaveBeenCalled();
    expect(result.current.auditEntries).toEqual([]);
  });

  it('fetches a single page of companies when totalPages is 1', async () => {
    const page1 = [makeCompany('acme', 'Acme Corp'), makeCompany('beta', 'Beta Ltd')];
    const get = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('page=1')) return Promise.resolve({ items: page1, totalPages: 1 });
      return Promise.resolve({ items: [] });
    });
    const apiClient = makeApiClient({ get });

    const { result } = renderHook(() => useAllCompanies(apiClient), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.companies).toHaveLength(2));
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/companies?per_page=100&page=1');
  });

  it('fetches all pages in parallel when totalPages > 1', async () => {
    const page1 = [makeCompany('acme', 'Acme Corp')];
    const page2 = [makeCompany('beta', 'Beta Ltd')];
    const page3 = [makeCompany('gamma', 'Gamma Inc')];
    const get = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('page=1')) return Promise.resolve({ items: page1, totalPages: 3 });
      if (url.endsWith('page=2')) return Promise.resolve({ items: page2 });
      if (url.endsWith('page=3')) return Promise.resolve({ items: page3 });
      return Promise.resolve({ items: [] });
    });
    const apiClient = makeApiClient({ get });

    const { result } = renderHook(() => useAllCompanies(apiClient), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.companies).toHaveLength(3));
    expect(get).toHaveBeenCalledTimes(3);
    expect(result.current.companies.map((c) => c.slug)).toEqual(['acme', 'beta', 'gamma']);
  });
});