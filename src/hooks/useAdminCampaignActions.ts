import { useCallback, useReducer, useState } from 'react';
import { useHotkeys } from '@mantine/hooks';
import type { ApiClient, CampaignExportPayload } from '@/services/apiClient';
import type { CampaignFormState } from '@/components/Admin/CampaignFormModal';
import type { AdminCampaign } from '@/hooks/useAdminSWR';
import type { Campaign } from '@/types';
import { getErrorMessage } from '@/utils/getErrorMessage';

const emptyForm: CampaignFormState = {
  title: '',
  description: '',
  company: '',
  status: 'draft' as Campaign['status'],
  visibility: 'private' as Campaign['visibility'],
  tags: '',
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  imageAdapterId: '',
  videoAdapterId: '',
  categories: [],
};

const campaignFormReducer = (_state: CampaignFormState, next: CampaignFormState): CampaignFormState => next;

interface Options {
  apiClient: ApiClient;
  campaigns: AdminCampaign[];
  onMutate: () => Promise<unknown>;
  onCampaignsUpdated: () => void;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function useAdminCampaignActions({ apiClient, campaigns: _campaigns, onMutate, onCampaignsUpdated, onNotify }: Options) {
  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, dispatchFormState] = useReducer(campaignFormReducer, { ...emptyForm });
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);

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
    setEditingCampaign(campaign);
    dispatchFormState({
      title: campaign.title ?? '',
      description: campaign.description ?? '',
      company: campaign.companyId ?? '',
      status: campaign.status ?? 'draft',
      visibility: campaign.visibility ?? 'private',
      tags: (campaign.tags ?? []).join(', '),
      publishAt: campaign.publishAt ?? '',
      unpublishAt: campaign.unpublishAt ?? '',
      layoutTemplateId: campaign.layoutTemplateId ?? '',
      imageAdapterId: campaign.imageAdapterId ?? '',
      videoAdapterId: campaign.videoAdapterId ?? '',
      categories: campaign.categories ?? [],
    });
    setCampaignFormOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    setEditingCampaign(null);
    dispatchFormState({ ...emptyForm });
    setCampaignFormOpen(true);
  }, []);

  const closeCampaignForm = useCallback(() => {
    setCampaignFormOpen(false);
    setEditingCampaign(null);
    dispatchFormState({ ...emptyForm });
  }, []);

  const saveCampaign = useCallback(async (formState: CampaignFormState) => {
    setIsSavingCampaign(true);
    const payload = {
      title: formState.title,
      description: formState.description,
      company: formState.company,
      status: formState.status,
      visibility: formState.visibility,
      tags: formState.tags.split(',').map((t) => t.trim()).filter(Boolean),
      categories: formState.categories,
      publishAt: formState.publishAt || '',
      unpublishAt: formState.unpublishAt || '',
      layoutTemplateId: formState.layoutTemplateId || '',
      imageAdapterId: formState.imageAdapterId || '',
      videoAdapterId: formState.videoAdapterId || '',
    };
    try {
      if (editingCampaign) {
        await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editingCampaign.id}`, payload);
        onNotify({ type: 'success', text: 'Campaign updated.' });
      } else {
        await apiClient.post('/wp-json/wp-super-gallery/v1/campaigns', payload);
        onNotify({ type: 'success', text: 'Campaign created.' });
      }
      closeCampaignForm();
      await onMutate();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save campaign.') });
    } finally {
      setIsSavingCampaign(false);
    }
  }, [editingCampaign, apiClient, onNotify, closeCampaignForm, onMutate, onCampaignsUpdated]);

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

  useHotkeys([
    ['?',            () => setShortcutHelpOpen(true)],
    ['mod+n',        () => { if (!campaignFormOpen) handleCreate(); }],
    ['mod+i',        () => setImportModalOpen(true)],
    ['mod+shift+a',  () => handleToggleSelectMode()],
  ]);

  return {
    // Form state
    editingCampaign,
    formState,
    dispatchFormState,
    isSavingCampaign,
    campaignFormOpen,
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
    closeCampaignForm,
    saveCampaign,
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
