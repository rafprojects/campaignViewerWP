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
});