/**
 * Tests for useMediaCrud — covers the uncovered branch at line 89
 * (rescan returns no updates) and other key paths.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaCrud } from './useMediaCrud';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));

function makeItem(id = 'm1'): MediaItem {
  return { id, type: 'image', source: 'upload', url: `/${id}.jpg`, order: 1 };
}

function makeHook(apiOverrides: Partial<ApiClient> = {}) {
  const setMedia = vi.fn();
  const mutateMedia = vi.fn().mockResolvedValue(undefined);
  const queryClient = { setQueryData: vi.fn() } as unknown as QueryClient;
  const apiClient = {
    delete: vi.fn().mockResolvedValue({}),
    patch: vi.fn().mockResolvedValue(makeItem()),
    post: vi.fn().mockResolvedValue({ updated: 0, total: 5, message: 'ok' }),
    getBaseUrl: () => 'https://test',
    ...apiOverrides,
  } as unknown as ApiClient;
  const { result } = renderHook(() =>
    useMediaCrud({ apiClient, campaignId: 'c1', setMedia, queryClient, mutateMedia }),
  );
  return { result, apiClient, setMedia, mutateMedia };
}

describe('useMediaCrud — handleRescanTypes', () => {
  it('shows "all correct" message when no items were updated (line 89 else branch)', async () => {
    const { showNotification } = await import('@mantine/notifications');
    const { result } = makeHook({ post: vi.fn().mockResolvedValue({ updated: 0, total: 5, message: 'ok' }) });
    await act(async () => result.current.handleRescanTypes());
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'All media types are correct.' }),
    );
    expect(result.current.rescanning).toBe(false);
  });

  it('shows update count and calls mutateMedia when items were updated', async () => {
    const { showNotification } = await import('@mantine/notifications');
    const mutateMedia = vi.fn().mockResolvedValue(undefined);
    const setMedia = vi.fn();
    const apiClient = {
      post: vi.fn().mockResolvedValue({ updated: 3, total: 10, message: 'ok' }),
      getBaseUrl: () => 'https://test',
    } as unknown as ApiClient;
    const { result } = renderHook(() =>
      useMediaCrud({ apiClient, campaignId: 'c1', setMedia, queryClient: { setQueryData: vi.fn() } as unknown as QueryClient, mutateMedia }),
    );
    await act(async () => result.current.handleRescanTypes());
    expect(mutateMedia).toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('3 of 10') }),
    );
  });

  it('shows error notification when rescan throws', async () => {
    const { showNotification } = await import('@mantine/notifications');
    const { result } = makeHook({ post: vi.fn().mockRejectedValue(new Error('rescan failed')) });
    await act(async () => result.current.handleRescanTypes());
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rescan failed' }));
    expect(result.current.rescanning).toBe(false);
  });
});

describe('useMediaCrud — handleDelete and confirmDelete', () => {
  it('confirmDelete is a no-op when deleteItem is null', async () => {
    const { result, apiClient } = makeHook();
    await act(async () => result.current.confirmDelete());
    expect(apiClient.delete).not.toHaveBeenCalled();
  });

  it('handleDelete sets the deleteItem', async () => {
    const { result } = makeHook();
    const item = makeItem();
    await act(async () => result.current.handleDelete(item));
    expect(result.current.deleteItem).toEqual(item);
  });
});
