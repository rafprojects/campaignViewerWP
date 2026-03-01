import { lazy, Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ApiClient, CampaignExportPayload } from '@/services/apiClient';
import type { Campaign } from '@/types';
import {
  Tabs,
  Button,
  Group,
  Card,
  Text,
  Table,
  Badge,
  Stack,
  Loader,
  Center,
  Title,
  ActionIcon,
  Box,
  Checkbox,
  useCombobox,
  Tooltip,
  Chip,
} from '@mantine/core';
import { useDebouncedValue, useHotkeys } from '@mantine/hooks';
import { IconPlus, IconTrash, IconEdit, IconArrowLeft, IconRefresh, IconArchiveOff, IconLayoutGrid, IconCopy, IconArchive, IconDownload, IconFileImport, IconKeyboard } from '@tabler/icons-react';
import { CampaignFormModal, type CampaignFormState } from './CampaignFormModal';
import { CampaignsTab } from './CampaignsTab';
import { BulkActionsBar } from './BulkActionsBar';
import { CampaignDuplicateModal } from './CampaignDuplicateModal';
import { CampaignImportModal } from './CampaignImportModal';
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal';
import { AuditTab } from './AuditTab';
import { AccessTab } from './AccessTab';
import { LayoutTemplateList } from './LayoutTemplateList';
import { CampaignSelector } from '@/components/shared/CampaignSelector';
import { AdminCampaignArchiveModal } from './AdminCampaignArchiveModal';
import { AdminCampaignRestoreModal } from './AdminCampaignRestoreModal';
import { ArchiveCompanyModal } from './ArchiveCompanyModal';
import { QuickAddUserModal } from './QuickAddUserModal';
import { getErrorMessage } from '@/utils/getErrorMessage';
import useSWR from 'swr';
import type { LayoutTemplate } from '@/types';
import {
  useAdminCampaigns,
  useAccessGrants,
  useCompanies,
  useAuditEntries,
  prefetchAllCampaignMedia,
  prefetchAllCampaignAccess,
  prefetchAllCampaignAudit,
  type AdminCampaign,
  type CompanyInfo,
  type CompanyAccessGrant as CompanyAccessGrantType,
} from '@/hooks/useAdminSWR';

const MediaTab = lazy(() => import('./MediaTab'));
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));

// Types moved to useAdminSWR.ts hook — only keep AccessViewMode, WpUser locally.

interface WpUser {
  id: number;
  email: string;
  displayName: string;
  login: string;
  isAdmin: boolean;
}

type AccessViewMode = 'campaign' | 'company' | 'all';

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

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

/** Derive a human-readable schedule label from publishAt / unpublishAt dates. */
function scheduleLabel(publishAt?: string, unpublishAt?: string): { text: string; color: string } | null {
  const now = Date.now();
  if (publishAt && new Date(publishAt).getTime() > now) {
    return { text: 'Scheduled', color: 'blue' };
  }
  if (unpublishAt) {
    const end = new Date(unpublishAt).getTime();
    if (end <= now) return { text: 'Expired', color: 'red' };
    // Within 24h of expiry
    if (end - now < 86_400_000) return { text: 'Expiring soon', color: 'orange' };
  }
  return null;
}

const campaignFormReducer = (_state: CampaignFormState, next: CampaignFormState): CampaignFormState => next;

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('campaigns');

  // P13-C: SWR-cached campaign list — no duplicate fetch, instant re-open.
  const { campaigns, campaignsLoading: isLoading, campaignsError: error, mutateCampaigns } = useAdminCampaigns(apiClient);

  // P15-F.2: Layout templates for campaign assignment selector
  const { data: layoutTemplates } = useSWR<LayoutTemplate[]>(
    'admin-layout-templates-for-form',
    () => apiClient.getLayoutTemplates(),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const [editingCampaign, setEditingCampaign] = useState<AdminCampaign | null>(null);
  const [formState, dispatchFormState] = useReducer(campaignFormReducer, { ...emptyForm });
  const [isSavingCampaign, setIsSavingCampaign] = useState(false);

  const [mediaCampaignId, setMediaCampaignId] = useState<string>('');
  // Template ID to open in the builder when switching to the layouts tab.
  const [pendingEditLayoutId, setPendingEditLayoutId] = useState<string | null>(null);

  const [accessCampaignId, setAccessCampaignId] = useState<string>('');
  const [accessUserId, setAccessUserId] = useState('');
  const [accessSource, setAccessSource] = useState<'company' | 'campaign'>('campaign');
  const [accessAction, setAccessAction] = useState<'grant' | 'deny'>('grant');
  const [accessSaving, setAccessSaving] = useState(false);
  
  // Company management state
  const [accessViewMode, setAccessViewMode] = useState<AccessViewMode>('campaign');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [confirmArchiveCompany, setConfirmArchiveCompany] = useState<CompanyInfo | null>(null);
  const [archiveRevokeAccess, setArchiveRevokeAccess] = useState(false);

  // P13-C: SWR-cached access, companies, and audit data.
  const accessTargetId = accessViewMode === 'campaign' ? accessCampaignId : selectedCompanyId;
  const { accessEntries, accessLoading, mutateAccess } = useAccessGrants(
    apiClient,
    accessViewMode,
    activeTab === 'access' ? accessTargetId : '', // only fetch when access tab active
  );
  const companiesEnabled = activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all');
  const { companies, companiesLoading, mutateCompanies } = useCompanies(apiClient, companiesEnabled);
  
  // User search state for searchable picker
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [debouncedSearch] = useDebouncedValue(userSearchQuery, 300);
  const [userSearchResults, setUserSearchResults] = useState<WpUser[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<WpUser | null>(null);
  const userCombobox = useCombobox({
    onDropdownClose: () => userCombobox.resetSelectedOption(),
  });
  const blurTimeoutRef = useRef<number | null>(null);

  // Quick Add User state
  const [quickAddUserOpen, setQuickAddUserOpen] = useState(false);
  const [quickAddEmail, setQuickAddEmail] = useState('');
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddRole, setQuickAddRole] = useState('subscriber');
  const [quickAddCampaignId, setQuickAddCampaignId] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddResult, setQuickAddResult] = useState<{ success: boolean; message: string; resetUrl?: string } | null>(null);
  const [quickAddTestMode, setQuickAddTestMode] = useState(false);

  const [auditCampaignId, setAuditCampaignId] = useState<string>('');
  // P13-C: SWR-cached audit entries — only fetches when audit tab is active.
  const { auditEntries, auditLoading } = useAuditEntries(
    apiClient,
    activeTab === 'audit' ? auditCampaignId : '',
  );

  const [confirmArchive, setConfirmArchive] = useState<AdminCampaign | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<AdminCampaign | null>(null);
  const [archivingIds, setArchivingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [rescanAllLoading, setRescanAllLoading] = useState(false);
  const [campaignFormOpen, setCampaignFormOpen] = useState(false);

  // ── P18-B: Bulk selection ────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // ── P18-C: Duplicate ─────────────────────────────────────────
  const [duplicateSource, setDuplicateSource] = useState<AdminCampaign | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  // ── P18-D: Export / Import ─────────────────────────────────
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // ── P18-E: Keyboard shortcuts help ──────────────────────────
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  // ── P18-H: Category filter ───────────────────────────────────
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const { data: campaignCategories = [] } = useSWR(
    'campaign-categories',
    () => apiClient.listCampaignCategories(),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );
  const availableCategoryNames = useMemo(
    () => campaignCategories.map((c) => c.name),
    [campaignCategories],
  );

  // Cleanup blur timeout on unmount
  useEffect(() => {
    const timeoutId = blurTimeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Auto-select first campaign for media/access/audit tabs
  useEffect(() => {
    if (activeTab === 'media' && !mediaCampaignId && campaigns.length > 0) {
      setMediaCampaignId(String(campaigns[0].id));
    }
  }, [activeTab, campaigns, mediaCampaignId]);

  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && campaigns.length > 0 && accessViewMode === 'campaign') {
      setAccessCampaignId(String(campaigns[0].id));
    }
  }, [activeTab, accessCampaignId, campaigns, accessViewMode]);

  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && campaigns.length > 0) {
      setAuditCampaignId(String(campaigns[0].id));
    }
  }, [activeTab, auditCampaignId, campaigns]);

  // Auto-select first company when in company/all mode
  useEffect(() => {
    if (activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(String(companies[0].id));
    }
  }, [activeTab, accessViewMode, selectedCompanyId, companies]);

  // Prefetch media for all campaigns when the media tab opens (Option B).
  // This runs in the background with staggered requests so switching between
  // campaigns in the media selector is instant (SWR cache hit).
  const mediaPrefetchedRef = useRef(false);
  const cancelMediaPrefetchRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (activeTab === 'media' && campaigns.length > 0 && !mediaPrefetchedRef.current) {
      mediaPrefetchedRef.current = true;
      cancelMediaPrefetchRef.current = prefetchAllCampaignMedia(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);

  // Prefetch access grants for all campaigns when the access tab opens.
  const accessPrefetchedRef = useRef(false);
  const cancelAccessPrefetchRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (activeTab === 'access' && campaigns.length > 0 && !accessPrefetchedRef.current) {
      accessPrefetchedRef.current = true;
      cancelAccessPrefetchRef.current = prefetchAllCampaignAccess(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);

  // Prefetch audit entries for all campaigns when the audit tab opens.
  const auditPrefetchedRef = useRef(false);
  const cancelAuditPrefetchRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (activeTab === 'audit' && campaigns.length > 0 && !auditPrefetchedRef.current) {
      auditPrefetchedRef.current = true;
      cancelAuditPrefetchRef.current = prefetchAllCampaignAudit(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);

  // Cancel any in-flight prefetch timers on unmount.
  useEffect(() => {
    return () => {
      cancelMediaPrefetchRef.current?.();
      cancelAccessPrefetchRef.current?.();
      cancelAuditPrefetchRef.current?.();
    };
  }, []);

  // Search users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        setUserSearchResults([]);
        return;
      }
      setUserSearchLoading(true);
      try {
        const response = await apiClient.get<{ users: WpUser[]; total: number }>(
          `/wp-json/wp-super-gallery/v1/users/search?search=${encodeURIComponent(debouncedSearch)}`
        );
        setUserSearchResults(response.users ?? []);
      } catch {
        setUserSearchResults([]);
      } finally {
        setUserSearchLoading(false);
      }
    };
    void searchUsers();
  }, [debouncedSearch, apiClient]);

  const handleGrantAccess = async () => {
    // Validate we have a target (campaign or company based on mode)
    if (accessViewMode === 'campaign' && !accessCampaignId) return;
    if ((accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId) return;
    
    // Use selected user from picker, or fall back to manual ID input
    let userId: number;
    if (selectedUser) {
      userId = selectedUser.id;
    } else if (accessUserId) {
      const parsedUserId = Number(accessUserId);
      if (!Number.isInteger(parsedUserId) || parsedUserId <= 0) {
        onNotify({ type: 'error', text: 'User ID must be a positive numeric value.' });
        return;
      }
      userId = parsedUserId;
    } else {
      onNotify({ type: 'error', text: 'Please select a user or enter a User ID.' });
      return;
    }

    setAccessSaving(true);
    try {
      if (accessViewMode === 'campaign') {
        // Campaign mode: use existing campaign access endpoint
        await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access`, {
          userId,
          source: accessSource,
          action: accessSource === 'company' ? 'grant' : accessAction,
        });
        await mutateAccess();
      } else {
        // Company/All mode: use company access endpoint
        await apiClient.post(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access`, {
          userId,
        });
        await mutateAccess();
      }
      onNotify({ type: 'success', text: 'Access updated.' });
      setAccessUserId('');
      setSelectedUser(null);
      setUserSearchQuery('');
      setAccessAction('grant');
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to update access.') });
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = useCallback(async (entry: CompanyAccessGrantType) => {
    setAccessSaving(true);
    try {
      if (accessViewMode === 'campaign') {
        if (!accessCampaignId) return;
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${accessCampaignId}/access/${entry.userId}`);
      } else if (entry.source === 'company' && selectedCompanyId) {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/companies/${selectedCompanyId}/access/${entry.userId}`);
      } else if (entry.source === 'campaign' && entry.campaignId) {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${entry.campaignId}/access/${entry.userId}`);
      }
      await mutateAccess();
      onNotify({ type: 'success', text: 'Access revoked.' });
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to revoke access.') });
    } finally {
      setAccessSaving(false);
    }
  }, [accessCampaignId, accessViewMode, apiClient, mutateAccess, onNotify, selectedCompanyId]);

  // Handle archive company (bulk archive all campaigns)
  const handleArchiveCompany = async () => {
    if (!confirmArchiveCompany) return;
    setAccessSaving(true);
    try {
      const response = await apiClient.post<{ archivedCount: number }>(`/wp-json/wp-super-gallery/v1/companies/${confirmArchiveCompany.id}/archive`, {
        revokeAccess: archiveRevokeAccess,
      });
      onNotify({ type: 'success', text: `Archived ${response.archivedCount} campaigns.` });
      setConfirmArchiveCompany(null);
      setArchiveRevokeAccess(false);
      // Revalidate cached data
      await Promise.all([
        mutateCompanies(),
        mutateCampaigns(),
        selectedCompanyId ? mutateAccess() : Promise.resolve(),
      ]);
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to archive company.') });
    } finally {
      setAccessSaving(false);
    }
  };

  // Handle quick add user
  const handleQuickAddUser = async () => {
    if (!quickAddEmail || !quickAddName) {
      onNotify({ type: 'error', text: 'Email and name are required.' });
      return;
    }
    setQuickAddSaving(true);
    setQuickAddResult(null);
    try {
      const response = await apiClient.post<{
        message: string;
        userId: number;
        emailSent: boolean;
        accessGranted: boolean;
        resetUrl?: string;
        emailFailed?: boolean;
      }>('/wp-json/wp-super-gallery/v1/users', {
        email: quickAddEmail,
        displayName: quickAddName,
        role: quickAddRole,
        campaignId: quickAddCampaignId ? parseInt(quickAddCampaignId) : 0,
        simulateEmailFailure: quickAddTestMode,
      });

      if (response.emailSent) {
        setQuickAddResult({
          success: true,
          message: `User created! Password setup email sent to ${quickAddEmail}.`,
        });
      } else {
        setQuickAddResult({
          success: true,
          message: response.message,
          resetUrl: response.resetUrl,
        });
      }

      // Revalidate access if we granted access to a campaign
      if (response.accessGranted && accessCampaignId) {
        await mutateAccess();
      }

      // Clear form after success
      setQuickAddEmail('');
      setQuickAddName('');
      setQuickAddRole('subscriber');
      setQuickAddCampaignId('');
    } catch (err) {
      setQuickAddResult({
        success: false,
        message: getErrorMessage(err, 'Failed to create user.'),
      });
    } finally {
      setQuickAddSaving(false);
    }
  };

  const closeQuickAddUser = () => {
    setQuickAddUserOpen(false);
    setQuickAddEmail('');
    setQuickAddName('');
    setQuickAddRole('subscriber');
    setQuickAddCampaignId('');
    setQuickAddResult(null);
    setQuickAddTestMode(false);
  };

  // loadAudit removed — SWR hook handles fetching automatically when auditCampaignId changes.

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

  const handleCreate = () => {
    setEditingCampaign(null);
    dispatchFormState({ ...emptyForm });
    setCampaignFormOpen(true);
  };

  const closeCampaignForm = () => {
    setCampaignFormOpen(false);
    setEditingCampaign(null);
    dispatchFormState({ ...emptyForm });
  };

  const saveCampaign = async () => {
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
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save campaign.') });
    } finally {
      setIsSavingCampaign(false);
    }
  };

  // ── P18-B: bulk selection handlers ───────────────────────────
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

  const handleSelectAll = useCallback(() => {
    setSelectedCampaignIds(new Set(campaigns.map((c) => String(c.id))));
  }, [campaigns]);

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
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Bulk action failed') });
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedCampaignIds, apiClient, onNotify, mutateCampaigns, onCampaignsUpdated]);

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
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Bulk action failed') });
    } finally {
      setIsBulkLoading(false);
    }
  }, [selectedCampaignIds, apiClient, onNotify, mutateCampaigns, onCampaignsUpdated]);

  // ── P18-C: duplicate handler ──────────────────────────────────
  const handleDuplicateCampaign = useCallback(async (name: string, copyMedia: boolean) => {
    if (!duplicateSource) return;
    setIsDuplicating(true);
    try {
      await apiClient.duplicateCampaign(String(duplicateSource.id), { name, copyMedia });
      onNotify({ type: 'success', text: `"${name}" created` });
      setDuplicateSource(null);
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Duplication failed') });
    } finally {
      setIsDuplicating(false);
    }
  }, [duplicateSource, apiClient, onNotify, mutateCampaigns, onCampaignsUpdated]);

  // ── P18-D: Export / Import handlers ─────────────────────────
  const handleExportCampaign = useCallback(async (campaign: AdminCampaign) => {
    try {
      const payload = await apiClient.exportCampaign(String(campaign.id));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaign-${campaign.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
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
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Import failed') });
    } finally {
      setIsImporting(false);
    }
  }, [apiClient, onNotify, mutateCampaigns, onCampaignsUpdated]);

  // ── P18-E: Keyboard shortcuts ───────────────────────────────
  useHotkeys([
    ['?',              () => setShortcutHelpOpen(true)],
    ['mod+n',         () => { if (!campaignFormOpen) handleCreate(); }],
    ['mod+i',         () => setImportModalOpen(true)],
    ['mod+shift+a',   () => handleToggleSelectMode()],
  ]);

  const archiveCampaign = async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setArchivingIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/archive`, {});
      onNotify({ type: 'success', text: 'Campaign archived.' });
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to archive campaign.') });
    } finally {
      setArchivingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const restoreCampaign = async (campaign: AdminCampaign) => {
    const id = String(campaign.id);
    setRestoringIds((prev) => new Set(prev).add(id));
    try {
      await apiClient.post(`/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/restore`, {});
      onNotify({ type: 'success', text: 'Campaign restored.' });
      await mutateCampaigns();
      onCampaignsUpdated();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to restore campaign.') });
    } finally {
      setRestoringIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const campaignSelectData = useMemo(() => {
    return campaigns.map((c) => ({ 
      value: String(c.id), 
      label: c.companyId ? `${c.title} (${c.companyId})` : c.title 
    }));
  }, [campaigns]);

  const companySelectData = useMemo(() => {
    return companies.map((c) => ({ 
      value: String(c.id), 
      label: `${c.name} (${c.activeCampaigns} active, ${c.archivedCampaigns} archived)` 
    }));
  }, [companies]);

  // Get the currently selected campaign with company info
  const selectedCampaign = useMemo(() => {
    if (!accessCampaignId) return null;
    return campaigns.find((c) => String(c.id) === String(accessCampaignId)) || null;
  }, [accessCampaignId, campaigns]);

  // Get the currently selected company info
  const selectedCompany = useMemo(() => {
    if (!selectedCompanyId) return null;
    return companies.find((c) => String(c.id) === selectedCompanyId) || null;
  }, [selectedCompanyId, companies]);

  const campaignsRows = useMemo(() => {
    // P18-H: Apply category filter
    const visible = categoryFilter
      ? campaigns.filter((c) => (c.categories ?? []).includes(categoryFilter))
      : campaigns;
    return visible.map((c) => {
      const cid = String(c.id);
      const isSelected = selectedCampaignIds.has(cid);
      return (
        <Table.Tr key={c.id} data-selected={isSelected || undefined}>
          {selectMode && (
            <Table.Td w={36}>
              <Checkbox
                checked={isSelected}
                onChange={() => handleToggleCampaignSelect(cid)}
                aria-label={`Select ${c.title}`}
              />
            </Table.Td>
          )}
          <Table.Td>
            <Box>
              <Group gap={6}>
                <Text fw={700}>{c.title}</Text>
                {(c.imageAdapterId || c.videoAdapterId) && (
                  <Tooltip label={`Custom gallery: ${[c.imageAdapterId && `Image: ${c.imageAdapterId}`, c.videoAdapterId && `Video: ${c.videoAdapterId}`].filter(Boolean).join(', ')}`} withArrow>
                    <IconLayoutGrid size={14} color="var(--mantine-color-violet-5)" />
                  </Tooltip>
                )}
              </Group>
              <Text size="xs" c="dimmed">{c.description?.slice(0, 120)}</Text>
            </Box>
          </Table.Td>
          <Table.Td>
            <Group gap={4} wrap="wrap">
              <Badge color={c.status === 'active' ? 'teal' : c.status === 'archived' ? 'gray' : 'yellow'}>
                {c.status}
              </Badge>
              {(() => {
                const sched = scheduleLabel(c.publishAt, c.unpublishAt);
                return sched ? <Badge variant="light" color={sched.color} size="xs">{sched.text}</Badge> : null;
              })()}
            </Group>
          </Table.Td>
          <Table.Td>
            <Badge variant="light">{c.visibility}</Badge>
          </Table.Td>
          <Table.Td>{c.companyId || '—'}</Table.Td>
          <Table.Td>
            <Group gap="xs" wrap="wrap">
              <Button variant="outline" size="xs" leftSection={<IconEdit size={14} />} onClick={() => handleEdit(c)}>
                Edit
              </Button>
              <Tooltip label="Clone campaign">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconCopy size={14} />}
                  onClick={() => setDuplicateSource(c)}
                  aria-label={`Duplicate ${c.title}`}
                >
                  Clone
                </Button>
              </Tooltip>
              <Tooltip label="Export campaign as JSON">
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconDownload size={14} />}
                  onClick={() => handleExportCampaign(c)}
                  aria-label={`Export ${c.title}`}
                >
                  Export
                </Button>
              </Tooltip>
              {c.status === 'archived' ? (
                <Button color="teal" size="xs" leftSection={<IconArchiveOff size={14} />} loading={restoringIds.has(cid)} onClick={() => setConfirmRestore(c)}>
                  Restore
                </Button>
              ) : (
                <Button color="orange" variant="light" size="xs" leftSection={<IconArchive size={14} />} loading={archivingIds.has(cid)} onClick={() => setConfirmArchive(c)}>
                  Archive
                </Button>
              )}
            </Group>
          </Table.Td>
        </Table.Tr>
      );
    });
  }, [campaigns, categoryFilter, handleEdit, restoringIds, archivingIds, setConfirmRestore, setConfirmArchive, selectMode, selectedCampaignIds, handleToggleCampaignSelect, handleExportCampaign]);

  const accessRows = useMemo(() => {
    return accessEntries.map((a) => (
      <Table.Tr key={`${a.userId}-${a.source}-${a.campaignId || 'company'}`} style={a.source === 'company' ? { backgroundColor: 'color-mix(in srgb, var(--wpsg-color-primary) 5%, transparent)' } : undefined}>
        <Table.Td>
          {a.user ? (
            <Stack gap={2}>
              <Text size="sm" fw={500}>{a.user.displayName}</Text>
              <Text size="xs" c="dimmed">{a.user.email}</Text>
            </Stack>
          ) : (
            <Text size="sm">User #{a.userId}</Text>
          )}
        </Table.Td>
        <Table.Td>
          <Stack gap={2}>
            <Tooltip label={a.source === 'company' ? 'Company-wide access - applies to all campaigns' : 'Direct campaign access'}>
              <Badge variant="light" color={a.source === 'company' ? 'blue' : 'green'}>
                {a.source === 'company' ? '🏢 Company' : '📋 Campaign'}
              </Badge>
            </Tooltip>
            {accessViewMode === 'all' && a.source === 'campaign' && a.campaignTitle && (
              <Text size="xs" c="dimmed">{a.campaignTitle}</Text>
            )}
          </Stack>
        </Table.Td>
        <Table.Td>{a.grantedAt ? new Date(a.grantedAt).toLocaleString() : '—'}</Table.Td>
        <Table.Td>
          <Tooltip label={a.source === 'company' ? 'Revoke company-wide access' : 'Revoke campaign access'}>
            <ActionIcon color="red" variant="light" size="lg" onClick={() => handleRevokeAccess(a)} aria-label="Revoke access">
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Table.Td>
      </Table.Tr>
    ));
  }, [accessEntries, accessViewMode, handleRevokeAccess]);

  const auditRows = useMemo(() => {
    return auditEntries
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((e) => (
        <Table.Tr key={e.id}>
          <Table.Td>{new Date(e.createdAt).toLocaleString()}</Table.Td>
          <Table.Td>
            <Text size="sm" style={{ wordBreak: 'break-all' }}>
              {e.action}
            </Text>
          </Table.Td>
          <Table.Td>{e.userId || '—'}</Table.Td>
          <Table.Td>
            <Text size="xs" lineClamp={1}>
              {Object.keys(e.details ?? {}).length > 0 ? JSON.stringify(e.details) : '—'}
            </Text>
          </Table.Td>
        </Table.Tr>
      ));
  }, [auditEntries]);

  return (
    <Card shadow="sm" radius="md" withBorder>
      <Stack gap="md" mb="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Group>
            <ActionIcon variant="light" size="lg" onClick={onClose} aria-label="Back to gallery">
              <IconArrowLeft />
            </ActionIcon>
            <Title order={2} size="h3">Admin Panel</Title>
          </Group>
          <Button 
            leftSection={<IconPlus />} 
            onClick={handleCreate} 
            aria-label="Create new campaign"
            size="sm"
          >
            New Campaign
          </Button>
          <Button
            variant="outline"
            leftSection={<IconFileImport size={16} />}
            onClick={() => setImportModalOpen(true)}
            aria-label="Import campaign from JSON"
            size="sm"
          >
            Import
          </Button>
          <Tooltip label="Keyboard shortcuts (?)">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => setShortcutHelpOpen(true)}
              aria-label="Keyboard shortcuts"
            >
              <IconKeyboard size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Stack>

      <Tabs value={activeTab} onChange={setActiveTab} aria-label="Admin panel sections">
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>
          <Tabs.Tab value="media">Media</Tabs.Tab>
          <Tabs.Tab value="layouts">Layouts</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="audit">Audit</Tabs.Tab>
          <Tabs.Tab value="analytics">Analytics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="campaigns" pt="md">
          {/* P18-H: Category filter pills */}
          {campaignCategories.length > 0 && (
            <Chip.Group multiple={false} value={categoryFilter ?? ''} onChange={(v) => setCategoryFilter(v || null)}>
              <Group gap="xs" mb="sm" wrap="wrap">
                <Chip value="" variant="light" size="sm">All</Chip>
                {campaignCategories.map((cat) => (
                  <Chip key={cat.id} value={cat.name} variant="light" size="sm">{cat.name}</Chip>
                ))}
              </Group>
            </Chip.Group>
          )}
          <CampaignsTab
            isLoading={isLoading}
            error={error}
            campaignsRows={campaignsRows}
            selectMode={selectMode}
            selectedCount={selectedCampaignIds.size}
            totalCount={campaigns.length}
            onToggleSelectMode={handleToggleSelectMode}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />
          {selectMode && selectedCampaignIds.size > 0 && (() => {
            const selectedCampaigns = campaigns.filter((c) => selectedCampaignIds.has(String(c.id)));
            const allArchived = selectedCampaigns.every((c) => c.status === 'archived');
            return (
              <BulkActionsBar
                selectedCount={selectedCampaignIds.size}
                allSelectedArchived={allArchived}
                isLoading={isBulkLoading}
                onArchive={handleBulkArchive}
                onRestore={handleBulkRestore}
                onClearSelection={handleDeselectAll}
              />
            );
          })()}
        </Tabs.Panel>

        {/* Campaign Form Modal */}
        <CampaignFormModal
          opened={campaignFormOpen}
          editingCampaign={editingCampaign}
          formState={formState}
          onFormChange={dispatchFormState}
          onClose={closeCampaignForm}
          onSave={saveCampaign}
          isSaving={isSavingCampaign}
          onGoToMedia={(campaignId) => {
            setMediaCampaignId(campaignId);
            closeCampaignForm();
            setActiveTab('media');
          }}
          layoutTemplates={layoutTemplates ?? []}
          onEditLayout={(templateId) => {
            closeCampaignForm();
            setPendingEditLayoutId(templateId);
            setActiveTab('layouts');
          }}
          availableCategories={availableCategoryNames}
        />

        <Tabs.Panel value="media" pt="md">
          <Group mb="md" justify="space-between" wrap="wrap" gap="sm">
            <CampaignSelector
              data={campaignSelectData}
              value={mediaCampaignId}
              onChange={setMediaCampaignId}
              style={{ minWidth: 200, flex: '1 1 200px' }}
            />
            <Button
              variant="outline"
              leftSection={<IconRefresh size={18} />}
              loading={rescanAllLoading}
              style={{ flex: '0 0 auto' }}
              onClick={async () => {
                setRescanAllLoading(true);
                try {
                  const result = await apiClient.post<{ message: string; campaigns_updated: number; media_updated: number }>(
                    '/wp-json/wp-super-gallery/v1/media/rescan-all',
                    {},
                  );
                  onNotify({
                    type: 'success',
                    text: result.media_updated > 0
                      ? `Rescanned: ${result.media_updated} media items updated across ${result.campaigns_updated} campaigns.`
                      : 'All media types are correct.',
                  });
                  onCampaignsUpdated();
                } catch (err) {
                  onNotify({ type: 'error', text: (err as Error).message });
                } finally {
                  setRescanAllLoading(false);
                }
              }}
            >
              Rescan All Campaigns
            </Button>
          </Group>
          <Suspense fallback={<Center py="md"><Loader /></Center>}>
            <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} onCampaignsUpdated={onCampaignsUpdated} />
          </Suspense>
        </Tabs.Panel>

        <Tabs.Panel value="layouts" pt="md">
          <LayoutTemplateList
            apiClient={apiClient}
            onNotify={onNotify}
            initialTemplateId={pendingEditLayoutId ?? undefined}
          />
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
          <AccessTab
            accessViewMode={accessViewMode}
            onAccessViewModeChange={(v) => setAccessViewMode(v)}
            campaignSelectData={campaignSelectData}
            accessCampaignId={accessCampaignId}
            onAccessCampaignChange={setAccessCampaignId}
            companySelectData={companySelectData}
            selectedCompanyId={selectedCompanyId}
            onSelectedCompanyChange={setSelectedCompanyId}
            companiesLoading={companiesLoading}
            selectedCampaign={selectedCampaign}
            selectedCompany={selectedCompany}
            accessEntriesCount={accessEntries.length}
            accessLoading={accessLoading}
            accessRows={accessRows}
            onArchiveCompanyClick={(company) => setConfirmArchiveCompany(company)}
            userCombobox={userCombobox}
            userSearchResults={userSearchResults}
            userSearchQuery={userSearchQuery}
            userSearchLoading={userSearchLoading}
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            setUserSearchQuery={setUserSearchQuery}
            setAccessUserId={setAccessUserId}
            accessUserId={accessUserId}
            blurTimeoutRef={blurTimeoutRef}
            accessSource={accessSource}
            onAccessSourceChange={setAccessSource}
            accessAction={accessAction}
            onAccessActionChange={setAccessAction}
            onGrantAccess={handleGrantAccess}
            accessSaving={accessSaving}
            onQuickAddUser={() => {
              if (accessViewMode === 'campaign' && accessCampaignId) {
                setQuickAddCampaignId(accessCampaignId);
              }
              setQuickAddUserOpen(true);
            }}
            apiClient={apiClient}
          />
        </Tabs.Panel>

        <Tabs.Panel value="audit" pt="md" component="section" aria-labelledby="audit-heading">
          <AuditTab
            campaignSelectData={campaignSelectData}
            auditCampaignId={auditCampaignId}
            onAuditCampaignChange={(v) => setAuditCampaignId(v ?? '')}
            auditLoading={auditLoading}
            auditEntriesCount={auditEntries.length}
            auditRows={auditRows}
          />
        </Tabs.Panel>

        <Tabs.Panel value="analytics" pt="md">
          <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
            <AnalyticsDashboard
              apiClient={apiClient}
              campaigns={campaignSelectData}
            />
          </Suspense>
        </Tabs.Panel>
      </Tabs>

      <AdminCampaignArchiveModal
        opened={!!confirmArchive}
        campaign={confirmArchive ? { id: confirmArchive.id, title: confirmArchive.title } : null}
        onClose={() => setConfirmArchive(null)}
        onConfirm={async () => {
          if (confirmArchive) {
            setConfirmArchive(null);
            await archiveCampaign(confirmArchive);
          }
        }}
      />

      <AdminCampaignRestoreModal
        opened={!!confirmRestore}
        campaign={confirmRestore ? { id: confirmRestore.id, title: confirmRestore.title } : null}
        onClose={() => setConfirmRestore(null)}
        onConfirm={async () => {
          if (confirmRestore) {
            setConfirmRestore(null);
            await restoreCampaign(confirmRestore);
          }
        }}
      />

      <ArchiveCompanyModal
        opened={!!confirmArchiveCompany}
        company={confirmArchiveCompany}
        archiveRevokeAccess={archiveRevokeAccess}
        onArchiveRevokeAccessChange={setArchiveRevokeAccess}
        onClose={() => {
          setConfirmArchiveCompany(null);
          setArchiveRevokeAccess(false);
        }}
        onConfirm={handleArchiveCompany}
        accessSaving={accessSaving}
      />

      <QuickAddUserModal
        opened={quickAddUserOpen}
        onClose={closeQuickAddUser}
        quickAddResult={quickAddResult}
        quickAddEmail={quickAddEmail}
        setQuickAddEmail={setQuickAddEmail}
        quickAddName={quickAddName}
        setQuickAddName={setQuickAddName}
        quickAddRole={quickAddRole}
        setQuickAddRole={setQuickAddRole}
        quickAddCampaignId={quickAddCampaignId}
        setQuickAddCampaignId={setQuickAddCampaignId}
        quickAddTestMode={quickAddTestMode}
        setQuickAddTestMode={setQuickAddTestMode}
        campaigns={campaigns}
        onSubmit={handleQuickAddUser}
        quickAddSaving={quickAddSaving}
        onNotify={onNotify}
      />

      {/* P18-C: Campaign duplication */}
      <CampaignDuplicateModal
        source={duplicateSource}
        isSaving={isDuplicating}
        onConfirm={handleDuplicateCampaign}
        onClose={() => setDuplicateSource(null)}
      />

      {/* P18-D: Campaign import */}
      <CampaignImportModal
        opened={importModalOpen}
        isSaving={isImporting}
        onImport={handleImportCampaign}
        onClose={() => setImportModalOpen(false)}
      />

      {/* P18-E: Keyboard shortcuts help */}
      <KeyboardShortcutsModal
        opened={shortcutHelpOpen}
        onClose={() => setShortcutHelpOpen(false)}
      />
    </Card>
  );
}
