/**
 * Branch-coverage tests for useAdminCampaignActions (hand-authored).
 * Exercises success + error paths and guard clauses of every action handler.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAdminCampaignActions } from './useAdminCampaignActions';
import type { AdminCampaign } from '@/services/adminQuery';

const campaign = (over: Partial<AdminCampaign> = {}): AdminCampaign =>
  ({ id: '1', title: 'C1', ...over }) as AdminCampaign;

function makeApi(over: Record<string, unknown> = {}) {
  return {
    post: vi.fn().mockResolvedValue({}),
    deleteCampaign: vi.fn().mockResolvedValue({}),
    batchCampaigns: vi.fn().mockResolvedValue({ success: ['1'], failed: [] }),
    duplicateCampaign: vi.fn().mockResolvedValue({ id: '2', title: 'copy' }),
    moveCampaign: vi.fn().mockResolvedValue({}),
    exportCampaign: vi.fn().mockResolvedValue({ campaign: { title: 'C1' } }),
    startCampaignBinaryExport: vi.fn().mockResolvedValue({ jobId: 'j1' }),
    startBulkBinaryExport: vi.fn().mockResolvedValue({ jobId: 'jb' }),
    getExportJob: vi.fn().mockResolvedValue({ status: 'completed' }),
    downloadExportJob: vi.fn().mockResolvedValue(undefined),
    deleteExportJob: vi.fn().mockResolvedValue({}),
    importCampaign: vi.fn().mockResolvedValue({}),
    importCampaignBinary: vi.fn().mockResolvedValue({ imported: [{ id: 1 }, { id: 2 }] }),
    ...over,
  };
}

function setup(api = makeApi(), createModalOpen = false) {
  const onMutate = vi.fn().mockResolvedValue(undefined);
  const onCampaignsUpdated = vi.fn();
  const onNotify = vi.fn();
  const onOpenEdit = vi.fn();
  const onOpenCreate = vi.fn();
  const hook = renderHook(() =>
    useAdminCampaignActions({
      apiClient: api as never,
      campaigns: [campaign({ id: '1' }), campaign({ id: '2' })],
      onMutate,
      onCampaignsUpdated,
      onNotify,
      onOpenEdit,
      onOpenCreate,
      createModalOpen,
    }),
  );
  return { hook, api, onMutate, onCampaignsUpdated, onNotify, onOpenEdit, onOpenCreate };
}

beforeEach(() => {
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe('delegation + selection', () => {
  it('handleEdit/handleCreate delegate', () => {
    const { hook, onOpenEdit, onOpenCreate } = setup();
    act(() => hook.result.current.handleEdit(campaign()));
    act(() => hook.result.current.handleCreate());
    expect(onOpenEdit).toHaveBeenCalled();
    expect(onOpenCreate).toHaveBeenCalled();
  });

  it('toggles, selects all, deselects', () => {
    const { hook } = setup();
    act(() => hook.result.current.handleToggleCampaignSelect('1'));
    expect(hook.result.current.selectedCampaignIds.has('1')).toBe(true);
    act(() => hook.result.current.handleToggleCampaignSelect('1'));
    expect(hook.result.current.selectedCampaignIds.has('1')).toBe(false);
    act(() => hook.result.current.handleSelectAll(['1', '2']));
    expect(hook.result.current.selectedCampaignIds.size).toBe(2);
    act(() => hook.result.current.handleDeselectAll());
    expect(hook.result.current.selectedCampaignIds.size).toBe(0);
  });
});

describe('single archive/restore/delete', () => {
  it('archive success and error', async () => {
    const { hook, onNotify } = setup();
    await act(async () => { await hook.result.current.archiveCampaign(campaign()); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: 'Campaign archived.' });
    const api = makeApi({ post: vi.fn().mockRejectedValue(new Error('x')) });
    const s = setup(api);
    await act(async () => { await s.hook.result.current.archiveCampaign(campaign()); });
    expect(s.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('restore success and error', async () => {
    const { hook, onNotify } = setup();
    await act(async () => { await hook.result.current.restoreCampaign(campaign()); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: 'Campaign restored.' });
    const s = setup(makeApi({ post: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await s.hook.result.current.restoreCampaign(campaign()); });
    expect(s.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('delete success and error', async () => {
    const { hook, api, onNotify } = setup();
    await act(async () => { await hook.result.current.deleteCampaign(campaign(), { purgeAnalytics: true }); });
    expect(api.deleteCampaign).toHaveBeenCalledWith('1', { purgeAnalytics: true });
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: '"C1" deleted.' });
    const s = setup(makeApi({ deleteCampaign: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await s.hook.result.current.deleteCampaign(campaign(), { purgeAnalytics: false }); });
    expect(s.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('bulk actions', () => {
  it('bulk archive: all-success, partial-failure, and error', async () => {
    const { hook, onNotify } = setup();
    act(() => hook.result.current.handleSelectAll(['1', '2']));
    await act(async () => { await hook.result.current.handleBulkArchive(); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));

    const partial = setup(makeApi({ batchCampaigns: vi.fn().mockResolvedValue({ success: ['1'], failed: ['2'] }) }));
    act(() => partial.hook.result.current.handleSelectAll(['1', '2']));
    await act(async () => { await partial.hook.result.current.handleBulkArchive(); });
    expect(partial.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));

    const err = setup(makeApi({ batchCampaigns: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await err.hook.result.current.handleBulkArchive(); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('bulk restore and bulk delete (success + error)', async () => {
    const { hook, onNotify } = setup();
    act(() => hook.result.current.handleSelectAll(['1']));
    await act(async () => { await hook.result.current.handleBulkRestore(); });
    await act(async () => { await hook.result.current.handleBulkDelete({ purgeAnalytics: true }); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));

    const err = setup(makeApi({ batchCampaigns: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await err.hook.result.current.handleBulkDelete({ purgeAnalytics: false }); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('duplicate / move guards and paths', () => {
  it('duplicate returns early without a source, then succeeds and errors', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleDuplicateCampaign('n', true, false); });
    expect(api.duplicateCampaign).not.toHaveBeenCalled();
    act(() => hook.result.current.setDuplicateSource(campaign()));
    await act(async () => { await hook.result.current.handleDuplicateCampaign('n', true, true); });
    expect(api.duplicateCampaign).toHaveBeenCalled();

    const err = setup(makeApi({ duplicateCampaign: vi.fn().mockRejectedValue(new Error('x')) }));
    act(() => err.hook.result.current.setDuplicateSource(campaign()));
    await act(async () => { await err.hook.result.current.handleDuplicateCampaign('n', false, false); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('move returns early without a source, then succeeds and errors', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleMoveCampaign(2, 'Space B'); });
    expect(api.moveCampaign).not.toHaveBeenCalled();
    act(() => hook.result.current.setMoveSource(campaign()));
    await act(async () => { await hook.result.current.handleMoveCampaign(2, 'Space B'); });
    expect(api.moveCampaign).toHaveBeenCalledWith('1', 2);

    const err = setup(makeApi({ moveCampaign: vi.fn().mockRejectedValue(new Error('x')) }));
    act(() => err.hook.result.current.setMoveSource(campaign()));
    await act(async () => { await err.hook.result.current.handleMoveCampaign(2, 'B'); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('export / import', () => {
  it('json export success and error', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleExportCampaign(campaign()); });
    expect(api.exportCampaign).toHaveBeenCalled();
    const err = setup(makeApi({ exportCampaign: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await err.hook.result.current.handleExportCampaign(campaign()); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('binary export: completed, failed-status, and start error', async () => {
    const { hook, api } = setup();
    await act(async () => { await hook.result.current.handleBinaryExportCampaign(campaign()); });
    expect(api.downloadExportJob).toHaveBeenCalledWith('j1', 'campaign-1.zip');
    expect(api.deleteExportJob).toHaveBeenCalledWith('j1');

    const failed = setup(makeApi({ getExportJob: vi.fn().mockResolvedValue({ status: 'failed', error: 'boom' }) }));
    await act(async () => { await failed.hook.result.current.handleBinaryExportCampaign(campaign()); });
    expect(failed.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));

    const startErr = setup(makeApi({ startCampaignBinaryExport: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await startErr.hook.result.current.handleBinaryExportCampaign(campaign()); });
    expect(startErr.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('bulk binary export success and error', async () => {
    const { hook } = setup();
    act(() => hook.result.current.handleSelectAll(['1', '2']));
    await act(async () => { await hook.result.current.handleBulkBinaryExport(); });
    const err = setup(makeApi({ startBulkBinaryExport: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await err.hook.result.current.handleBulkBinaryExport(); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('import json (success + error)', async () => {
    const { hook, onNotify } = setup();
    await act(async () => { await hook.result.current.handleImportCampaign({ campaign: { title: 'Imp' } } as never); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: '"Imp" imported as draft' });
    const err = setup(makeApi({ importCampaign: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await err.hook.result.current.handleImportCampaign({ campaign: {} } as never); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('import binary: imported-array branch, single-title branch, and error', async () => {
    const { hook, onNotify } = setup();
    await act(async () => { await hook.result.current.handleImportCampaignBinary(new File(['x'], 'a.zip')); });
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: '2 campaigns imported as drafts' });

    const single = setup(makeApi({ importCampaignBinary: vi.fn().mockResolvedValue({ title: 'Solo' }) }));
    await act(async () => { await single.hook.result.current.handleImportCampaignBinary(new File(['x'], 'a.zip')); });
    expect(single.onNotify).toHaveBeenCalledWith({ type: 'success', text: '"Solo" imported as draft' });

    const err = setup(makeApi({ importCampaignBinary: vi.fn().mockRejectedValue(new Error('x')) }));
    await act(async () => { await err.hook.result.current.handleImportCampaignBinary(new File(['x'], 'a.zip')); });
    expect(err.onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
});

describe('hotkey handler — bulkSelect branches (lines 344-349)', () => {
  it('bulkSelect hotkey selects all when nothing is selected (else branch)', () => {
    const { hook } = setup();
    // No campaigns selected initially — bulkSelect should call handleSelectAll
    const event = new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 'a', bubbles: true });
    act(() => hook.result.current.hotkeyHandler(event as never));
    expect(hook.result.current.selectedCampaignIds.size).toBe(2);
  });

  it('bulkSelect hotkey deselects all when campaigns are selected (if branch)', () => {
    const { hook } = setup();
    // Select some campaigns first
    act(() => hook.result.current.handleSelectAll(['1', '2']));
    expect(hook.result.current.selectedCampaignIds.size).toBe(2);
    // Now hotkey should deselect
    const event = new KeyboardEvent('keydown', { ctrlKey: true, shiftKey: true, key: 'a', bubbles: true });
    act(() => hook.result.current.hotkeyHandler(event as never));
    expect(hook.result.current.selectedCampaignIds.size).toBe(0);
  });

  it('newCampaign hotkey is a no-op when createModalOpen is true (false branch of !createModalOpen)', () => {
    const { hook, onOpenCreate } = setup(makeApi(), true); // createModalOpen=true
    const event = new KeyboardEvent('keydown', { altKey: true, key: 'n', bubbles: true });
    act(() => hook.result.current.hotkeyHandler(event as never));
    // When createModalOpen=true, handleCreate should NOT be called
    expect(onOpenCreate).not.toHaveBeenCalled();
  });

  it('openHelp hotkey sets shortcutHelpOpen to true', () => {
    const { hook } = setup();
    const event = new KeyboardEvent('keydown', { key: '?', bubbles: true });
    act(() => hook.result.current.hotkeyHandler(event as never));
    expect(hook.result.current.shortcutHelpOpen).toBe(true);
  });
});

describe('bulk binary export — additional branch coverage', () => {
  it('failed status without error message uses fallback text (line 286 ?? branch)', async () => {
    const { hook, onNotify } = setup(makeApi({
      startBulkBinaryExport: vi.fn().mockResolvedValue({ jobId: 'jb' }),
      getExportJob: vi.fn().mockResolvedValue({ status: 'failed' }),
    }));
    act(() => hook.result.current.handleSelectAll(['1']));
    await act(async () => { await hook.result.current.handleBulkBinaryExport(); });
    expect(onNotify).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('polls when job starts as processing then completes (line 282)', async () => {
    vi.useFakeTimers();
    const getExportJobMock = vi.fn()
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'completed' });
    const { hook } = setup(makeApi({
      startBulkBinaryExport: vi.fn().mockResolvedValue({ jobId: 'jb3' }),
      getExportJob: getExportJobMock,
    }));
    act(() => hook.result.current.handleSelectAll(['1']));
    await act(async () => {
      const p = hook.result.current.handleBulkBinaryExport();
      await vi.runAllTimersAsync();
      return p;
    });
    expect(getExportJobMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
