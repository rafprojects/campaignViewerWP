/**
 * Tests for useLayoutBuilderAssets — covers async upload/delete/update
 * branches (success, error, optional onNotify callback).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLayoutBuilderAssets } from './useLayoutBuilderAssets';
import type { ApiClient } from '@/services/apiClient';
import type { UseLayoutBuilderReturn } from './useLayoutBuilderState';

// ── Stubs ─────────────────────────────────────────────────────────────────

vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

function makeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    postForm: vi.fn().mockResolvedValue({ url: 'https://cdn/img.png' }),
    delete: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as ApiClient;
}

function makeBuilder(): UseLayoutBuilderReturn {
  return {
    addOverlay: vi.fn(),
    setBackgroundImage: vi.fn(),
    template: { name: 'test', slots: [], overlays: [] },
  } as unknown as UseLayoutBuilderReturn;
}

function makeHook(apiOverrides?: Partial<ApiClient>, onNotify?: jest.Mock) {
  const apiClient = makeApi(apiOverrides);
  const refetchAssetLibrary = vi.fn().mockResolvedValue(undefined);
  const builder = makeBuilder();
  const announce = vi.fn();
  const { result } = renderHook(() =>
    useLayoutBuilderAssets({ apiClient, refetchAssetLibrary, builder, announce, onNotify }),
  );
  return { result, apiClient, refetchAssetLibrary, builder, announce, onNotify };
}

// ── handleUploadAsset ─────────────────────────────────────────────────────

describe('handleUploadAsset', () => {
  it('is a no-op when file is null', async () => {
    const { result, apiClient } = makeHook();
    await act(async () => result.current.handleUploadAsset(null));
    expect(apiClient.postForm).not.toHaveBeenCalled();
  });

  it('uploads file, refetches library and adds overlay on success', async () => {
    const { result, apiClient, refetchAssetLibrary, builder } = makeHook();
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await act(async () => result.current.handleUploadAsset(file));
    expect(apiClient.postForm).toHaveBeenCalled();
    expect(refetchAssetLibrary).toHaveBeenCalled();
    expect(builder.addOverlay).toHaveBeenCalledWith('https://cdn/img.png');
    expect(result.current.isUploadingAsset).toBe(false);
  });

  it('calls onNotify with error on upload failure', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook(
      { postForm: vi.fn().mockRejectedValue(new Error('Network error')) },
      onNotify,
    );
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await act(async () => result.current.handleUploadAsset(file));
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(result.current.isUploadingAsset).toBe(false);
  });

  it('uses generic message when error is not an Error instance', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook({ postForm: vi.fn().mockRejectedValue('string error') }, onNotify);
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await act(async () => result.current.handleUploadAsset(file));
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Overlay upload failed' }),
    );
  });
});

// ── handleDeleteLibraryAsset ───────────────────────────────────────────────

describe('handleDeleteLibraryAsset', () => {
  it('deletes asset and refetches library', async () => {
    const { result, apiClient, refetchAssetLibrary } = makeHook();
    await act(async () => result.current.handleDeleteLibraryAsset('asset-1'));
    expect(apiClient.delete).toHaveBeenCalled();
    expect(refetchAssetLibrary).toHaveBeenCalled();
  });

  it('calls onNotify on delete failure', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook(
      { delete: vi.fn().mockRejectedValue(new Error('Delete failed')) },
      onNotify,
    );
    await act(async () => result.current.handleDeleteLibraryAsset('asset-1'));
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('uses generic message when delete error is not an Error instance', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook({ delete: vi.fn().mockRejectedValue('oops') }, onNotify);
    await act(async () => result.current.handleDeleteLibraryAsset('asset-1'));
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'Failed to delete overlay' }),
    );
  });
});

// ── handleSetAssetUniversal ───────────────────────────────────────────────

describe('handleSetAssetUniversal', () => {
  it('posts universal flag and refetches', async () => {
    const { result, apiClient, refetchAssetLibrary } = makeHook();
    await act(async () => result.current.handleSetAssetUniversal('a1', true));
    expect(apiClient.post).toHaveBeenCalled();
    expect(refetchAssetLibrary).toHaveBeenCalled();
  });

  it('calls onNotify on failure', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook({ post: vi.fn().mockRejectedValue(new Error('err')) }, onNotify);
    await act(async () => result.current.handleSetAssetUniversal('a1', false));
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

// ── handleSetAssetTags ────────────────────────────────────────────────────

describe('handleSetAssetTags', () => {
  it('posts tags and refetches', async () => {
    const { result, apiClient, refetchAssetLibrary } = makeHook();
    await act(async () => result.current.handleSetAssetTags('a1', ['hero', 'bg']));
    expect(apiClient.post).toHaveBeenCalled();
    expect(refetchAssetLibrary).toHaveBeenCalled();
  });

  it('calls onNotify on failure', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook({ post: vi.fn().mockRejectedValue(new Error('err')) }, onNotify);
    await act(async () => result.current.handleSetAssetTags('a1', ['tag']));
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

// ── handleUploadBgImage ───────────────────────────────────────────────────

describe('handleUploadBgImage', () => {
  it('is a no-op when file is null', async () => {
    const { result, apiClient } = makeHook();
    await act(async () => result.current.handleUploadBgImage(null));
    expect(apiClient.postForm).not.toHaveBeenCalled();
  });

  it('uploads bg image and calls setBackgroundImage on success', async () => {
    const { result, builder } = makeHook();
    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });
    await act(async () => result.current.handleUploadBgImage(file));
    expect(builder.setBackgroundImage).toHaveBeenCalledWith('https://cdn/img.png');
    expect(result.current.isUploadingBg).toBe(false);
  });

  it('calls onNotify with error on bg upload failure', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook(
      { postForm: vi.fn().mockRejectedValue(new Error('Upload error')) },
      onNotify,
    );
    const file = new File(['x'], 'bg.jpg', { type: 'image/jpeg' });
    await act(async () => result.current.handleUploadBgImage(file));
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(result.current.isUploadingBg).toBe(false);
  });
});

// ── handleUploadMask ──────────────────────────────────────────────────────

describe('handleUploadMask', () => {
  it('uploads mask and returns the url on success', async () => {
    const { result } = makeHook();
    const file = new File(['x'], 'mask.png', { type: 'image/png' });
    let url: string | null = null;
    await act(async () => { url = await result.current.handleUploadMask(file); });
    expect(url).toBe('https://cdn/img.png');
  });

  it('calls onNotify and returns null on failure', async () => {
    const onNotify = vi.fn();
    const { result } = makeHook(
      { postForm: vi.fn().mockRejectedValue(new Error('Mask error')) },
      onNotify,
    );
    const file = new File(['x'], 'mask.png', { type: 'image/png' });
    let url: string | null = 'sentinel';
    await act(async () => { url = await result.current.handleUploadMask(file); });
    expect(url).toBeNull();
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});
