import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInContextSave } from './useInContextSave';
import { createTestQueryClient } from '@/services/queryClient';
import { getSettingsQueryKey, normalizeSettingsResponse } from '@/services/settingsQuery';
import type { ApiClient } from '@/services/apiClient';
import type { GalleryBehaviorSettings } from '@/types';

function makeApiClient() {
  const getSettings = vi.fn().mockResolvedValue({ theme: 'nord' });
  const updateSettings = vi.fn().mockImplementation(async (s: unknown) => s);
  const client = {
    getBaseUrl: () => 'https://example.test',
    getSettings,
    updateSettings,
  } as unknown as ApiClient;
  return { client, getSettings, updateSettings };
}

const baseSettings = { theme: 'nord' } as GalleryBehaviorSettings;

function makeWrapper(client: ApiClient) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    getSettingsQueryKey(client),
    normalizeSettingsResponse({ theme: 'nord' }),
  );
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

describe('useInContextSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('immediately updates the query cache on save', () => {
    const { client } = makeApiClient();
    const { queryClient, wrapper } = makeWrapper(client);

    const { result } = renderHook(
      () => useInContextSave(client, baseSettings),
      { wrapper },
    );

    act(() => {
      result.current('theme', 'dark');
    });

    expect(queryClient.getQueryData(getSettingsQueryKey(client))).toMatchObject({ theme: 'dark' });
  });

  it('calls updateSettings with the saved field after the debounce delay', async () => {
    const { client, updateSettings } = makeApiClient();
    const { wrapper } = makeWrapper(client);

    const { result } = renderHook(
      () => useInContextSave(client, baseSettings),
      { wrapper },
    );

    act(() => {
      result.current('theme', 'dark');
    });

    expect(updateSettings).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateSettings).toHaveBeenCalledOnce();
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('coalesces multiple saves within the debounce window into one call', async () => {
    const { client, updateSettings } = makeApiClient();
    const { wrapper } = makeWrapper(client);

    const { result } = renderHook(
      () => useInContextSave(client, baseSettings),
      { wrapper },
    );

    act(() => {
      result.current('theme', 'dark');
      result.current('showGalleryTitle', true);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateSettings).toHaveBeenCalledOnce();
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark', showGalleryTitle: true });
  });

  it('calls getSettings to rollback cache when updateSettings fails', async () => {
    const getSettings = vi.fn().mockResolvedValue({ theme: 'nord' });
    const updateSettings = vi.fn().mockRejectedValue(new Error('Server error'));
    const client = {
      getBaseUrl: () => 'https://example.test',
      getSettings,
      updateSettings,
    } as unknown as ApiClient;
    const { wrapper } = makeWrapper(client);

    const { result } = renderHook(
      () => useInContextSave(client, baseSettings),
      { wrapper },
    );

    act(() => {
      result.current('theme', 'dark');
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateSettings).toHaveBeenCalledOnce();
    expect(getSettings).toHaveBeenCalledOnce();
  });

  it('preserves optimistic value when both updateSettings and getSettings fail', async () => {
    const getSettings = vi.fn().mockRejectedValue(new Error('Network error'));
    const updateSettings = vi.fn().mockRejectedValue(new Error('Server error'));
    const client = {
      getBaseUrl: () => 'https://example.test',
      getSettings,
      updateSettings,
    } as unknown as ApiClient;

    // gcTime: Infinity prevents the fake-timer GC from flushing the cache entry
    // between the optimistic write and the assertion.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    queryClient.setQueryData(
      getSettingsQueryKey(client),
      normalizeSettingsResponse({ theme: 'nord' }),
    );
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result } = renderHook(
      () => useInContextSave(client, baseSettings),
      { wrapper },
    );

    act(() => {
      result.current('theme', 'dark');
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateSettings).toHaveBeenCalledOnce();
    expect(getSettings).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(getSettingsQueryKey(client))).toMatchObject({ theme: 'dark' });
  });

  it('clears pending timer on unmount — updateSettings is not called after unmount', async () => {
    const { client, updateSettings } = makeApiClient();
    const { wrapper } = makeWrapper(client);

    const { result, unmount } = renderHook(
      () => useInContextSave(client, baseSettings),
      { wrapper },
    );

    act(() => {
      result.current('theme', 'dark');
    });

    unmount();

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(updateSettings).not.toHaveBeenCalled();
  });

  describe('onError callback (P45-A4)', () => {
    it('calls onError with the caught error when updateSettings fails', async () => {
      const updateSettings = vi.fn().mockRejectedValue(new Error('Server error'));
      const getSettings = vi.fn().mockResolvedValue({ theme: 'nord' });
      const client = {
        getBaseUrl: () => 'https://example.test',
        getSettings,
        updateSettings,
      } as unknown as ApiClient;
      const { wrapper } = makeWrapper(client);
      const onError = vi.fn();

      const { result } = renderHook(
        () => useInContextSave(client, baseSettings, 500, onError),
        { wrapper },
      );

      act(() => {
        result.current('theme', 'dark');
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('does not call onError when updateSettings succeeds', async () => {
      const { client } = makeApiClient();
      const { wrapper } = makeWrapper(client);
      const onError = vi.fn();

      const { result } = renderHook(
        () => useInContextSave(client, baseSettings, 500, onError),
        { wrapper },
      );

      act(() => {
        result.current('theme', 'dark');
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(onError).not.toHaveBeenCalled();
    });

    it('does not throw when onError is omitted and updateSettings fails', async () => {
      const updateSettings = vi.fn().mockRejectedValue(new Error('Server error'));
      const client = {
        getBaseUrl: () => 'https://example.test',
        getSettings: vi.fn().mockResolvedValue({ theme: 'nord' }),
        updateSettings,
      } as unknown as ApiClient;
      const { wrapper } = makeWrapper(client);

      const { result } = renderHook(
        () => useInContextSave(client, baseSettings),
        { wrapper },
      );

      act(() => {
        result.current('theme', 'dark');
      });

      await expect(
        act(async () => {
          await vi.runAllTimersAsync();
        }),
      ).resolves.toBeUndefined();
    });
  });
});
