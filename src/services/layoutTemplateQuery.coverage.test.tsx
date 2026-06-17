/**
 * Branch-coverage for layoutTemplateQuery key builders + query fallbacks.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { ApiClient } from '@/services/apiClient';
import { createTestQueryClient } from '@/services/queryClient';
import {
  getAssetLibraryQueryKey,
  getLayoutTemplatesQueryKey,
  useLayoutTemplates,
  useAssetLibrary,
} from './layoutTemplateQuery';

const api = (over: Record<string, unknown> = {}) =>
  ({ getBaseUrl: () => 'base', get: vi.fn().mockResolvedValue(undefined), getLayoutTemplates: vi.fn().mockResolvedValue(undefined), ...over }) as unknown as ApiClient;

function wrapper() {
  return function W({ children }: { children: ReactNode }) {
    const [qc] = useState(createTestQueryClient);
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('query keys', () => {
  it('scopes the asset-library key to a real space and to "all" otherwise', () => {
    expect(getAssetLibraryQueryKey(api(), '5')).toContain('5');
    expect(getAssetLibraryQueryKey(api(), 'all')).toContain('all');
    expect(getAssetLibraryQueryKey(api())).toContain('all');
    expect(getLayoutTemplatesQueryKey(api())).toContain('admin-list');
  });
});

describe('query fallbacks', () => {
  it('useLayoutTemplates falls back to [] when the api returns undefined', async () => {
    const { result } = renderHook(() => useLayoutTemplates(api()), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('useAssetLibrary uses the scoped path and falls back to []', async () => {
    const get = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAssetLibrary(api({ get }), true, '7'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
    expect(get).toHaveBeenCalledWith(expect.stringContaining('space=7'));
  });

  it('useAssetLibrary uses the unscoped path for "all"', async () => {
    const get = vi.fn().mockResolvedValue([{ id: 'a1' }]);
    const { result } = renderHook(() => useAssetLibrary(api({ get }), true, 'all'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith('/wp-json/wp-super-gallery/v1/admin/asset-library');
  });
});
