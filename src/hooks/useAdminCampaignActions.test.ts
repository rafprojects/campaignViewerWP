import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAdminCampaignActions } from './useAdminCampaignActions';
import type { ApiClient } from '@/services/apiClient';
import type { AdminCampaign } from './useAdminSWR';

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
    ...overrides,
  } as unknown as ApiClient;
}

const mockCampaign: AdminCampaign = {
  id: 1,
  title: 'Test Campaign',
  description: '',
  company: '',
  companyId: '',
  status: 'active',
  visibility: 'private',
  tags: [],
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  imageAdapterId: '',
  videoAdapterId: '',
  categories: [],
};

const baseOptions = {
  campaigns: [mockCampaign],
  onMutate: vi.fn().mockResolvedValue(undefined),
  onCampaignsUpdated: vi.fn(),
  onNotify: vi.fn(),
};

const testFormState = {
  title: 'New Campaign',
  description: 'Desc',
  company: '',
  status: 'active' as const,
  visibility: 'private' as const,
  tags: '',
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  imageAdapterId: '',
  videoAdapterId: '',
  categories: [],
};

describe('useAdminCampaignActions', () => {
  afterEach(() => { vi.clearAllMocks(); });

  it('handleCreate opens campaign form with empty state', () => {
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions }),
    );
    expect(result.current.campaignFormOpen).toBe(false);
    act(() => { result.current.handleCreate(); });
    expect(result.current.campaignFormOpen).toBe(true);
    expect(result.current.editingCampaign).toBeNull();
  });

  it('handleEdit opens campaign form with campaign data', () => {
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions }),
    );
    act(() => { result.current.handleEdit(mockCampaign); });
    expect(result.current.campaignFormOpen).toBe(true);
    expect(result.current.editingCampaign).toEqual(mockCampaign);
  });

  it('closeCampaignForm closes the form', () => {
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions }),
    );
    act(() => { result.current.handleCreate(); });
    act(() => { result.current.closeCampaignForm(); });
    expect(result.current.campaignFormOpen).toBe(false);
  });

  it('saveCampaign calls POST when creating a new campaign', async () => {
    const post = vi.fn().mockResolvedValue({ id: 99 });
    const apiClient = makeApiClient({ post });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    act(() => { result.current.handleCreate(); });
    await act(async () => { await result.current.saveCampaign(testFormState); });
    expect(post).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns',
      expect.objectContaining({ title: 'New Campaign' }),
    );
    expect(baseOptions.onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    );
  });

  it('saveCampaign calls PUT when editing an existing campaign', async () => {
    const put = vi.fn().mockResolvedValue({ id: 1 });
    const apiClient = makeApiClient({ put });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions }),
    );
    act(() => { result.current.handleEdit(mockCampaign); });
    await act(async () => { await result.current.saveCampaign(testFormState); });
    expect(put).toHaveBeenCalledWith(
      '/wp-json/wp-super-gallery/v1/campaigns/1',
      expect.objectContaining({ title: 'New Campaign' }),
    );
  });

  it('saveCampaign notifies error on API failure', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient({
      post: vi.fn().mockRejectedValue(new Error('Server error')),
    });
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient, ...baseOptions, onNotify }),
    );
    act(() => { result.current.handleCreate(); });
    await act(async () => { await result.current.saveCampaign(testFormState); });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
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

  it('handleToggleSelectMode toggles selectMode and clears selection', () => {
    const { result } = renderHook(() =>
      useAdminCampaignActions({ apiClient: makeApiClient(), ...baseOptions }),
    );
    act(() => { result.current.handleToggleCampaignSelect('1'); });
    act(() => { result.current.handleToggleSelectMode(); });
    expect(result.current.selectMode).toBe(true);
    act(() => { result.current.handleToggleSelectMode(); });
    expect(result.current.selectMode).toBe(false);
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
      await result.current.handleDuplicateCampaign('Copy Campaign', true);
    });
    expect(duplicateCampaign).toHaveBeenCalledWith('1', { name: 'Copy Campaign', copyMedia: true });
    expect(onNotify).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', text: '"Copy Campaign" created' }),
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
