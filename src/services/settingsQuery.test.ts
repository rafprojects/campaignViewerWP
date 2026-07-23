import { createElement, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient, SettingsUpdateRequest } from '@/services/apiClient';
import { createTestQueryClient } from './queryClient';
import {
  getSettingsQueryKey,
  normalizeSettingsResponse,
  useGetSettings,
  useUpdateSettings,
} from './settingsQuery';

function createMockApiClient() {
  const getSettings = vi.fn(async () => ({
    appMaxWidth: 1440,
    theme: 'nord',
    typographyOverrides: JSON.stringify({
      viewerTitle: {
        fontFamily: 'Merriweather',
        fontWeight: 700,
      },
    }),
  }));

  const updateSettings = vi.fn(async (settings: SettingsUpdateRequest) => ({
    ...settings,
    appMaxWidth: 960,
    theme: 'github-light',
  }));

  const client = {
    getBaseUrl: () => 'https://example.test',
    getSettings,
    updateSettings,
  } as unknown as ApiClient;

  return { client, getSettings, updateSettings };
}

describe('settingsQuery', () => {
  it('normalizes partial settings responses into full gallery behavior settings', () => {
    const normalized = normalizeSettingsResponse({
      appMaxWidth: 1200,
      theme: 'nord',
    });

    expect(normalized.appMaxWidth).toBe(1200);
    expect(normalized.theme).toBe('nord');
    expect(normalized.appPadding).toBeDefined();
  });

  it('fetches and caches normalized settings', async () => {
    const { client, getSettings } = createMockApiClient();
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      createElement(QueryClientProvider, { client: queryClient }, children)
    );

    const { result } = renderHook(() => useGetSettings(client), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.theme).toBe('nord');
    });

    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(result.current.data?.typographyOverrides.viewerTitle?.fontFamily).toBe('Merriweather');
    expect(queryClient.getQueryData(getSettingsQueryKey(client))).toEqual(result.current.data);
  });

  it('updates cached settings after mutation success', async () => {
    const { client, updateSettings } = createMockApiClient();
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      createElement(QueryClientProvider, { client: queryClient }, children)
    );

    const { result } = renderHook(() => useUpdateSettings(client), { wrapper });

    await result.current.mutateAsync({ appMaxWidth: 960, theme: 'github-light' });

    expect(updateSettings).toHaveBeenCalledWith({ appMaxWidth: 960, theme: 'github-light' });
    expect(queryClient.getQueryData(getSettingsQueryKey(client))).toMatchObject({
      appMaxWidth: 960,
      theme: 'github-light',
    });
  });

  it('does not refetch the just-written settings after a successful save [P71-B]', async () => {
    const { client, getSettings, updateSettings } = createMockApiClient();
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      createElement(QueryClientProvider, { client: queryClient }, children)
    );

    // Mount an active settings observer alongside the mutation so a stray
    // invalidation would produce an observable refetch (invalidateQueries only
    // refetches queries with active observers).
    const { result } = renderHook(
      () => ({ get: useGetSettings(client), update: useUpdateSettings(client) }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.get.data?.theme).toBe('nord'));
    expect(getSettings).toHaveBeenCalledTimes(1);

    // Saving writes the canonical response into the cache via setSettingsQueryData.
    // Pre-fix, onSuccess also invalidated the ['settings'] prefix — which matches
    // the just-written entry — scheduling a redundant refetch. Post-fix it must not.
    await result.current.update.mutateAsync({ appMaxWidth: 960, theme: 'github-light' });

    // Give any erroneously-scheduled refetch a tick to fire.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(updateSettings).toHaveBeenCalledTimes(1);
    // Still exactly one — the initial fetch, with no post-save refetch.
    expect(getSettings).toHaveBeenCalledTimes(1);
    // The cache holds the saved values (which a refetch would have clobbered back
    // to the mock's 'nord'/1440 defaults).
    expect(queryClient.getQueryData(getSettingsQueryKey(client))).toMatchObject({
      appMaxWidth: 960,
      theme: 'github-light',
    });
  });
});

describe('settingsQuery space scoping (P47)', () => {
  it('keys global vs per-space distinctly so caches never collide', () => {
    const { client } = createMockApiClient();
    const globalKey = getSettingsQueryKey(client);
    const spaceA = getSettingsQueryKey(client, 1);
    const spaceB = getSettingsQueryKey(client, 2);

    expect(globalKey).not.toEqual(spaceA);
    expect(spaceA).not.toEqual(spaceB);
    expect(globalKey[globalKey.length - 1]).toBeNull();
    expect(spaceA[spaceA.length - 1]).toBe(1);
  });

  it('forwards spaceId to the API and caches under the space-scoped key only', async () => {
    const { client, getSettings } = createMockApiClient();
    const queryClient = createTestQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      createElement(QueryClientProvider, { client: queryClient }, children)
    );

    const { result } = renderHook(() => useGetSettings(client, 7), { wrapper });

    await waitFor(() => {
      expect(result.current.data?.theme).toBe('nord');
    });

    expect(getSettings).toHaveBeenCalledWith(7);
    expect(queryClient.getQueryData(getSettingsQueryKey(client, 7))).toEqual(result.current.data);
    // The global cache entry must stay empty — space instances don't share it.
    expect(queryClient.getQueryData(getSettingsQueryKey(client))).toBeUndefined();
  });
});