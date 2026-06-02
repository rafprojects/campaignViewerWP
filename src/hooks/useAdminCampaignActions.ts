import { useCallback, useMemo, useState } from 'react';
import { getHotkeyHandler } from '@mantine/hooks';
import type { ApiClient, CampaignExportPayload } from '@/services/apiClient';
import type { AdminCampaign } from '@/services/adminQuery';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useShortcutConfig, type ShortcutConfigHandle } from './useShortcutConfig';

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
  /** Whether the create/edit modal is currently open — guards hotkeys. */
  createModalOpen?: boolean;
}

export function useAdminCampaignActions({ apiClient, campaigns: _campaigns, onMutate, onCampaignsUpdated, onNotify, onOpenEdit, onOpenCreate, createModalOpen }: Options) {

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<AdminCampaign | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminCampaign | null>(null);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const [selectMode, setSelectMode] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [duplicateSource, setDuplicateSource] = useState<AdminCampaign | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [binaryExportingIds, setBinaryExportingIds] = useState<Set<string>>(new Set());

  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  const shortcutConfig = useShortcutConfig();

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

  const deleteCampaign = useCallback(async (campaign: AdminCampaign, opts: { purgeAnalytics: boolean }) => {
    const id = String(campaign.id);
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.deleteCampaign(id, { purgeAnalytics: opts.purgeAnalytics });
      onNotify({ type: 'success', text: `"${campaign.title}" deleted.` });
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to delete campaign.') });
    } finally {
      setDeletingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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

  const handleDuplicateCampaign = useCallback(async (name: string, copyMedia: boolean, duplicateLayoutTemplate: boolean) => {
    if (!duplicateSource) return;
    setIsDuplicating(true);
    try {
      await apiClient.duplicateCampaign(String(duplicateSource.id), {
        name,
        copyMedia,
        duplicateLayoutTemplate,
      });
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

  const handleBinaryExportCampaign = useCallback(async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setBinaryExportingIds((prev) => new Set(prev).add(id));
    try {
      const { jobId } = await apiClient.startCampaignBinaryExport(id);
      onNotify({ type: 'success', text: 'Building ZIP export — this may take a moment.' });

      // Poll every 3 seconds, up to 5 minutes.
      const deadline = Date.now() + 300_000;
      let job = await apiClient.getExportJob(jobId);
      while (job.status === 'pending' || job.status === 'processing') {
        if (Date.now() > deadline) {
          throw new Error('Export timed out after 5 minutes.');
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
        job = await apiClient.getExportJob(jobId);
      }

      if (job.status === 'failed') {
        throw new Error(job.error ?? 'Export failed');
      }

      await apiClient.downloadExportJob(jobId, `campaign-${id}.zip`);
      await apiClient.deleteExportJob(jobId);
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Binary export failed') });
    } finally {
      setBinaryExportingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
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

  const { effectiveMap } = shortcutConfig;
  const hotkeyHandler = useMemo(
    () => getHotkeyHandler([
      [effectiveMap.openHelp,    () => setShortcutHelpOpen(true)],
      [effectiveMap.newCampaign, () => { if (!createModalOpen) handleCreate(); }],
      [effectiveMap.importJson,  () => setImportModalOpen(true)],
      [effectiveMap.bulkSelect,  () => handleToggleSelectMode()],
    ]),
     
    [effectiveMap.openHelp, effectiveMap.newCampaign, effectiveMap.importJson, effectiveMap.bulkSelect, createModalOpen, handleCreate, handleToggleSelectMode],
  );

  return {
    // Scoped hotkey handler — attach via onKeyDown on a container
    hotkeyHandler,
    // Shortcut configuration
    shortcutConfig,
    // Archive/restore
    confirmArchive,
    setConfirmArchive,
    confirmRestore,
    setConfirmRestore,
    confirmDelete,
    setConfirmDelete,
    archivingIds,
    restoringIds,
    deletingIds,
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
    // Binary export
    binaryExportingIds,
    // Shortcuts help
    shortcutHelpOpen,
    setShortcutHelpOpen,
    // Handlers
    handleEdit,
    handleCreate,
    archiveCampaign,
    restoreCampaign,
    deleteCampaign,
    handleToggleSelectMode,
    handleToggleCampaignSelect,
    handleSelectAll,
    handleDeselectAll,
    handleBulkArchive,
    handleBulkRestore,
    handleDuplicateCampaign,
    handleExportCampaign,
    handleBinaryExportCampaign,
    handleImportCampaign,
  };
}

export type CampaignActionsHandle = ReturnType<typeof useAdminCampaignActions>;
export type { ShortcutConfigHandle };
