import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ApiClient, CampaignTemplate } from '@/services/apiClient';
import { Tabs, Button, Group, Card, Title, ActionIcon, Center, Loader, Chip, Tooltip, Select, Switch, Menu, Collapse, Badge, Box, FileButton } from '@mantine/core';
import { useReloadSafeView } from '@/hooks/useReloadSafeView';
import { IconPlus, IconArrowLeft, IconFileImport, IconKeyboard, IconSettings, IconDotsVertical, IconAdjustments, IconStack2 } from '@tabler/icons-react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CampaignsTab } from './CampaignsTab';
import { CampaignsMobileList } from './CampaignsMobileList';
import { BulkActionsBar } from './BulkActionsBar';
import { AuditTab } from './AuditTab';
import { GlobalAuditTab } from './GlobalAuditTab';
import { AccessTab } from './AccessTab';
import { LayoutTemplateList } from './LayoutTemplateList';
import { TemplatePickerModal } from './TemplatePickerModal';
import { TemplatesTab } from './TemplatesTab';
import { CampaignSelector } from '@/components/Common/CampaignSelector';
import { SpaceSelector } from '@/components/Common/SpaceSelector';
import type { SpaceSelectItem } from '@/components/Common/SpaceSelector';
import {
  useAdminCampaigns, useAllCampaignOptions, useAccessGrants, useAccessSummary, useCompanies, useAuditEntries,
  useGlobalAuditEntries, useSpaces,
  useCampaignCategories, useCampaignTags,
  prefetchAllCampaignMedia, prefetchAllCampaignAccess, prefetchAllCampaignAudit,
  getAdminCampaignOptionsQueryKey,
} from '@/services/adminQuery';
import type { AccessSummaryItem, AuditFilters, CampaignFilters, AdminCampaign } from '@/services/adminQuery';
import { MediaUploadController } from './MediaUploadController';
import { useAdminCampaignActions } from '@/hooks/useAdminCampaignActions';
import { useUnifiedCampaignModal } from '@/hooks/useUnifiedCampaignModal';
import { UnifiedCampaignModal } from '@/components/Campaign/UnifiedCampaignModal';
import { useAdminAccessState } from '@/hooks/useAdminAccessState';
import { useCampaignsRows } from '@/hooks/useCampaignsRows';
import { useAccessRows } from '@/hooks/useAccessRows';
import { useAuditRows } from '@/hooks/useAuditRows';
import { useLayoutTemplates } from '@/services/layoutTemplateQuery';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { spaceColor } from '@wp-super-gallery/shared-utils';
import { useAuth } from '@/hooks/useAuth';


const MediaTab = lazy(() => import('./MediaTab'));
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const CampaignDuplicateModal = lazy(() => import('./CampaignDuplicateModal').then((m) => ({ default: m.CampaignDuplicateModal })));
const CampaignMoveSpaceModal = lazy(() => import('./CampaignMoveSpaceModal').then((m) => ({ default: m.CampaignMoveSpaceModal })));
const CampaignImportModal = lazy(() => import('./CampaignImportModal').then((m) => ({ default: m.CampaignImportModal })));
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const AdminCampaignArchiveModal = lazy(() => import('./AdminCampaignArchiveModal').then((m) => ({ default: m.AdminCampaignArchiveModal })));
const AdminCampaignRestoreModal = lazy(() => import('./AdminCampaignRestoreModal').then((m) => ({ default: m.AdminCampaignRestoreModal })));
const AdminCampaignDeleteModal = lazy(() => import('./AdminCampaignDeleteModal').then((m) => ({ default: m.AdminCampaignDeleteModal })));
const AdminCampaignBulkDeleteModal = lazy(() => import('./AdminCampaignBulkDeleteModal').then((m) => ({ default: m.AdminCampaignBulkDeleteModal })));
const AdminCampaignBulkConfirmModal = lazy(() => import('./AdminCampaignBulkConfirmModal').then((m) => ({ default: m.AdminCampaignBulkConfirmModal })));
const ArchiveCompanyModal = lazy(() => import('./ArchiveCompanyModal').then((m) => ({ default: m.ArchiveCompanyModal })));
const QuickAddUserModal = lazy(() => import('./QuickAddUserModal').then((m) => ({ default: m.QuickAddUserModal })));
const TaxonomyManagerModal = lazy(() => import('./TaxonomyManagerModal').then((m) => ({ default: m.TaxonomyManagerModal })));
const SpaceManagementModal = lazy(() => import('./SpaceManagementModal').then((m) => ({ default: m.SpaceManagementModal })));

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  /**
   * P30-D: If set, navigate to the Layouts tab and pre-open the builder for
   * this template ID as soon as templates data is available.
   * Used when the user arrives via a shareable builder URL (?builder=<id>).
   */
  initialBuilderTemplateId?: string | undefined;
  /** P48-I: space ID string to pre-select in the space dropdown. */
  initialSpaceId?: string;
  /** P48-I: display name for the space (shown in header when a specific space is targeted). */
  spaceName?: string;
  /** P48-I: stable instance ID used to derive the per-space accent color. */
  instanceId?: string | undefined;
}

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify, initialBuilderTemplateId, initialSpaceId, spaceName, instanceId }: AdminPanelProps) {
  const color = instanceId ? spaceColor(instanceId) : undefined;
  const queryClient = useQueryClient();
  // P53-A: AdminPanel only mounts for editor-or-above (isAdmin); isSystemAdmin
  // gates the system-only surfaces (Import, ZIP/rescan, System Audit, etc.).
  const { isSystemAdmin } = useAuth();

  // P36-A: Root-scoped admin tab persistence. Migrates the old global key on
  // first use so existing tab state is not lost when upgrading from pre-P36-A.
  const legacyTabDefault = (() => {
    try {
      return localStorage.getItem('wpsg_admin_active_tab');
    } catch {
      return null;
    }
  })();
  const [activeTab, setActiveTab] = useReloadSafeView<string | null>(
    'admin_tab',
    // P30-D: deep-link takes precedence; fall through to migrated legacy value or default.
    initialBuilderTemplateId ? 'layouts' : (legacyTabDefault ?? 'campaigns'),
  );

  // One-time migration: write the legacy value to the new scoped key before
  // deleting it, so the migrated tab survives the first session even if the
  // user never changes tabs (setActiveTab is the only write path for the hook).
  useEffect(() => {
    try {
      const legacyValue = localStorage.getItem('wpsg_admin_active_tab');
      if (legacyValue !== null) {
        setActiveTab(legacyValue);
        localStorage.removeItem('wpsg_admin_active_tab');
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P53-A: a non-system-admin must never land on a system-only tab (e.g. a
  // persisted 'globalAudit' from a prior system-admin session on this browser).
  useEffect(() => {
    if (!isSystemAdmin && activeTab === 'globalAudit') {
      setActiveTab('campaigns');
    }
  }, [isSystemAdmin, activeTab, setActiveTab]);

  const [selectedSpaceId, setSelectedSpaceId] = useReloadSafeView<string>('admin_space', initialSpaceId ?? 'all');
  const [spaceManagementOpen, setSpaceManagementOpen] = useState(false);

  const [mediaCampaignId, setMediaCampaignId] = useState('');
  // P50-I: campaign targeted by the per-row "Add media" unified upload modal.
  const [addMediaCampaign, setAddMediaCampaign] = useState<AdminCampaign | null>(null);
  // P30-D: seed pendingEditLayoutId from deep-link (stable initializer only runs once)
  const [pendingEditLayoutId, setPendingEditLayoutId] = useState<string | null>(
    () => initialBuilderTemplateId ?? null,
  );
  const [accessCampaignId, setAccessCampaignId] = useState('');
  const [accessViewMode, setAccessViewMode] = useState<'campaign' | 'company' | 'all'>('campaign');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [auditCampaignId, setAuditCampaignId] = useState('');
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({});
  const [globalAuditFilters, setGlobalAuditFilters] = useState<AuditFilters & { campaignId?: string }>({});
  const [auditZipExporting, setAuditZipExporting] = useState(false);
  const [globalAuditZipExporting, setGlobalAuditZipExporting] = useState(false);
  const [mediaZipExporting, setMediaZipExporting] = useState(false);
  const [mediaZipImporting, setMediaZipImporting] = useState(false);
  const [rescanAllLoading, setRescanAllLoading] = useState(false);
  const [showExpiredGrants, setShowExpiredGrants] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<CampaignFilters['sort']>('created_desc');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [taxonomyManagerOpen, setTaxonomyManagerOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [campaignPage, setCampaignPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const CAMPAIGNS_PER_PAGE = 20;

  const campaignFilters = useMemo<CampaignFilters>(() => ({
    category: categoryFilter ?? undefined,
    tag: tagFilter ?? undefined,
    sort: sortOrder,
    includeArchived,
  }), [categoryFilter, tagFilter, sortOrder, includeArchived]);

  const { spaces, spacesLoading } = useSpaces(apiClient);
  const isAllSpaces = selectedSpaceId === 'all';

  const { campaigns, pagination: campaignPagination, campaignsLoading: isLoading, campaignsError: error, mutateCampaigns } = useAdminCampaigns(apiClient, selectedSpaceId, campaignPage, CAMPAIGNS_PER_PAGE, campaignFilters);
  const { data: accessSummaryData } = useAccessSummary(apiClient, 1, 200, isSystemAdmin);
  const allCampaigns = useAllCampaignOptions(apiClient, selectedSpaceId);
  const campaignsMutator = useCallback(async () => {
    await mutateCampaigns();
    void queryClient.invalidateQueries({ queryKey: getAdminCampaignOptionsQueryKey(apiClient, selectedSpaceId) });
  }, [mutateCampaigns, queryClient, apiClient, selectedSpaceId]);

  const { data: layoutTemplates } = useLayoutTemplates(apiClient);
  const { campaignCategories } = useCampaignCategories(apiClient);
  const { campaignTags } = useCampaignTags(apiClient);

  const accessTargetId = accessViewMode === 'campaign' ? accessCampaignId : selectedCompanyId;
  const { accessEntries, accessLoading, mutateAccess } = useAccessGrants(
    apiClient, accessViewMode, activeTab === 'access' ? accessTargetId : '', showExpiredGrants,
  );
  const companiesEnabled = activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all');
  const { companies, companiesLoading, mutateCompanies } = useCompanies(apiClient, selectedSpaceId, companiesEnabled);
  const { auditEntries, auditLoading, auditError } = useAuditEntries(apiClient, activeTab === 'audit' ? auditCampaignId : '', auditFilters);
  const { globalAuditEntries, globalAuditLoading } = useGlobalAuditEntries(apiClient, selectedSpaceId, activeTab === 'globalAudit' ? globalAuditFilters : {}, isSystemAdmin);

  // P47-J: pass the active space to the campaign modal so new campaigns get space_id set.
  const activeSpaceId = selectedSpaceId !== 'all' ? parseInt(selectedSpaceId, 10) : undefined;
  const unifiedModal = useUnifiedCampaignModal({
    apiClient, isAdmin: true, onMutate: campaignsMutator, onNotify,
    ...(activeSpaceId !== undefined && { spaceId: activeSpaceId }),
  });

  const handleTemplateSelected = useCallback((template: CampaignTemplate | null) => {
    if (!template) {
      unifiedModal.openForCreate();
      return;
    }
    const { settings } = template;
    unifiedModal.openForCreate({
      visibility: settings.visibility,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      galleryOverrides: (settings.galleryOverrides as any) ?? undefined,
      layoutTemplateId: settings.layoutTemplateId ?? '',
    });
  }, [unifiedModal]);

  const campaignActions = useAdminCampaignActions({
    apiClient, campaigns, onMutate: campaignsMutator, onCampaignsUpdated, onNotify,
    onOpenEdit: unifiedModal.openForEdit,
    onOpenCreate: () => setTemplatePickerOpen(true),
    createModalOpen: unifiedModal.opened,
  });

  const mutateAccessWrapped = useCallback(() => mutateAccess() as Promise<unknown>, [mutateAccess]);
  const mutateCompaniesWrapped = useCallback(() => mutateCompanies() as Promise<unknown>, [mutateCompanies]);

  const accessState = useAdminAccessState({
    apiClient, accessCampaignId, selectedCompanyId, accessViewMode,
    mutateAccess: mutateAccessWrapped,
    mutateCompanies: mutateCompaniesWrapped,
    mutateCampaigns: campaignsMutator,
    onNotify,
  });

  useEffect(() => {
    setMediaCampaignId('');
    setAccessCampaignId('');
    setAuditCampaignId('');
    setSelectedCompanyId('');
  }, [selectedSpaceId]);

  useEffect(() => {
    if (activeTab === 'media' && !mediaCampaignId && allCampaigns.length > 0) setMediaCampaignId(String(allCampaigns[0]!.id));
  }, [activeTab, allCampaigns, mediaCampaignId]);
  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && allCampaigns.length > 0 && accessViewMode === 'campaign') setAccessCampaignId(String(allCampaigns[0]!.id));
  }, [activeTab, accessCampaignId, allCampaigns, accessViewMode]);
  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && allCampaigns.length > 0) setAuditCampaignId(String(allCampaigns[0]!.id));
  }, [activeTab, auditCampaignId, allCampaigns]);
  useEffect(() => {
    if (activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId && companies.length > 0) setSelectedCompanyId(String(companies[0]!.id));
  }, [activeTab, accessViewMode, selectedCompanyId, companies]);

  const handleAuditZipExport = useCallback(async (
    params: Parameters<typeof apiClient.startAuditLogBinaryExport>[0],
    setExporting: (v: boolean) => void,
    filename: string,
  ) => {
    setExporting(true);
    try {
      const { jobId } = await apiClient.startAuditLogBinaryExport(params);
      onNotify({ type: 'success', text: 'Building audit log ZIP — this may take a moment.' });
      try {
        const deadline = Date.now() + 300_000;
        let job = await apiClient.getExportJob(jobId);
        while (job.status === 'pending' || job.status === 'processing') {
          if (Date.now() > deadline) throw new Error('Export timed out after 5 minutes.');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          job = await apiClient.getExportJob(jobId);
        }
        if (job.status === 'failed') throw new Error(job.error ?? 'Export failed');
        await apiClient.downloadExportJob(jobId, filename);
      } finally {
        await apiClient.deleteExportJob(jobId).catch(() => undefined);
      }
    } catch (err) {
      onNotify({ type: 'error', text: (err instanceof Error ? err.message : 'Audit ZIP export failed') });
    } finally {
      setExporting(false);
    }
  }, [apiClient, onNotify]);

  const handleMediaZipExport = useCallback(async () => {
    setMediaZipExporting(true);
    try {
      const params = mediaCampaignId ? { campaignId: mediaCampaignId } : {};
      const { jobId } = await apiClient.startMediaLibraryBinaryExport(params);
      onNotify({ type: 'success', text: 'Building media library ZIP — this may take a moment.' });
      try {
        const deadline = Date.now() + 300_000;
        let job = await apiClient.getExportJob(jobId);
        while (job.status === 'pending' || job.status === 'processing') {
          if (Date.now() > deadline) throw new Error('Export timed out after 5 minutes.');
          await new Promise((resolve) => setTimeout(resolve, 3000));
          job = await apiClient.getExportJob(jobId);
        }
        if (job.status === 'failed') throw new Error(job.error ?? 'Export failed');
        await apiClient.downloadExportJob(jobId, `media-library-${Date.now()}.zip`);
      } finally {
        await apiClient.deleteExportJob(jobId).catch(() => undefined);
      }
    } catch (err) {
      onNotify({ type: 'error', text: (err instanceof Error ? err.message : 'Media ZIP export failed') });
    } finally {
      setMediaZipExporting(false);
    }
  }, [apiClient, mediaCampaignId, onNotify]);

  const handleMediaZipImport = useCallback(async (file: File) => {
    setMediaZipImporting(true);
    try {
      const result = await apiClient.importMediaLibraryBinary(file);
      const msg = `Imported ${result.imported.length} media item${result.imported.length !== 1 ? 's' : ''}${result.skipped.length > 0 ? ` (${result.skipped.length} skipped)` : ''}.`;
      onNotify({ type: 'success', text: msg });
    } catch (err) {
      onNotify({ type: 'error', text: (err instanceof Error ? err.message : 'Media ZIP import failed') });
    } finally {
      setMediaZipImporting(false);
    }
  }, [apiClient, onNotify]);

  const mediaPrefetchedRef = useRef(false);
  const accessPrefetchedRef = useRef(false);
  const auditPrefetchedRef = useRef(false);
  const cancelMediaRef = useRef<(() => void) | null>(null);
  const cancelAccessRef = useRef<(() => void) | null>(null);
  const cancelAuditRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (activeTab === 'media' && allCampaigns.length > 0 && !mediaPrefetchedRef.current) {
      mediaPrefetchedRef.current = true;
      cancelMediaRef.current = prefetchAllCampaignMedia(apiClient, allCampaigns.map((c) => String(c.id)), queryClient);
    }
  }, [activeTab, allCampaigns, apiClient, queryClient]);
  useEffect(() => {
    if (activeTab === 'access' && allCampaigns.length > 0 && !accessPrefetchedRef.current) {
      accessPrefetchedRef.current = true;
      cancelAccessRef.current = prefetchAllCampaignAccess(apiClient, allCampaigns.map((c) => String(c.id)), queryClient);
    }
  }, [activeTab, allCampaigns, apiClient, queryClient]);
  useEffect(() => {
    if (activeTab === 'audit' && allCampaigns.length > 0 && !auditPrefetchedRef.current) {
      auditPrefetchedRef.current = true;
      cancelAuditRef.current = prefetchAllCampaignAudit(apiClient, allCampaigns.map((c) => String(c.id)), queryClient);
    }
  }, [activeTab, allCampaigns, apiClient, queryClient]);
  useEffect(() => () => { cancelMediaRef.current?.(); cancelAccessRef.current?.(); cancelAuditRef.current?.(); }, []);

  const spaceSelectData = useMemo<SpaceSelectItem[]>(() => [
    { value: 'all', label: 'All spaces' },
    ...spaces
      .filter((s) => !s.archived)
      .map((s) => ({ value: String(s.id), label: s.isDefault ? `${s.name} (default)` : s.name })),
  ], [spaces]);

  const campaignSelectData = useMemo(
    () => allCampaigns.map((c) => ({ value: String(c.id), label: c.companyId ? `${c.title} (${c.companyId})` : c.title })),
    [allCampaigns],
  );
  const companySelectData = useMemo(
    () => companies.map((c) => ({ value: String(c.id), label: `${c.name} (${c.activeCampaigns} active, ${c.archivedCampaigns} archived)` })),
    [companies],
  );
  const selectedCampaign = useMemo(
    () => allCampaigns.find((c) => String(c.id) === String(accessCampaignId)) ?? null,
    [accessCampaignId, allCampaigns],
  );
  const selectedCompany = useMemo(
    () => companies.find((c) => String(c.id) === selectedCompanyId) ?? null,
    [selectedCompanyId, companies],
  );

  // Reset to page 1 whenever any filter changes.
  useEffect(() => { setCampaignPage(1); }, [categoryFilter, tagFilter, sortOrder, includeArchived]);
  // Clamp page into [1, totalPages] when dataset shrinks (deletions, server-side changes).
  useEffect(() => {
    if (campaignPagination.totalPages > 0 && campaignPage > campaignPagination.totalPages) {
      setCampaignPage(campaignPagination.totalPages);
    }
  }, [campaignPage, campaignPagination.totalPages]);

  const grantSummary = useMemo<Map<number, AccessSummaryItem> | undefined>(() => {
    if (!accessSummaryData) return undefined;
    return new Map(accessSummaryData.items.map((item) => [item.id, item]));
  }, [accessSummaryData]);

  const nullRef = useRef<HTMLElement>(null);
  const { breakpoint } = useBreakpoint(nullRef, { source: 'viewport' });
  const isMobile = breakpoint === 'mobile';

  const activeFilterCount = [
    categoryFilter !== null,
    tagFilter !== null,
    sortOrder !== 'created_desc',
    includeArchived,
  ].filter(Boolean).length;

  // P50-A: move is offered only when a specific owned space is selected and
  // another owned, active space exists as a destination.
  const activeSpace = activeSpaceId !== undefined ? spaces.find((s) => s.id === activeSpaceId) ?? null : null;
  const canMoveCampaigns = !!activeSpace
    && activeSpace.effectiveLevel === 'owner'
    && spaces.some((s) => !s.archived && s.effectiveLevel === 'owner' && s.id !== activeSpace.id);

  const campaignsRows = useCampaignsRows({ campaigns, campaignActions, grantSummary, apiClient, canMoveCampaigns, onAddMedia: setAddMediaCampaign });
  const accessRows = useAccessRows({ accessEntries, accessViewMode, onRevokeAccess: accessState.handleRevokeAccess, onChangeRole: accessState.handleChangeRole });
  const auditRows = useAuditRows(auditEntries);

  return (
    <Card {...getWpsgDebugProps('AdminPanel')} shadow="sm" radius="md" withBorder tabIndex={-1} onKeyDown={campaignActions.hotkeyHandler} style={{ outline: 'none' }}>
      <Group {...getWpsgDebugProps('AdminPanel', 'header')} justify="space-between" wrap="wrap" gap="sm" mb="md">
        <Group>
          <ActionIcon variant="light" size="lg" onClick={onClose} aria-label="Back to gallery">
            <IconArrowLeft />
          </ActionIcon>
          <Title order={2} size="h3">Admin Panel</Title>
          {spaceName && <Badge color={color ?? 'blue'} variant="light" size="sm">{spaceName}</Badge>}
        </Group>
        <Group gap="xs" wrap="wrap">
          {spaces.length > 0 && (
            <SpaceSelector
              data={spaceSelectData}
              value={selectedSpaceId}
              onChange={setSelectedSpaceId}
              size="xs"
              w={160}
              disabled={spacesLoading}
            />
          )}
          {isMobile ? (
            <Menu shadow="md" width={200} position="bottom-end">
              <Menu.Target>
                <ActionIcon variant="light" size="lg" aria-label="Actions menu">
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPlus size={14} />} onClick={campaignActions.handleCreate} disabled={isAllSpaces}>
                  New Campaign
                </Menu.Item>
                {isSystemAdmin && (
                  <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => campaignActions.setImportModalOpen(true)} disabled={isAllSpaces}>
                    Import
                  </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item leftSection={<IconStack2 size={14} />} onClick={() => setSpaceManagementOpen(true)}>
                  Manage spaces
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconKeyboard size={14} />} onClick={() => campaignActions.setShortcutHelpOpen(true)}>
                  Keyboard shortcuts
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <>
              <Tooltip label={isAllSpaces ? 'Pick a space first' : 'Create new campaign'}>
                <Button leftSection={<IconPlus />} onClick={campaignActions.handleCreate} size="sm" aria-label="Create new campaign" disabled={isAllSpaces}>
                  New Campaign
                </Button>
              </Tooltip>
              {isSystemAdmin && (
                <Tooltip label={isAllSpaces ? 'Pick a space first' : 'Import campaigns'}>
                  <Button variant="outline" leftSection={<IconFileImport size={16} />} onClick={() => campaignActions.setImportModalOpen(true)} size="sm" disabled={isAllSpaces}>
                    Import
                  </Button>
                </Tooltip>
              )}
              <Tooltip label="Manage spaces">
                <ActionIcon variant="subtle" size="lg" onClick={() => setSpaceManagementOpen(true)} aria-label="Manage spaces">
                  <IconStack2 size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Keyboard shortcuts (?)">
                <ActionIcon variant="subtle" size="lg" onClick={() => campaignActions.setShortcutHelpOpen(true)} aria-label="Keyboard shortcuts">
                  <IconKeyboard size={18} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      </Group>

      <Tabs {...getWpsgDebugProps('AdminPanel', 'tabs')} value={activeTab} onChange={setActiveTab}>
        {isMobile ? (
          <Select
            {...getWpsgDebugProps('AdminPanel', 'tab-select')}
            value={activeTab ?? 'campaigns'}
            onChange={(v) => setActiveTab(v)}
            data={[
              { value: 'campaigns', label: 'Campaigns' },
              { value: 'media', label: 'Media' },
              { value: 'layouts', label: 'Layouts' },
              { value: 'templates', label: 'Templates' },
              { value: 'access', label: 'Access' },
              { value: 'audit', label: 'Campaign Activity' },
              // P53-A: System Audit is system-admin only.
              ...(isSystemAdmin ? [{ value: 'globalAudit', label: 'System Audit' }] : []),
              { value: 'analytics', label: 'Analytics' },
            ]}
            mb="sm"
            aria-label="Select admin panel tab"
          />
        ) : (
          <Tabs.List {...getWpsgDebugProps('AdminPanel', 'tab-list')} style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
            <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>
            <Tabs.Tab value="media">Media</Tabs.Tab>
            <Tabs.Tab value="layouts">Layouts</Tabs.Tab>
            <Tabs.Tab value="templates">Templates</Tabs.Tab>
            <Tabs.Tab value="access">Access</Tabs.Tab>
            <Tabs.Tab value="audit">Campaign Activity</Tabs.Tab>
            {isSystemAdmin && <Tabs.Tab value="globalAudit">System Audit</Tabs.Tab>}
            <Tabs.Tab value="analytics">Analytics</Tabs.Tab>
          </Tabs.List>
        )}

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'campaigns-panel')} value="campaigns" pt="md">
          <Group justify="space-between" align="flex-start" mb="sm" wrap="wrap" gap="sm">
            <Box style={{ flex: '1 1 auto' }}>
              {isMobile && (
                <Button
                  variant="subtle"
                  size="xs"
                  mb="xs"
                  leftSection={<IconAdjustments size={14} />}
                  rightSection={activeFilterCount > 0 ? <Badge size="xs" circle color="blue">{activeFilterCount}</Badge> : null}
                  onClick={() => setFiltersOpen((o) => !o)}
                  aria-expanded={filtersOpen}
                >
                  {filtersOpen ? 'Hide filters' : `Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
                </Button>
              )}
              <Collapse expanded={!isMobile || filtersOpen}>
                <Group gap="xs" wrap="wrap">
                  {campaignCategories.length > 0 && (
                    <Chip.Group multiple={false} value={categoryFilter ?? ''} onChange={(v) => setCategoryFilter(v || null)}>
                      <Group gap="xs" wrap="wrap">
                        <Chip value="" variant="light" size="sm">All</Chip>
                        {campaignCategories.map((cat) => (
                          <Chip key={cat.id} value={cat.slug} variant="light" size="sm">{cat.name}</Chip>
                        ))}
                      </Group>
                    </Chip.Group>
                  )}
                  {campaignTags.length > 0 && (
                    <Select
                      size="xs"
                      placeholder="Tag"
                      clearable
                      data={campaignTags.map((t) => ({ value: t.slug, label: t.name }))}
                      value={tagFilter}
                      onChange={setTagFilter}
                      style={{ minWidth: 120 }}
                    />
                  )}
                  <Select
                    size="xs"
                    data={[
                      { value: 'created_desc', label: 'Newest first' },
                      { value: 'created_asc', label: 'Oldest first' },
                      { value: 'title_asc', label: 'Title A–Z' },
                      { value: 'title_desc', label: 'Title Z–A' },
                      { value: 'updated_desc', label: 'Recently updated' },
                    ]}
                    value={sortOrder ?? 'created_desc'}
                    onChange={(v) => setSortOrder((v as CampaignFilters['sort']) ?? 'created_desc')}
                    style={{ minWidth: 150 }}
                  />
                  <Switch
                    size="sm"
                    label="Include archived"
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.currentTarget.checked)}
                  />
                </Group>
              </Collapse>
            </Box>
            <Tooltip label="Manage categories & tags">
              <ActionIcon variant="subtle" size="sm" onClick={() => setTaxonomyManagerOpen(true)} aria-label="Manage taxonomy">
                <IconSettings size={16} />
              </ActionIcon>
            </Tooltip>
          </Group>
          {isMobile ? (
            <CampaignsMobileList
              isLoading={isLoading}
              error={error}
              campaigns={campaigns}
              campaignActions={campaignActions}
              grantSummary={grantSummary}
              page={campaignPagination.page}
              totalPages={campaignPagination.totalPages}
              total={campaignPagination.total}
              onPageChange={setCampaignPage}
            />
          ) : (
            <CampaignsTab
              isLoading={isLoading}
              error={error}
              campaignsRows={campaignsRows}
              selectedCount={campaignActions.selectedCampaignIds.size}
              totalCount={campaigns.length}
              onSelectAll={() => campaignActions.handleSelectAll(campaigns.map((c) => String(c.id)))}
              onDeselectAll={campaignActions.handleDeselectAll}
              page={campaignPagination.page}
              totalPages={campaignPagination.totalPages}
              total={campaignPagination.total}
              onPageChange={setCampaignPage}
            />
          )}
          {campaignActions.selectedCampaignIds.size > 0 && (() => {
            const sel = campaigns.filter((c) => campaignActions.selectedCampaignIds.has(String(c.id)));
            return (
              <BulkActionsBar
                selectedCount={campaignActions.selectedCampaignIds.size}
                hasActiveSelected={sel.some((c) => c.status !== 'archived')}
                hasArchivedSelected={sel.some((c) => c.status === 'archived')}
                isLoading={campaignActions.isBulkLoading}
                isExporting={campaignActions.isBulkExporting}
                onArchive={() => campaignActions.setConfirmBulkArchive(true)}
                onRestore={() => campaignActions.setConfirmBulkRestore(true)}
                onExport={campaignActions.handleBulkBinaryExport}
                onDelete={() => campaignActions.setConfirmBulkDelete(true)}
                onClearSelection={campaignActions.handleDeselectAll}
              />
            );
          })()}
        </Tabs.Panel>

        <TemplatePickerModal
          opened={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          apiClient={apiClient}
          onSelect={handleTemplateSelected}
        />

        <UnifiedCampaignModal
          modal={unifiedModal}
          layoutTemplates={layoutTemplates ?? []}
          onEditLayout={(id) => { unifiedModal.close(); setPendingEditLayoutId(id); setActiveTab('layouts'); }}
          categoryItems={campaignCategories}
        />

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'media-panel')} value="media" pt="md">
          <Group mb="md" justify="space-between" wrap="wrap" gap="sm">
            <CampaignSelector data={campaignSelectData} value={mediaCampaignId} onChange={setMediaCampaignId} style={{ minWidth: 200, flex: '1 1 200px' }} />
            {/* P53-A: library-wide media tools (binary export/import, cross-space rescan) are system-admin only. */}
            {isSystemAdmin && (
              <>
                <Button
                  size="sm"
                  variant="light"
                  loading={mediaZipExporting}
                  style={{ flex: '0 0 auto' }}
                  onClick={handleMediaZipExport}
                  aria-label="Export media library as ZIP"
                >
                  Export ZIP
                </Button>
                <FileButton
                  onChange={(file) => { if (file) handleMediaZipImport(file); }}
                  accept=".zip,application/zip"
                >
                  {(props) => (
                    <Button
                      {...props}
                      size="sm"
                      variant="light"
                      loading={mediaZipImporting}
                      style={{ flex: '0 0 auto' }}
                      aria-label="Import media library from ZIP"
                    >
                      Import ZIP
                    </Button>
                  )}
                </FileButton>
                <Button
                  variant="outline"
                  loading={rescanAllLoading}
                  style={{ flex: '0 0 auto' }}
                  onClick={async () => {
                    setRescanAllLoading(true);
                    try {
                      const result = await apiClient.post<{ message: string; campaigns_updated: number; media_updated: number }>(
                        '/wp-json/wp-super-gallery/v1/media/rescan-all', {},
                      );
                      onNotify({
                        type: 'success', text: result.media_updated > 0
                          ? `Rescanned: ${result.media_updated} media items updated across ${result.campaigns_updated} campaigns.`
                          : 'All media types are correct.'
                      });
                      onCampaignsUpdated();
                    } catch (err) { onNotify({ type: 'error', text: (err as Error).message }); }
                    finally { setRescanAllLoading(false); }
                  }}
                >
                  Rescan All
                </Button>
              </>
            )}
          </Group>
          <ErrorBoundary>
            <Suspense fallback={<Center py="md"><Loader /></Center>}>
              <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} onCampaignsUpdated={onCampaignsUpdated} />
            </Suspense>
          </ErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'layouts-panel')} value="layouts" pt="md">
          <LayoutTemplateList apiClient={apiClient} onNotify={onNotify} initialTemplateId={pendingEditLayoutId ?? undefined} spaceId={selectedSpaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab apiClient={apiClient} campaigns={allCampaigns} onNotify={onNotify} />
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'access-panel')} value="access" pt="md">
          <AccessTab
            accessViewMode={accessViewMode}
            onAccessViewModeChange={setAccessViewMode}
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
            accessState={accessState}
            apiClient={apiClient}
            showExpiredGrants={showExpiredGrants}
            onShowExpiredGrantsChange={setShowExpiredGrants}
            isMobile={isMobile}
            isSystemAdmin={isSystemAdmin}
          />
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'audit-panel')} value="audit" pt="md" component="section">
          <AuditTab
            campaignSelectData={campaignSelectData}
            auditCampaignId={auditCampaignId}
            onAuditCampaignChange={(v) => setAuditCampaignId(v ?? '')}
            auditLoading={auditLoading}
            auditEntriesCount={auditEntries.length}
            auditRows={auditRows}
            filters={auditFilters}
            onFiltersChange={setAuditFilters}
            auditError={auditError}
            onExportCsv={() => apiClient.downloadGlobalAuditCsv({ campaignId: auditCampaignId, ...auditFilters })}
            onExportZip={() => handleAuditZipExport({
              ...(auditCampaignId ? { campaignId: auditCampaignId } : {}),
              ...(auditFilters.from ? { from: auditFilters.from } : {}),
              ...(auditFilters.to ? { to: auditFilters.to } : {}),
              ...(auditFilters.action ? { action: auditFilters.action } : {}),
              ...(auditFilters.scope ? { scope: auditFilters.scope } : {}),
              ...(auditFilters.severity ? { severity: auditFilters.severity } : {}),
            }, setAuditZipExporting, `audit-log-${Date.now()}.zip`)}
            exportingZip={auditZipExporting}
          />
        </Tabs.Panel>

        <Tabs.Panel value="globalAudit" pt="md" component="section">
          {isSystemAdmin && <GlobalAuditTab
            entries={globalAuditEntries}
            loading={globalAuditLoading}
            filters={globalAuditFilters}
            onFiltersChange={setGlobalAuditFilters}
            onExportCsv={() => apiClient.downloadGlobalAuditCsv(globalAuditFilters)}
            onExportZip={() => handleAuditZipExport({
              ...(globalAuditFilters.campaignId ? { campaignId: globalAuditFilters.campaignId } : {}),
              ...(globalAuditFilters.from ? { from: globalAuditFilters.from } : {}),
              ...(globalAuditFilters.to ? { to: globalAuditFilters.to } : {}),
              ...(globalAuditFilters.action ? { action: globalAuditFilters.action } : {}),
              ...(globalAuditFilters.scope ? { scope: globalAuditFilters.scope } : {}),
              ...(globalAuditFilters.severity ? { severity: globalAuditFilters.severity } : {}),
            }, setGlobalAuditZipExporting, `global-audit-log-${Date.now()}.zip`)}
            exportingZip={globalAuditZipExporting}
          />}
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'analytics-panel')} value="analytics" pt="md">
          <ErrorBoundary>
            <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
              <AnalyticsDashboard apiClient={apiClient} campaigns={campaignSelectData} isSystemAdmin={isSystemAdmin} />
            </Suspense>
          </ErrorBoundary>
        </Tabs.Panel>
      </Tabs>

      {!!campaignActions.confirmArchive && (
        <Suspense fallback={null}>
          <AdminCampaignArchiveModal
            opened={!!campaignActions.confirmArchive}
            campaign={campaignActions.confirmArchive ? { id: campaignActions.confirmArchive.id, title: campaignActions.confirmArchive.title } : null}
            onClose={() => campaignActions.setConfirmArchive(null)}
            onConfirm={async () => {
              if (campaignActions.confirmArchive) { campaignActions.setConfirmArchive(null); await campaignActions.archiveCampaign(campaignActions.confirmArchive); }
            }}
          />
        </Suspense>
      )}
      {!!campaignActions.confirmRestore && (
        <Suspense fallback={null}>
          <AdminCampaignRestoreModal
            opened={!!campaignActions.confirmRestore}
            campaign={campaignActions.confirmRestore ? { id: campaignActions.confirmRestore.id, title: campaignActions.confirmRestore.title } : null}
            onClose={() => campaignActions.setConfirmRestore(null)}
            onConfirm={async () => {
              if (campaignActions.confirmRestore) { campaignActions.setConfirmRestore(null); await campaignActions.restoreCampaign(campaignActions.confirmRestore); }
            }}
          />
        </Suspense>
      )}
      {!!campaignActions.confirmDelete && (
        <Suspense fallback={null}>
          <AdminCampaignDeleteModal
            opened={!!campaignActions.confirmDelete}
            campaign={campaignActions.confirmDelete ? { id: campaignActions.confirmDelete.id, title: campaignActions.confirmDelete.title } : null}
            loading={campaignActions.confirmDelete ? campaignActions.deletingIds.has(String(campaignActions.confirmDelete.id)) : false}
            onClose={() => campaignActions.setConfirmDelete(null)}
            onConfirm={async ({ purgeAnalytics }) => {
              const target = campaignActions.confirmDelete;
              if (!target) return;
              campaignActions.setConfirmDelete(null);
              await campaignActions.deleteCampaign(target, { purgeAnalytics });
            }}
          />
        </Suspense>
      )}
      {campaignActions.confirmBulkDelete && (
        <Suspense fallback={null}>
          <AdminCampaignBulkDeleteModal
            opened={campaignActions.confirmBulkDelete}
            count={campaignActions.selectedCampaignIds.size}
            loading={campaignActions.isBulkLoading}
            onClose={() => campaignActions.setConfirmBulkDelete(false)}
            onConfirm={async (opts) => {
              campaignActions.setConfirmBulkDelete(false);
              await campaignActions.handleBulkDelete(opts);
            }}
          />
        </Suspense>
      )}
      {campaignActions.confirmBulkArchive && (
        <Suspense fallback={null}>
          <AdminCampaignBulkConfirmModal
            opened={campaignActions.confirmBulkArchive}
            action="archive"
            count={campaignActions.selectedCampaignIds.size}
            loading={campaignActions.isBulkLoading}
            onClose={() => campaignActions.setConfirmBulkArchive(false)}
            onConfirm={async () => {
              campaignActions.setConfirmBulkArchive(false);
              await campaignActions.handleBulkArchive();
            }}
          />
        </Suspense>
      )}
      {campaignActions.confirmBulkRestore && (
        <Suspense fallback={null}>
          <AdminCampaignBulkConfirmModal
            opened={campaignActions.confirmBulkRestore}
            action="restore"
            count={campaignActions.selectedCampaignIds.size}
            loading={campaignActions.isBulkLoading}
            onClose={() => campaignActions.setConfirmBulkRestore(false)}
            onConfirm={async () => {
              campaignActions.setConfirmBulkRestore(false);
              await campaignActions.handleBulkRestore();
            }}
          />
        </Suspense>
      )}
      {addMediaCampaign && (
        <MediaUploadController
          opened={!!addMediaCampaign}
          onClose={() => setAddMediaCampaign(null)}
          apiClient={apiClient}
          campaigns={allCampaigns}
          defaultTarget={String(addMediaCampaign.id)}
          onUploaded={onCampaignsUpdated}
          title={`Add media — ${addMediaCampaign.title}`}
        />
      )}
      {!!accessState.confirmArchiveCompany && (
        <Suspense fallback={null}>
          <ArchiveCompanyModal
            opened={!!accessState.confirmArchiveCompany}
            company={accessState.confirmArchiveCompany}
            archiveRevokeAccess={accessState.archiveRevokeAccess}
            onArchiveRevokeAccessChange={accessState.setArchiveRevokeAccess}
            onClose={() => { accessState.setConfirmArchiveCompany(null); accessState.setArchiveRevokeAccess(false); }}
            onConfirm={accessState.handleArchiveCompany}
            accessSaving={accessState.accessSaving}
          />
        </Suspense>
      )}
      {accessState.quickAddUserOpen && (
        <Suspense fallback={null}>
          <QuickAddUserModal
            opened={accessState.quickAddUserOpen}
            onClose={accessState.closeQuickAddUser}
            quickAddResult={accessState.quickAddResult}
            quickAddEmail={accessState.quickAddEmail}
            setQuickAddEmail={accessState.setQuickAddEmail}
            quickAddName={accessState.quickAddName}
            setQuickAddName={accessState.setQuickAddName}
            quickAddRole={accessState.quickAddRole}
            setQuickAddRole={accessState.setQuickAddRole}
            quickAddCampaignId={accessState.quickAddCampaignId}
            setQuickAddCampaignId={accessState.setQuickAddCampaignId}
            quickAddTestMode={accessState.quickAddTestMode}
            setQuickAddTestMode={accessState.setQuickAddTestMode}
            campaigns={campaigns}
            onSubmit={accessState.handleQuickAddUser}
            quickAddSaving={accessState.quickAddSaving}
            onNotify={onNotify}
          />
        </Suspense>
      )}
      {!!campaignActions.duplicateSource && (
        <Suspense fallback={null}>
          <CampaignDuplicateModal
            source={campaignActions.duplicateSource}
            isSaving={campaignActions.isDuplicating}
            onConfirm={campaignActions.handleDuplicateCampaign}
            onClose={() => campaignActions.setDuplicateSource(null)}
          />
        </Suspense>
      )}
      {!!campaignActions.moveSource && (
        <Suspense fallback={null}>
          <CampaignMoveSpaceModal
            source={campaignActions.moveSource}
            sourceSpace={activeSpace}
            spaces={spaces}
            isSaving={campaignActions.isMoving}
            onConfirm={(id, name) => void campaignActions.handleMoveCampaign(id, name)}
            onClose={() => campaignActions.setMoveSource(null)}
          />
        </Suspense>
      )}
      {campaignActions.importModalOpen && isSystemAdmin && (
        <Suspense fallback={null}>
          <CampaignImportModal
            opened={campaignActions.importModalOpen}
            isSaving={campaignActions.isImporting}
            onImport={campaignActions.handleImportCampaign}
            onImportBinary={campaignActions.handleImportCampaignBinary}
            onClose={() => campaignActions.setImportModalOpen(false)}
          />
        </Suspense>
      )}
      {campaignActions.shortcutHelpOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcutsModal
            opened={campaignActions.shortcutHelpOpen}
            onClose={() => campaignActions.setShortcutHelpOpen(false)}
            config={campaignActions.shortcutConfig}
          />
        </Suspense>
      )}
      {taxonomyManagerOpen && (
        <Suspense fallback={null}>
          <TaxonomyManagerModal
            opened={taxonomyManagerOpen}
            apiClient={apiClient}
            onClose={() => setTaxonomyManagerOpen(false)}
            onNotify={onNotify}
          />
        </Suspense>
      )}
      {spaceManagementOpen && (
        <Suspense fallback={null}>
          <SpaceManagementModal
            opened={spaceManagementOpen}
            apiClient={apiClient}
            onClose={() => setSpaceManagementOpen(false)}
            onNotify={onNotify}
            onSpacesChanged={() => void queryClient.invalidateQueries({ queryKey: ['spaces'] })}
            isSystemAdmin={isSystemAdmin}
          />
        </Suspense>
      )}
    </Card>
  );
}

setWpsgDebugDisplayName(AdminPanel, 'AdminPanel');