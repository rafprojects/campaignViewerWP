/**
 * Coverage tests for useMediaUpload — targets handleUpload, handleNearDupUseExisting,
 * and handleNearDupUploadAnyway branches (lines 128-229, 237-310).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaUpload } from './useMediaUpload';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

// ── Mantine mock ───────────────────────────────────────────────────────────
vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));

// ── useXhrUpload mock ──────────────────────────────────────────────────────
const uploadManyMock = vi.hoisted(() => vi.fn());
const uploadMock = vi.hoisted(() => vi.fn());
const resetProgressMock = vi.hoisted(() => vi.fn());

vi.mock('@wp-super-gallery/shared-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@wp-super-gallery/shared-utils')>();
  return {
    ...actual,
    useXhrUpload: () => ({
      upload: uploadMock,
      uploadMany: uploadManyMock,
      batchProgress: [],
      isUploading: false,
      resetProgress: resetProgressMock,
    }),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────

function makeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['x'], name, { type });
}

function makeItem(id = 'm1'): MediaItem {
  return { id, type: 'image', source: 'upload', url: `/${id}.jpg`, order: 1 };
}

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    getBaseUrl: () => 'https://test',
    addCampaignMediaBatch: vi.fn().mockResolvedValue({ added: [makeItem()], failed: [] }),
    ...overrides,
  } as unknown as ApiClient;
}

const mockQueryClient = { setQueryData: vi.fn() } as unknown as QueryClient;

function makeHook(media: MediaItem[] = [], apiOverrides: Partial<ApiClient> = {}) {
  const setMedia = vi.fn();
  const setAddOpen = vi.fn();
  const apiClient = makeApiClient(apiOverrides);
  const { result } = renderHook(() =>
    useMediaUpload({
      apiClient,
      campaignId: 'c1',
      maxBatchUploadSize: 10,
      media,
      setMedia,
      queryClient: mockQueryClient,
      setAddOpen,
    }),
  );
  return { result, apiClient, setMedia, setAddOpen };
}

beforeEach(() => {
  uploadManyMock.mockClear();
  uploadMock.mockClear();
  resetProgressMock.mockClear();
});

// ── handleUpload ───────────────────────────────────────────────────────────

describe('handleUpload — empty selection no-op', () => {
  it('is a no-op when no files are selected', async () => {
    const { result } = makeHook();
    await act(async () => result.current.handleUpload());
    expect(uploadManyMock).not.toHaveBeenCalled();
  });
});

describe('handleUpload — all files succeed', () => {
  it('adds media and clears selection on success', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{ success: true, attachmentId: 1, url: 'https://cdn/img.jpg', thumbnail: undefined }],
    });
    const { result, setMedia, setAddOpen } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(setMedia).toHaveBeenCalled();
    expect(setAddOpen).toHaveBeenCalledWith(false);
    expect(resetProgressMock).toHaveBeenCalled();
  });

  it('handles video file type correctly (non-image type branch)', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{ success: true, attachmentId: 2, url: 'https://cdn/v.mp4' }],
    });
    const { result, setMedia } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile('video.mp4', 'video/mp4')));
    await act(async () => result.current.handleUpload());
    expect(setMedia).toHaveBeenCalled();
  });
});

describe('handleUpload — upload failure', () => {
  it('keeps failed files selected with their errors', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{ success: false, near_duplicate: false, duplicate: false, error: 'Too large' }],
    });
    const { result, setMedia } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile('big.jpg')));
    await act(async () => result.current.handleUpload());
    expect(setMedia).not.toHaveBeenCalled(); // no media added
    expect(result.current.uploadErrors).toEqual(['Too large']);
  });

  it('formats duplicate error with campaign info (camps.length=1 branch)', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{
        success: false,
        near_duplicate: false,
        duplicate: true,
        existing_name: 'photo.jpg',
        existing_campaigns: [{ id: 1, title: 'Campaign A' }],
      }],
    });
    const { result } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(result.current.uploadErrors[0]).toContain('Campaign A');
  });

  it('formats duplicate error with no campaigns (camps.length=0 branch)', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{
        success: false,
        near_duplicate: false,
        duplicate: true,
        existing_name: 'photo.jpg',
        existing_campaigns: [],
      }],
    });
    const { result } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(result.current.uploadErrors[0]).toContain("Already uploaded as 'photo.jpg'");
  });

  it('formats duplicate error with multiple campaigns (camps.length>1 branch)', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{
        success: false,
        near_duplicate: false,
        duplicate: true,
        existing_name: 'photo.jpg',
        existing_campaigns: [{ id: 1, title: 'A' }, { id: 2, title: 'B' }],
      }],
    });
    const { result } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(result.current.uploadErrors[0]).toContain('2 campaigns');
  });
});

describe('handleUpload — near duplicate', () => {
  it('queues near-duplicate entries (line 203-204)', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{
        success: false,
        near_duplicate: true,
        similar_id: 99,
        similar_url: 'https://cdn/similar.jpg',
        distance: 0.1,
        similar_name: 'similar.jpg',
        similar_campaigns: [],
      }],
    });
    const { result } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(result.current.pendingNearDuplicates).toHaveLength(1);
  });
});

describe('handleUpload — upload throws', () => {
  it('shows error notification on exception', async () => {
    const { showNotification } = await import('@mantine/notifications');
    uploadManyMock.mockRejectedValue(new Error('Network error'));
    const { result } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Upload failed' }));
    expect(resetProgressMock).toHaveBeenCalled();
  });
});

describe('handleUpload — batchItems empty (all uploads failed, none successful)', () => {
  it('does not call addCampaignMediaBatch when no files were successful', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{ success: false, near_duplicate: false, error: 'fail' }],
    });
    const { result, apiClient } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    expect(apiClient.addCampaignMediaBatch).not.toHaveBeenCalled();
  });
});

// ── handleNearDupUseExisting ──────────────────────────────────────────────

describe('handleNearDupUseExisting', () => {
  it('is a no-op when no pending near-duplicates', async () => {
    const { result, apiClient } = makeHook();
    await act(async () => result.current.handleNearDupUseExisting());
    expect(apiClient.addCampaignMediaBatch).not.toHaveBeenCalled();
  });

  it('adds the similar image when batch succeeds with added items', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{ success: false, near_duplicate: true, similar_id: 42, similar_url: 'https://cdn/s.jpg', distance: 0.1, similar_name: 'similar.jpg', similar_campaigns: [] }],
    });
    const { result, setMedia } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    // Now there's 1 pending near-dup
    expect(result.current.pendingNearDuplicates).toHaveLength(1);
    await act(async () => result.current.handleNearDupUseExisting());
    expect(setMedia).toHaveBeenCalled();
  });

  it('shows error notification when addCampaignMediaBatch fails', async () => {
    const { showNotification } = await import('@mantine/notifications');
    uploadManyMock.mockResolvedValue({
      results: [{ success: false, near_duplicate: true, similar_id: 42, similar_url: 'https://cdn/s.jpg', distance: 0.1, similar_name: 'similar.jpg', similar_campaigns: [] }],
    });
    const { result } = makeHook([], {
      addCampaignMediaBatch: vi.fn().mockRejectedValue(new Error('batch fail')),
    });
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    await act(async () => result.current.handleNearDupUseExisting());
    expect(showNotification).toHaveBeenCalledWith(expect.objectContaining({ title: 'Failed to add image' }));
  });
});

// ── handleNearDupUploadAnyway ──────────────────────────────────────────────

describe('handleNearDupUploadAnyway', () => {
  it('is a no-op when no pending near-duplicates', async () => {
    const { result } = makeHook();
    await act(async () => result.current.handleNearDupUploadAnyway());
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('uploads the near-dup file with force flag and adds it', async () => {
    uploadManyMock.mockResolvedValue({
      results: [{ success: false, near_duplicate: true, similar_id: 42, similar_url: 'https://cdn/s.jpg', distance: 0.1, similar_name: 'similar.jpg', similar_campaigns: [] }],
    });
    uploadMock.mockResolvedValue({ attachmentId: 10, url: 'https://cdn/forced.jpg' });
    const { result, setMedia } = makeHook();
    act(() => result.current.handleSelectFiles(makeFile()));
    await act(async () => result.current.handleUpload());
    await act(async () => result.current.handleNearDupUploadAnyway());
    expect(uploadMock).toHaveBeenCalled();
    expect(setMedia).toHaveBeenCalled();
  });
});
