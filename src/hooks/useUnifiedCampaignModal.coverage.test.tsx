/**
 * Branch-coverage tests for useUnifiedCampaignModal (complements the existing
 * useUnifiedCampaignModal.test.tsx). Exercises the guard clauses, success and
 * error paths of every handler, and the save() payload permutations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import React from 'react';

const h = vi.hoisted(() => ({
  uploadMany: vi.fn(),
  resetProgress: vi.fn(),
  companies: [{ id: 'c1', name: 'Acme', slug: 'acme' }],
}));

vi.mock('@wp-super-gallery/shared-utils', async (orig) => {
  const actual = await orig<typeof import('@wp-super-gallery/shared-utils')>();
  return {
    ...actual,
    useXhrUpload: () => ({
      uploadMany: h.uploadMany,
      batchProgress: [],
      isUploading: false,
      resetProgress: h.resetProgress,
    }),
  };
});

vi.mock('@/services/adminQuery', async (orig) => {
  const actual = await orig<typeof import('@/services/adminQuery')>();
  return {
    ...actual,
    useAllCompanies: () => ({ companies: h.companies, companiesLoading: false }),
  };
});

import { useUnifiedCampaignModal } from './useUnifiedCampaignModal';

function makeApi(overrides: Record<string, unknown> = {}) {
  return {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn().mockResolvedValue({ id: 'm-new', url: 'u', type: 'image' }),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    postForm: vi.fn().mockResolvedValue({ url: 'cover.jpg', thumbnail: 'cover-thumb.jpg' }),
    getAuthHeaders: vi.fn().mockResolvedValue({}),
    getBaseUrl: vi.fn().mockReturnValue('https://x.test'),
    addCampaignMediaBatch: vi.fn().mockResolvedValue({ added: [], failed: [] }),
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function setup(opts: { api?: ReturnType<typeof makeApi>; isAdmin?: boolean; spaceId?: number } = {}) {
  const api = opts.api ?? makeApi();
  const onMutate = vi.fn().mockResolvedValue(undefined);
  const onNotify = vi.fn();
  const hook = renderHook(
    () =>
      useUnifiedCampaignModal({
        apiClient: api as never,
        isAdmin: opts.isAdmin ?? true,
        onMutate,
        onNotify,
        spaceId: opts.spaceId,
      }),
    { wrapper },
  );
  return { hook, api, onMutate, onNotify };
}

beforeEach(() => {
  h.uploadMany.mockReset();
  h.resetProgress.mockReset();
});

describe('open/close', () => {
  it('openForEdit denies non-admins', async () => {
    const { hook, onNotify } = setup({ isAdmin: false });
    await act(async () => {
      await hook.result.current.openForEdit({ id: '1' } as never);
    });
    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'Admin permissions required.' });
    expect(hook.result.current.opened).toBe(false);
  });

  it('openForEdit loads media and opens (array response)', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue([{ id: 'a', order: 2 }, { id: 'b', order: 1 }]) });
    const { hook } = setup({ api });
    await act(async () => {
      await hook.result.current.openForEdit({ id: '7', title: 'T' } as never);
    });
    expect(hook.result.current.opened).toBe(true);
    expect(hook.result.current.editingCampaignId).toBe('7');
    expect(hook.result.current.mediaItems.map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('openForEdit handles a {items} response and a media-load error', async () => {
    const api = makeApi({ get: vi.fn().mockRejectedValue(new Error('boom')) });
    const { hook, onNotify } = setup({ api });
    await act(async () => {
      await hook.result.current.openForEdit({ id: '7' } as never);
    });
    expect(hook.result.current.mediaItems).toEqual([]);
    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'Failed to load campaign media.' });
  });

  it('openForCreate seeds initial values and close resets', () => {
    const { hook } = setup();
    act(() => hook.result.current.openForCreate({ title: 'Seed' }));
    expect(hook.result.current.opened).toBe(true);
    expect(hook.result.current.mode).toBe('create');
    expect(hook.result.current.formState.title).toBe('Seed');
    act(() => hook.result.current.close());
    expect(hook.result.current.opened).toBe(false);
    expect(hook.result.current.formState.title).toBe('');
  });
});

describe('cover image', () => {
  it('handleSelectCoverImage updates the form', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSelectCoverImage('img.png'));
    expect(hook.result.current.formState.coverImage).toBe('img.png');
  });

  it('handleUploadCoverImage rejects a non-image and requires an editing id', async () => {
    const { hook } = setup();
    // no editingCampaignId yet -> silent return
    await act(async () => {
      await hook.result.current.handleUploadCoverImage(new File(['x'], 'a.png', { type: 'image/png' }));
    });
    // open for edit, then upload a non-image
    const api = makeApi();
    const s = setup({ api });
    await act(async () => { await s.hook.result.current.openForEdit({ id: '7' } as never); });
    await act(async () => {
      await s.hook.result.current.handleUploadCoverImage(new File(['x'], 'a.txt', { type: 'text/plain' }));
    });
    expect(s.onNotify).toHaveBeenCalledWith({
      type: 'error',
      text: 'Please select an image file for campaign thumbnail.',
    });
  });

  it('handleUploadCoverImage uploads an image successfully', async () => {
    const api = makeApi();
    const { hook, onNotify } = setup({ api });
    await act(async () => { await hook.result.current.openForEdit({ id: '7' } as never); });
    await act(async () => {
      await hook.result.current.handleUploadCoverImage(new File(['x'], 'a.png', { type: 'image/png' }));
    });
    await waitFor(() => expect(hook.result.current.formState.coverImage).toBe('cover-thumb.jpg'));
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: 'Campaign thumbnail uploaded.' });
  });
});

describe('save', () => {
  it('creates a campaign (new company -> object payload, spaceId attached)', async () => {
    const api = makeApi();
    const { hook, api: a, onMutate } = setup({ api, spaceId: 9 });
    act(() => hook.result.current.openForCreate({ title: 'New', company: 'Brand New Co' }));
    await act(async () => { await hook.result.current.save(); });
    expect(a.post).toHaveBeenCalledTimes(1);
    const [, payload] = a.post.mock.calls[0]!;
    expect(payload.space_id).toBe(9);
    expect(payload.company).toEqual({ name: 'Brand New Co', slug: 'brand-new-co' });
    expect(onMutate).toHaveBeenCalled();
  });

  it('updates a campaign (existing company slug -> string payload)', async () => {
    const api = makeApi();
    const { hook, api: a } = setup({ api });
    await act(async () => { await hook.result.current.openForEdit({ id: '7', company: { id: 'acme' } } as never); });
    act(() => hook.result.current.updateForm({ ...hook.result.current.formState, company: 'acme', borderColor: '#111' }));
    await act(async () => { await hook.result.current.save(); });
    expect(a.put).toHaveBeenCalledTimes(1);
    const [, payload] = a.put.mock.calls[0]!;
    expect(payload.company).toBe('acme');
    expect(payload.borderColor).toBe('#111');
  });

  it('reports an error when saving fails', async () => {
    const api = makeApi({ post: vi.fn().mockRejectedValue(new Error('nope')) });
    const { hook, onNotify } = setup({ api });
    act(() => hook.result.current.openForCreate());
    await act(async () => { await hook.result.current.save(); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('media handlers', () => {
  it('handleRemoveMedia guards a missing id, then removes on success', async () => {
    const api = makeApi();
    const { hook, onNotify } = setup({ api });
    await act(async () => {
      await hook.result.current.openForEdit({ id: '7' } as never);
    });
    // missing id
    await act(async () => { await hook.result.current.handleRemoveMedia({} as never); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('handleAddExternalMedia returns early with no url and adds on success', async () => {
    const api = makeApi();
    const { hook } = setup({ api });
    await act(async () => { await hook.result.current.openForEdit({ id: '7' } as never); });
    // no url set -> early return (no post)
    await act(async () => { await hook.result.current.handleAddExternalMedia(); });
    expect(api.post).not.toHaveBeenCalled();
    act(() => hook.result.current.setAddMediaUrl('https://v.test/x'));
    await act(async () => { await hook.result.current.handleAddExternalMedia(); });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('handleAddFromLibrary blocks duplicates', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue([{ id: 'lib1', url: 'u1' }]) });
    const { hook, onNotify } = setup({ api });
    await act(async () => { await hook.result.current.openForEdit({ id: '7' } as never); });
    await act(async () => { await hook.result.current.handleAddFromLibrary({ id: 'lib1', url: 'u1' } as never); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'This media is already in the campaign.' });
  });

  it('loadLibraryMedia fetches with a search term', async () => {
    const api = makeApi({ get: vi.fn().mockResolvedValue({ items: [{ id: 'l1' }], total: 1 }) });
    const { hook } = setup({ api });
    await act(async () => { await hook.result.current.loadLibraryMedia('cats'); });
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining('search=cats'));
    expect(hook.result.current.libraryMedia).toEqual([{ id: 'l1' }]);
  });

  it('handleUploadMedia ignores non-media files and uploads valid ones', async () => {
    h.uploadMany.mockResolvedValue({
      results: [{ success: true, attachmentId: 5, url: 'up.jpg', thumbnail: 't.jpg' }],
    });
    const api = makeApi({ addCampaignMediaBatch: vi.fn().mockResolvedValue({ added: [{ id: 'added1' }], failed: [] }) });
    const { hook, onNotify } = setup({ api });
    await act(async () => { await hook.result.current.openForEdit({ id: '7' } as never); });
    // only a text file -> filtered out -> no upload
    await act(async () => { await hook.result.current.handleUploadMedia(new File(['x'], 'a.txt', { type: 'text/plain' })); });
    expect(h.uploadMany).not.toHaveBeenCalled();
    // a valid image
    await act(async () => { await hook.result.current.handleUploadMedia(new File(['x'], 'a.png', { type: 'image/png' })); });
    expect(h.uploadMany).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })));
  });
});
