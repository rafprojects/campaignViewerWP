import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/services/apiClient';
import { createTestQueryClient } from '@/services/queryClient';

import { useAuditEntries } from './adminQuery';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as unknown as ApiClient;
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
});