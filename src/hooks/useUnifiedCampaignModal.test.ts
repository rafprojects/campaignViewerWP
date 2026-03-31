import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ApiClient } from '@/services/apiClient';
import type { Campaign } from '@/types';

import { useUnifiedCampaignModal } from './useUnifiedCampaignModal';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: '1' }),
    put: vi.fn().mockResolvedValue({ id: '1' }),
    delete: vi.fn().mockResolvedValue(undefined),
    postForm: vi.fn().mockResolvedValue({ url: '', thumbnail: '' }),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    getBaseUrl: vi.fn().mockReturnValue('https://example.com'),
    ...overrides,
  } as unknown as ApiClient;
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: '1',
    companyId: 'acme',
    company: {
      id: 'acme',
      name: 'Acme',
      logo: '',
      brandColor: '#000000',
    },
    title: 'Campaign',
    description: '',
    thumbnail: '',
    coverImage: '',
    videos: [],
    images: [],
    tags: [],
    status: 'active',
    visibility: 'private',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('useUnifiedCampaignModal', () => {
  it('prefers nested galleryOverrides when opening a campaign for edit', async () => {
    const { result } = renderHook(() => useUnifiedCampaignModal({
      apiClient: makeApiClient(),
      isAdmin: true,
      onMutate: vi.fn().mockResolvedValue(undefined),
      onNotify: vi.fn(),
    }));

    await act(async () => {
      await result.current.openForEdit(makeCampaign({
        imageAdapterId: '',
        videoAdapterId: '',
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' }, video: { adapterId: 'diamond' } },
            tablet: { image: { adapterId: 'masonry' }, video: { adapterId: 'diamond' } },
            mobile: { image: { adapterId: 'masonry' }, video: { adapterId: 'diamond' } },
          },
        },
      }));
    });

    expect(result.current.formState.imageAdapterId).toBe('masonry');
    expect(result.current.formState.videoAdapterId).toBe('diamond');
    expect(result.current.formState.galleryOverrides?.mode).toBe('per-type');
    expect(result.current.formState.galleryOverrides?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
  });

  it('normalizes legacy bridge adapter ids from unified nested overrides when opening a campaign', async () => {
    const { result } = renderHook(() => useUnifiedCampaignModal({
      apiClient: makeApiClient(),
      isAdmin: true,
      onMutate: vi.fn().mockResolvedValue(undefined),
      onNotify: vi.fn(),
    }));

    await act(async () => {
      await result.current.openForEdit(makeCampaign({
        imageAdapterId: 'masonry',
        videoAdapterId: 'diamond',
        galleryOverrides: {
          mode: 'unified',
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: { unified: { adapterId: 'classic' } },
            mobile: { unified: { adapterId: 'classic' } },
          },
        },
      }));
    });

    expect(result.current.formState.imageAdapterId).toBe('classic');
    expect(result.current.formState.videoAdapterId).toBe('classic');
    expect(result.current.formState.galleryOverrides?.mode).toBe('unified');
  });

  it('sends galleryOverrides in the save payload', async () => {
    const put = vi.fn().mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useUnifiedCampaignModal({
      apiClient: makeApiClient({ put }),
      isAdmin: true,
      onMutate: vi.fn().mockResolvedValue(undefined),
      onNotify: vi.fn(),
    }));

    await act(async () => {
      await result.current.openForEdit(makeCampaign());
    });

    act(() => {
      result.current.updateForm({
        ...result.current.formState,
        imageAdapterId: 'justified',
        videoAdapterId: 'diamond',
        galleryOverrides: {
          mode: 'unified',
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: { unified: { adapterId: 'classic' } },
            mobile: { unified: { adapterId: 'classic' } },
          },
        },
      });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(put).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/1',
      expect.objectContaining({
        imageAdapterId: 'classic',
        videoAdapterId: 'classic',
        galleryOverrides: {
          mode: 'unified',
          breakpoints: {
            desktop: { unified: { adapterId: 'classic' } },
            tablet: { unified: { adapterId: 'classic' } },
            mobile: { unified: { adapterId: 'classic' } },
          },
        },
      }),
    );
  });

  it('clears stale flat adapter ids when saving breakpoint-specific nested per-type overrides', async () => {
    const put = vi.fn().mockResolvedValue({ id: '1' });
    const { result } = renderHook(() => useUnifiedCampaignModal({
      apiClient: makeApiClient({ put }),
      isAdmin: true,
      onMutate: vi.fn().mockResolvedValue(undefined),
      onNotify: vi.fn(),
    }));

    await act(async () => {
      await result.current.openForEdit(makeCampaign());
    });

    act(() => {
      result.current.updateForm({
        ...result.current.formState,
        imageAdapterId: 'masonry',
        videoAdapterId: 'diamond',
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' } },
            tablet: { image: { adapterId: 'justified' } },
            mobile: { video: { adapterId: 'diamond' } },
          },
        },
      });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(put).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/1',
      expect.objectContaining({
        imageAdapterId: '',
        videoAdapterId: '',
        galleryOverrides: {
          mode: 'per-type',
          breakpoints: {
            desktop: { image: { adapterId: 'masonry' } },
            tablet: { image: { adapterId: 'justified' } },
            mobile: { video: { adapterId: 'diamond' } },
          },
        },
      }),
    );
  });
});