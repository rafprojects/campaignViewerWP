import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExternalMediaModal } from './useExternalMediaModal';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign } from '@/types';

// ── Module mocks ─────────────────────────────────────────────────────────────

const mockUploadMany = vi.fn();
const mockResetProgress = vi.fn();

vi.mock('./useXhrUpload', () => ({
  useXhrUpload: () => ({
    uploadMany: mockUploadMany,
    isUploading: false,
    batchProgress: null,
    resetProgress: mockResetProgress,
  }),
}));

vi.mock('@/services/settingsQuery', () => ({
  useGetSettings: vi.fn(() => ({ data: { maxBatchUploadSize: 20 } })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue(undefined),
    getBaseUrl: () => 'https://example.test',
    getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
    addCampaignMediaBatch: vi.fn().mockResolvedValue({ success: [], failed: [] }),
    ...overrides,
  } as unknown as ApiClient;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return { id: 'camp-1', videos: [], images: [], ...overrides } as unknown as Campaign;
}

function makeImageFile(name: string): File {
  return new File(['content'], name, { type: 'image/jpeg' });
}

const baseOptions = {
  isAdmin: true,
  onMutate: vi.fn().mockResolvedValue(undefined),
  onNotify: vi.fn(),
};

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useExternalMediaModal', () => {
  describe('handleSelectFiles (setSelectedFiles)', () => {
    it('filters out non-image/video files and notifies', () => {
      const onNotify = vi.fn();
      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient: makeApiClient(), ...baseOptions, onNotify }),
      );

      const imageFile = makeImageFile('photo.jpg');
      const docFile = new File(['doc'], 'document.pdf', { type: 'application/pdf' });

      act(() => {
        result.current.setSelectedFiles([imageFile, docFile]);
      });

      expect(result.current.selectedFiles).toHaveLength(1);
      expect(result.current.selectedFiles[0]).toBe(imageFile);
      expect(onNotify).toHaveBeenCalledWith({
        type: 'error',
        text: 'Only image and video files can be uploaded.',
      });
    });

    it('enforces maxBatchUploadSize and notifies', () => {
      const onNotify = vi.fn();
      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient: makeApiClient(), ...baseOptions, onNotify }),
      );

      const files = Array.from({ length: 21 }, (_, i) => makeImageFile(`file${i}.jpg`));

      act(() => {
        result.current.setSelectedFiles(files);
      });

      expect(result.current.selectedFiles).toHaveLength(20);
      expect(onNotify).toHaveBeenCalledWith({
        type: 'error',
        text: 'Only the first 20 files were kept.',
      });
    });
  });

  describe('fetchExternalPreview', () => {
    it('rejects http:// URLs and sets externalMediaError', async () => {
      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient: makeApiClient(), ...baseOptions }),
      );

      act(() => {
        result.current.setExternalMediaUrl('http://example.com/video.mp4');
      });

      await act(async () => {
        await result.current.fetchExternalPreview();
      });

      expect(result.current.externalMediaError).toBe('Please enter a valid https URL.');
    });

    it('fetches oEmbed for https:// URLs and updates preview state', async () => {
      const oEmbedResponse = {
        type: 'video',
        title: 'Test Video',
        provider_name: 'YouTube',
        thumbnail_url: 'https://thumb.example.com/img.jpg',
      };
      const apiClient = makeApiClient({
        get: vi.fn().mockResolvedValue(oEmbedResponse),
      });

      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient, ...baseOptions }),
      );

      act(() => {
        result.current.setExternalMediaUrl('https://youtube.com/watch?v=abc');
      });

      await act(async () => {
        await result.current.fetchExternalPreview();
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/oembed?url='),
      );
      expect(result.current.externalMediaPreview).toEqual(oEmbedResponse);
      expect(result.current.externalMediaError).toBeNull();
    });
  });

  describe('confirmAddExternalMedia', () => {
    it('rejects http:// URL, sets error and notifies', async () => {
      const onNotify = vi.fn();
      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient: makeApiClient(), ...baseOptions, onNotify }),
      );

      act(() => {
        result.current.handleAddExternalMedia(makeCampaign());
        result.current.setExternalMediaUrl('http://example.com/video.mp4');
      });

      await act(async () => {
        await result.current.confirmAddExternalMedia();
      });

      expect(result.current.externalMediaError).toBe('Please enter a valid https URL.');
      expect(onNotify).toHaveBeenCalledWith({
        type: 'error',
        text: 'Please enter a valid https URL.',
      });
    });
  });

  describe('confirmUploadMedia', () => {
    it('leaves failed files in selectedFiles with their errors on partial upload failure', async () => {
      const file1 = makeImageFile('success.jpg');
      const file2 = makeImageFile('fail.jpg');

      mockUploadMany.mockResolvedValue({
        results: [
          { success: true, attachmentId: 1, url: 'https://example.com/success.jpg', thumbnail: null },
          { success: false, error: 'File too large.' },
        ],
      });

      const apiClient = makeApiClient({
        getAuthHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer token' }),
        addCampaignMediaBatch: vi.fn().mockResolvedValue({ success: [{ id: 1 }], failed: [] }),
      });

      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient, ...baseOptions }),
      );

      act(() => {
        result.current.handleAddExternalMedia(makeCampaign());
        result.current.setSelectedFiles([file1, file2]);
      });

      await act(async () => {
        await result.current.confirmUploadMedia();
      });

      // Failed file stays in modal; succeeded file was added to campaign
      expect(result.current.selectedFiles).toHaveLength(1);
      expect(result.current.selectedFiles[0]).toBe(file2);
      expect(result.current.uploadErrors).toEqual(['File too large.']);
    });
  });

  describe('closeExternalMediaModal', () => {
    it('resets all state', () => {
      const { result } = renderHook(() =>
        useExternalMediaModal({ apiClient: makeApiClient(), ...baseOptions }),
      );

      const campaign = makeCampaign();

      act(() => {
        result.current.handleAddExternalMedia(campaign);
        result.current.setSelectedFiles([makeImageFile('test.jpg')]);
        result.current.setExternalMediaUrl('https://example.com');
      });

      expect(result.current.externalMediaCampaign).toBe(campaign);
      expect(result.current.selectedFiles).toHaveLength(1);
      expect(result.current.externalMediaUrl).toBe('https://example.com');

      act(() => {
        result.current.closeExternalMediaModal();
      });

      expect(result.current.externalMediaCampaign).toBeNull();
      expect(result.current.selectedFiles).toHaveLength(0);
      expect(result.current.externalMediaUrl).toBe('');
      expect(result.current.externalMediaError).toBeNull();
      expect(result.current.externalMediaPreview).toBeNull();
    });
  });
});
