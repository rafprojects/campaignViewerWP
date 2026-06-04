import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminCampaignActions } from './useAdminCampaignActions';
import type { ApiClient } from '@/services/apiClient';
import type { AdminCampaign } from '@/services/adminQuery';

function makeApiClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ id: 99 }),
    put: vi.fn().mockResolvedValue({ id: 1 }),
    delete: vi.fn().mockResolvedValue(undefined),
    batchCampaigns: vi.fn().mockResolvedValue({ success: ['1'], failed: [] }),
    duplicateCampaign: vi.fn().mockResolvedValue({ id: 200 }),
    exportCampaign: vi.fn().mockResolvedValue({ version: 1, campaign: {}, media_references: [] }),
    importCampaign: vi.fn().mockResolvedValue({ id: 300 }),
    deleteCampaign: vi.fn().mockResolvedValue({ message: 'Campaign deleted', id: 1 }),
    ...overrides,
  } as unknown as ApiClient;
}

const mockCampaign: AdminCampaign = {
  id: '1',
  title: 'Test Campaign',
  description: '',
  companyId: '',
  status: 'active',
  visibility: 'private',
  createdAt: '',
  updatedAt: '',
  tags: [],
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  categories: [],
};

const baseOptions = {
  campaigns: [mockCampaign],
  onMutate: vi.fn().mockResolvedValue(undefined),
  onCampaignsUpdated: vi.fn(),
  onNotify: vi.fn(),
  onOpenEdit: vi.fn(),
  onOpenCreate: vi.fn(),
};

describe('useAdminCampaignActions', () => {
  afterEach(() => { vi.clearAllMocks(); });

  it('handleCreate delegates to onOpenCreate', () => {
    const onOpenCreate = vi.fn();
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions, onOpenCreate }),
    );
    act(() => { result.current.handleCreate(); });
    expect(onOpenCreate).toHaveBeenCalled();
  });

  it('handleEdit delegates to onOpenEdit with campaign', () => {
    const onOpenEdit = vi.fn();
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions, onOpenEdit }),
    );
    act(() => { result.current.handleEdit(mockCampaign); });
    expect(onOpenEdit).toHaveBeenCalledWith(mockCampaign);
  });

  it('archiveCampaign posts to archive endpoint', async () => {
    const post = vi.fn().mockResolvedValue({});
    const apiClient = makeApiClient({ post });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    await act(async () => { await result.current.archiveCampaign(mockCampaign); });
    expect(post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/1/archive',
      {},
    );
  });

  it('archiveCampaign notifies failure when archive request rejects', async () => {
    const post = vi.fn().mockRejectedValue(new Error('Archive failed'));
    const onNotify = vi.fn();
    const apiClient = makeApiClient({ post });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );

    await act(async () => { await result.current.archiveCampaign(mockCampaign); });

    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: 'Archive failed' }),
    );
  });

  it('restoreCampaign posts to restore endpoint', async () => {
    const post = vi.fn().mockResolvedValue({});
    const apiClient = makeApiClient({ post });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    await act(async () => { await result.current.restoreCampaign(mockCampaign); });
    expect(post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/1/restore',
      {},
    );
  });

  it('restoreCampaign notifies success after restore', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );

    await act(async () => { await result.current.restoreCampaign(mockCampaign); });

    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text: 'Campaign restored.' }),
    );
  });

  it('handleDeselectAll clears all selected campaign IDs', () => {
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions }),
    );
    act(() => { result.current.handleSelectAll(['1', '2']); });
    expect(result.current.selectedCampaignIds.size).toBe(2);
    act(() => { result.current.handleDeselectAll(); });
    expect(result.current.selectedCampaignIds.size).toBe(0);
  });

  it('handleSelectAll sets all provided IDs as selected', () => {
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions }),
    );
    act(() => { result.current.handleSelectAll(['1', '2', '3']); });
    expect(result.current.selectedCampaignIds).toEqual(new Set(['1', '2', '3']));
  });

  it('handleBulkArchive calls batchCampaigns with selected IDs', async () => {
    const batchCampaigns = vi.fn().mockResolvedValue({ success: ['1'], failed: [] });
    const apiClient = makeApiClient({ batchCampaigns });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    act(() => { result.current.handleSelectAll(['1']); });
    await act(async () => { await result.current.handleBulkArchive(); });
    expect(batchCampaigns).toHaveBeenCalledWith('archive', ['1']);
  });

  it('handleBulkRestore calls batchCampaigns with restore action', async () => {
    const batchCampaigns = vi.fn().mockResolvedValue({ success: ['2'], failed: [] });
    const apiClient = makeApiClient({ batchCampaigns });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    act(() => { result.current.handleSelectAll(['2']); });
    await act(async () => { await result.current.handleBulkRestore(); });
    expect(batchCampaigns).toHaveBeenCalledWith('restore', ['2']);
  });

  it('handleDuplicateCampaign calls duplicateCampaign and notifies success', async () => {
    const duplicateCampaign = vi.fn().mockResolvedValue({ id: 200 });
    const onNotify = vi.fn();
    const apiClient = makeApiClient({ duplicateCampaign });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );
    act(() => { result.current.setDuplicateSource(mockCampaign); });
    await act(async () => {
      await result.current.handleDuplicateCampaign('Copy Campaign', true, true);
    });
    expect(duplicateCampaign).toHaveBeenCalledWith('1', {
      name: 'Copy Campaign',
      copyMedia: true,
      duplicateLayoutTemplate: true,
    });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text: '"Copy Campaign" created' }),
    );
  });

  it('deleteCampaign calls apiClient.deleteCampaign with default purgeAnalytics=false', async () => {
    const deleteCampaign = vi.fn().mockResolvedValue({ message: 'Campaign deleted', id: 1 });
    const apiClient = makeApiClient({ deleteCampaign });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    await act(async () => { await result.current.deleteCampaign(mockCampaign, { purgeAnalytics: false }); });
    expect(deleteCampaign).toHaveBeenCalledWith('1', { purgeAnalytics: false });
  });

  it('deleteCampaign forwards purgeAnalytics flag and notifies success', async () => {
    const deleteCampaign = vi.fn().mockResolvedValue({ message: 'Campaign deleted', id: 1 });
    const onNotify = vi.fn();
    const apiClient = makeApiClient({ deleteCampaign });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );
    await act(async () => { await result.current.deleteCampaign(mockCampaign, { purgeAnalytics: true }); });
    expect(deleteCampaign).toHaveBeenCalledWith('1', { purgeAnalytics: true });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text: '"Test Campaign" deleted.' }),
    );
  });

  it('deleteCampaign notifies failure when the API rejects', async () => {
    const deleteCampaign = vi.fn().mockRejectedValue(new Error('boom'));
    const onNotify = vi.fn();
    const apiClient = makeApiClient({ deleteCampaign });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );
    await act(async () => { await result.current.deleteCampaign(mockCampaign, { purgeAnalytics: false }); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', text: 'boom' }),
    );
  });

  it('handleImportCampaign calls importCampaign and notifies success', async () => {
    const importCampaign = vi.fn().mockResolvedValue({ id: 300 });
    const onNotify = vi.fn();
    const apiClient = makeApiClient({ importCampaign });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );
    const payload = { version: 1, campaign: { title: 'Imported' }, media_references: [] };
    await act(async () => { await result.current.handleImportCampaign(payload as any); });
    expect(importCampaign).toHaveBeenCalledWith(payload);
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text: '"Imported" imported as draft' }),
    );
  });
});
