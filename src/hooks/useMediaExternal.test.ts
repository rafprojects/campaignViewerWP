/**
 * Tests for useMediaExternal — covers 3 uncovered branches:
 * line 14 (image URL detection), line 25 (invalid URL), line 96 (no oEmbed data).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaExternal } from './useMediaExternal';
import type { ApiClient } from '@/services/apiClient';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    post: vi.fn().mockResolvedValue({ id: 'm1', type: 'image', source: 'external', url: 'https://ex.com/img.jpg', order: 1 }),
    get: vi.fn().mockResolvedValue({ title: 'Preview', provider_name: 'YouTube', type: 'video' }),
    getBaseUrl: () => 'https://test',
    ...overrides,
  } as unknown as ApiClient;
}

const mockQueryClient = {
  setQueryData: vi.fn(),
} as unknown as QueryClient;

function makeHook(apiOverrides?: Partial<ApiClient>) {
  const setMedia = vi.fn();
  const setAddOpen = vi.fn();
  const api = makeApiClient(apiOverrides);
  const { result } = renderHook(() =>
    useMediaExternal({ apiClient: api, campaignId: 'c1', setMedia, queryClient: mockQueryClient, setAddOpen }),
  );
  return { result, api, setMedia, setAddOpen };
}

describe('useMediaExternal — getMediaTypeFromUrl (line 14)', () => {
  it('adds image media when URL contains an image extension (line 14)', async () => {
    const { result, setMedia } = makeHook();
    act(() => result.current.setExternalUrl('https://example.com/photo.jpg'));
    await act(async () => result.current.handleAddExternal());
    expect(setMedia).toHaveBeenCalled();
  });
});

describe('useMediaExternal — isValidExternalUrl false branch (line 25)', () => {
  it('shows error when URL is not a valid https URL (invalid URL path, line 25)', async () => {
    const { showNotification } = await import('@mantine/notifications');
    const { result } = makeHook();
    act(() => result.current.setExternalUrl('not-a-url'));
    await act(async () => result.current.handleAddExternal());
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Invalid URL' }));
  });

  it('sets error when URL is invalid for oEmbed fetch too', async () => {
    const { result } = makeHook();
    act(() => result.current.setExternalUrl('ftp://not-https.com/video'));
    await act(async () => result.current.handleFetchOEmbed());
    expect(result.current.externalError).toBeTruthy();
  });
});

describe('useMediaExternal — oEmbed returns null (line 96)', () => {
  it('throws and shows error when oEmbed returns null/falsy (line 96)', async () => {
    const { result } = makeHook({ get: vi.fn().mockResolvedValue(null) });
    act(() => result.current.setExternalUrl('https://example.com/video'));
    await act(async () => result.current.handleFetchOEmbed());
    expect(result.current.externalError).toBeTruthy();
    expect(result.current.externalLoading).toBe(false);
  });
});

describe('useMediaExternal — no-op when URL is empty', () => {
  it('handleAddExternal is a no-op when externalUrl is empty', async () => {
    const { result, api } = makeHook();
    await act(async () => result.current.handleAddExternal());
    expect(api.post).not.toHaveBeenCalled();
  });

  it('handleFetchOEmbed is a no-op when externalUrl is empty', async () => {
    const { result, api } = makeHook();
    await act(async () => result.current.handleFetchOEmbed());
    expect(api.get).not.toHaveBeenCalled();
  });
});
