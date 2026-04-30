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

    expect(result.current.formState.galleryOverrides?.mode).toBe('per-type');
    expect(result.current.formState.galleryOverrides?.breakpoints?.desktop?.image?.adapterId).toBe('masonry');
    expect(result.current.formState).not.toHaveProperty('imageAdapterId');
    expect(result.current.formState).not.toHaveProperty('videoAdapterId');
  });

  it('leaves galleryOverrides undefined when opening a campaign without nested overrides', async () => {
    const { result } = renderHook(() => useUnifiedCampaignModal({
      apiClient: makeApiClient(),
      isAdmin: true,
      onMutate: vi.fn().mockResolvedValue(undefined),
      onNotify: vi.fn(),
    }));

    await act(async () => {
      await result.current.openForEdit(makeCampaign());
    });

    expect(result.current.formState.galleryOverrides).toBeUndefined();
  });

  it('sends only nested galleryOverrides in the save payload', async () => {
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

    const payload = put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('imageAdapterId');
    expect(payload).not.toHaveProperty('videoAdapterId');
  });

  it('omits flat adapter ids when saving breakpoint-specific nested per-type overrides', async () => {
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

    const payload = put.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('imageAdapterId');
    expect(payload).not.toHaveProperty('videoAdapterId');
  });

  it('notifies when campaign creation fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('Create failed'));
    const onNotify = vi.fn();
    const { result } = renderHook(() => useUnifiedCampaignModal({
      apiClient: makeApiClient({ post }),
      isAdmin: true,
      onMutate: vi.fn().mockResolvedValue(undefined),
      onNotify,
    }));

    act(() => {
      result.current.openForCreate();
      result.current.updateForm({
        ...result.current.formState,
        title: 'New Campaign',
      });
    });

    await act(async () => {
      await result.current.save();
    });

    expect(post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns',
      expect.objectContaining({ title: 'New Campaign' }),
    );
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: 'Create failed' }),
    );
    expect(result.current.opened).toBe(true);
  });
});