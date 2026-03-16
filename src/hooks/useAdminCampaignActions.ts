import { useCallback, useState } from 'react';
import { getHotkeyHandler } from '@mantine/hooks';
import type { ApiClient, CampaignExportPayload } from '@/services/apiClient';
import type { AdminCampaign } from '@/hooks/useAdminSWR';
import { getErrorMessage } from '@/utils/getErrorMessage';

interface Options {
  apiClient: ApiClient;
  campaigns: AdminCampaign[];
  onMutate: () => Promise<unknown>;
  onCampaignsUpdated: () => void;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
  /** Delegate campaign edit to the unified modal. */
  onOpenEdit: (campaign: AdminCampaign) => void;
  /** Delegate campaign create to the unified modal. */
  onOpenCreate: () => void;
}

export function useAdminCampaignActions({ apiClient, campaigns: _campaigns, onMutate, onCampaignsUpdated, onNotify, onOpenEdit, onOpenCreate }: Options) {

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<AdminCampaign | null>(null);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());

  const [selectMode, setSelectMode] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [duplicateSource, setDuplicateSource] = useState<AdminCampaign | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  const handleEdit = useCallback((campaign: AdminCampaign) => {
    onOpenEdit(campaign);
  }, [onOpenEdit]);

  const handleCreate = useCallback(() => {
    onOpenCreate();
  }, [onOpenCreate]);

  const archiveCampaign = useCallback(async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setArchivingIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/archive`, {});
      onNotify({ type: 'success', text: 'Campaign archived.' });
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to archive campaign.') });
    } finally {
      setArchivingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [apiClient, onNotify, onMutate, onCampaignsUpdated]);

  const restoreCampaign = useCallback(async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setRestoringIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/restore`, {});
      onNotify({ type: 'success', text: 'Campaign restored.' });
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to restore campaign.') });
    } finally {
      setRestoringIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  }, [apiClient, onNotify, onMutate, onCampaignsUpdated]);

  const handleToggleSelectMode = useCallback(() => {
    setSelectMode((v) => !v);
    setSelectedCampaignIds(new Set());
  }, []);

  const handleToggleCampaignSelect = useCallback((id: string) => {
    setSelectedCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((ids: string[]) => {
    setSelectedCampaignIds(new Set(ids));
  }, []);

  const handleDeselectAll = useCallback(() => setSelectedCampaignIds(new Set()), []);

  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedCampaignIds);
    setIsBulkLoading(true);
    try {
      const result = await apiClient.batchCampaigns('archive', ids);
      const msg = result.failed.length > 0
        ? `${result.success.length} archived, ${result.failed.length} failed`
        : `${result.success.length} campaign${result.success.length !== 1 ? 's' : ''} archived`;
      onNotify({ type: result.failed.length > 0 ? 'error' : 'success', text: msg });
      setSelectedCampaignIds(new Set());
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Bulk action failed') });
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedCampaignIds, apiClient, onNotify, onMutate, onCampaignsUpdated]);

  const handleBulkRestore = useCallback(async () => {
    const ids = Array.from(selectedCampaignIds);
    setIsBulkLoading(true);
    try {
      const result = await apiClient.batchCampaigns('restore', ids);
      const msg = result.failed.length > 0
        ? `${result.success.length} restored, ${result.failed.length} failed`
        : `${result.success.length} campaign${result.success.length !== 1 ? 's' : ''} restored`;
      onNotify({ type: result.failed.length > 0 ? 'error' : 'success', text: msg });
      setSelectedCampaignIds(new Set());
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Bulk action failed') });
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedCampaignIds, apiClient, onNotify, onMutate, onCampaignsUpdated]);

  const handleDuplicateCampaign = useCallback(async (name: string, copyMedia: boolean) => {
    if (!duplicateSource) return;
    setIsDuplicating(true);
    try {
      await apiClient.duplicateCampaign(String(duplicateSource.id), { name, copyMedia });
      onNotify({ type: 'success', text: `"${name}" created` });
      setDuplicateSource(null);
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Duplication failed') });
    } finally {
      setIsDuplicating(false);
    }
  }, [duplicateSource, apiClient, onNotify, onMutate, onCampaignsUpdated]);

  const handleExportCampaign = useCallback(async (campaign: AdminCampaign) => {
    try {
      const payload = await apiClient.exportCampaign(String(campaign.id));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${campaign.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Export failed') });
    }
  }, [apiClient, onNotify]);

  const handleImportCampaign = useCallback(async (payload: CampaignExportPayload) => {
    setIsImporting(true);
    try {
      await apiClient.importCampaign(payload);
      const title = String((payload.campaign as Record<string, unknown>).title ?? 'Campaign');
      onNotify({ type: 'success', text: `"${title}" imported as draft` });
      setImportModalOpen(false);
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Import failed') });
    } finally {
      setIsImporting(false);
    }
  }, [apiClient, onNotify, onMutate, onCampaignsUpdated]);

  const hotkeyHandler = getHotkeyHandler([
    ['?',            () => setShortcutHelpOpen(true)],
    ['mod+n',        () => handleCreate()],
    ['mod+i',        () => setImportModalOpen(true)],
    ['mod+shift+a',  () => handleToggleSelectMode()],
  ]);

  return {
    // Scoped hotkey handler — attach via onKeyDown on a container
    hotkeyHandler,
    // Archive/restore
    confirmArchive,
    setConfirmArchive,
    confirmRestore,
    setConfirmRestore,
    archivingIds,
    restoringIds,
    // Bulk selection
    selectMode,
    selectedCampaignIds,
    isBulkLoading,
    // Duplicate
    duplicateSource,
    setDuplicateSource,
    isDuplicating,
    // Import
    importModalOpen,
    setImportModalOpen,
    isImporting,
    // Shortcuts help
    shortcutHelpOpen,
    setShortcutHelpOpen,
    // Handlers
    handleEdit,
    handleCreate,
    archiveCampaign,
    restoreCampaign,
    handleToggleSelectMode,
    handleToggleCampaignSelect,
    handleSelectAll,
    handleDeselectAll,
    handleBulkArchive,
    handleBulkRestore,
    handleDuplicateCampaign,
    handleExportCampaign,
    handleImportCampaign,
  };
}

export type CampaignActionsHandle = ReturnType<typeof useAdminCampaignActions>;
