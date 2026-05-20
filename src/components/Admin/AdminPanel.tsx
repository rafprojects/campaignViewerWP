import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ApiClient, CampaignTemplate } from '@/services/apiClient';
import { Tabs, Button, Group, Card, Title, ActionIcon, Center, Loader, Chip, Tooltip, Select, Switch, Menu, Collapse, Badge, Box } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconPlus, IconArrowLeft, IconFileImport, IconKeyboard, IconSettings, IconDotsVertical, IconAdjustments } from '@tabler/icons-react';
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
import {
  useAdminCampaigns, useAllCampaignOptions, useAccessGrants, useAccessSummary, useCompanies, useAuditEntries,
  useGlobalAuditEntries,
  useCampaignCategories, useCampaignTags,
  prefetchAllCampaignMedia, prefetchAllCampaignAccess, prefetchAllCampaignAudit,
  getAdminCampaignOptionsQueryKey,
} from '@/services/adminQuery';
import type { AccessSummaryItem, AuditFilters, CampaignFilters } from '@/services/adminQuery';
import { useAdminCampaignActions } from '@/hooks/useAdminCampaignActions';
import { useUnifiedCampaignModal } from '@/hooks/useUnifiedCampaignModal';
import { UnifiedCampaignModal } from '@/components/Campaign/UnifiedCampaignModal';
import { useAdminAccessState } from '@/hooks/useAdminAccessState';
import { useCampaignsRows } from '@/hooks/useCampaignsRows';
import { useAccessRows } from '@/hooks/useAccessRows';
import { useAuditRows } from '@/hooks/useAuditRows';
import { useLayoutTemplates } from '@/services/layoutTemplateQuery';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const MediaTab = lazy(() => import('./MediaTab'));
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const CampaignDuplicateModal = lazy(() => import('./CampaignDuplicateModal').then((m) => ({ default: m.CampaignDuplicateModal })));
const CampaignImportModal = lazy(() => import('./CampaignImportModal').then((m) => ({ default: m.CampaignImportModal })));
const KeyboardShortcutsModal = lazy(() => import('./KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })));
const AdminCampaignArchiveModal = lazy(() => import('./AdminCampaignArchiveModal').then((m) => ({ default: m.AdminCampaignArchiveModal })));
const AdminCampaignRestoreModal = lazy(() => import('./AdminCampaignRestoreModal').then((m) => ({ default: m.AdminCampaignRestoreModal })));
const AdminCampaignDeleteModal = lazy(() => import('./AdminCampaignDeleteModal').then((m) => ({ default: m.AdminCampaignDeleteModal })));
const ArchiveCompanyModal = lazy(() => import('./ArchiveCompanyModal').then((m) => ({ default: m.ArchiveCompanyModal })));
const QuickAddUserModal = lazy(() => import('./QuickAddUserModal').then((m) => ({ default: m.QuickAddUserModal })));
const TaxonomyManagerModal = lazy(() => import('./TaxonomyManagerModal').then((m) => ({ default: m.TaxonomyManagerModal })));

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useLocalStorage<string | null>({
    key: 'wpsg_admin_active_tab',
    defaultValue: 'campaigns',
    getInitialValueInEffect: false,
  });
  const [mediaCampaignId, setMediaCampaignId] = useState('');
  const [pendingEditLayoutId, setPendingEditLayoutId] = useState<string | null>(null);
  const [accessCampaignId, setAccessCampaignId] = useState('');
  const [accessViewMode, setAccessViewMode] = useState<'campaign' | 'company' | 'all'>('campaign');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [auditCampaignId, setAuditCampaignId] = useState('');
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({});
  const [globalAuditFilters, setGlobalAuditFilters] = useState<AuditFilters & { campaignId?: string }>({});
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

  const { campaigns, pagination: campaignPagination, campaignsLoading: isLoading, campaignsError: error, mutateCampaigns } = useAdminCampaigns(apiClient, campaignPage, CAMPAIGNS_PER_PAGE, campaignFilters);
  const { data: accessSummaryData } = useAccessSummary(apiClient);
  const allCampaigns = useAllCampaignOptions(apiClient);
  const campaignsMutator = useCallback(async () => {
    await mutateCampaigns();
    void queryClient.invalidateQueries({ queryKey: getAdminCampaignOptionsQueryKey(apiClient) });
  }, [mutateCampaigns, queryClient, apiClient]);

  const { data: layoutTemplates } = useLayoutTemplates(apiClient);
  const { campaignCategories } = useCampaignCategories(apiClient);
  const { campaignTags } = useCampaignTags(apiClient);

  const accessTargetId = accessViewMode === 'campaign' ? accessCampaignId : selectedCompanyId;
  const { accessEntries, accessLoading, mutateAccess } = useAccessGrants(
    apiClient, accessViewMode, activeTab === 'access' ? accessTargetId : '', showExpiredGrants,
  );
  const companiesEnabled = activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all');
  const { companies, companiesLoading, mutateCompanies } = useCompanies(apiClient, companiesEnabled);
  const { auditEntries, auditLoading } = useAuditEntries(apiClient, activeTab === 'audit' ? auditCampaignId : '', auditFilters);
  const { globalAuditEntries, globalAuditLoading } = useGlobalAuditEntries(apiClient, activeTab === 'globalAudit' ? globalAuditFilters : {});

  const unifiedModal = useUnifiedCampaignModal({
    apiClient, isAdmin: true, onMutate: campaignsMutator, onNotify,
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

  const campaignsRows = useCampaignsRows({ campaigns, campaignActions, grantSummary });
  const accessRows = useAccessRows({ accessEntries, accessViewMode, onRevokeAccess: accessState.handleRevokeAccess });
  const auditRows = useAuditRows(auditEntries);

  return (
    <Card {...getWpsgDebugProps('AdminPanel')} shadow="sm" radius="md" withBorder tabIndex={-1} onKeyDown={campaignActions.hotkeyHandler} style={{ outline: 'none' }}>
      <Group {...getWpsgDebugProps('AdminPanel', 'header')} justify="space-between" wrap="wrap" gap="sm" mb="md">
        <Group>
          <ActionIcon variant="light" size="lg" onClick={onClose} aria-label="Back to gallery">
            <IconArrowLeft />
          </ActionIcon>
          <Title order={2} size="h3">Admin Panel</Title>
        </Group>
        {isMobile ? (
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="light" size="lg" aria-label="Actions menu">
                <IconDotsVertical size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPlus size={14} />} onClick={campaignActions.handleCreate}>
                New Campaign
              </Menu.Item>
              <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => campaignActions.setImportModalOpen(true)}>
                Import
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item leftSection={<IconKeyboard size={14} />} onClick={() => campaignActions.setShortcutHelpOpen(true)}>
                Keyboard shortcuts
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : (
          <Group gap="xs">
            <Button leftSection={<IconPlus />} onClick={campaignActions.handleCreate} size="sm" aria-label="Create new campaign">
              New Campaign
            </Button>
            <Button variant="outline" leftSection={<IconFileImport size={16} />} onClick={() => campaignActions.setImportModalOpen(true)} size="sm">
              Import
            </Button>
            <Tooltip label="Keyboard shortcuts (?)">
              <ActionIcon variant="subtle" size="lg" onClick={() => campaignActions.setShortcutHelpOpen(true)} aria-label="Keyboard shortcuts">
                <IconKeyboard size={18} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
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
              { value: 'audit', label: 'Audit' },
              { value: 'globalAudit', label: 'Global Audit' },
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
            <Tabs.Tab value="audit">Audit</Tabs.Tab>
            <Tabs.Tab value="globalAudit">Global Audit</Tabs.Tab>
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
              selectMode={campaignActions.selectMode}
              selectedCount={campaignActions.selectedCampaignIds.size}
              totalCount={campaigns.length}
              onToggleSelectMode={campaignActions.handleToggleSelectMode}
              onSelectAll={() => campaignActions.handleSelectAll(campaigns.map((c) => String(c.id)))}
              onDeselectAll={campaignActions.handleDeselectAll}
              page={campaignPagination.page}
              totalPages={campaignPagination.totalPages}
              total={campaignPagination.total}
              onPageChange={setCampaignPage}
            />
          )}
          {campaignActions.selectMode && campaignActions.selectedCampaignIds.size > 0 && (() => {
            const sel = campaigns.filter((c) => campaignActions.selectedCampaignIds.has(String(c.id)));
            return (
              <BulkActionsBar
                selectedCount={campaignActions.selectedCampaignIds.size}
                allSelectedArchived={sel.every((c) => c.status === 'archived')}
                isLoading={campaignActions.isBulkLoading}
                onArchive={campaignActions.handleBulkArchive}
                onRestore={campaignActions.handleBulkRestore}
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
          </Group>
          <ErrorBoundary>
            <Suspense fallback={<Center py="md"><Loader /></Center>}>
              <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} onCampaignsUpdated={onCampaignsUpdated} />
            </Suspense>
          </ErrorBoundary>
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'layouts-panel')} value="layouts" pt="md">
          <LayoutTemplateList apiClient={apiClient} onNotify={onNotify} initialTemplateId={pendingEditLayoutId ?? undefined} />
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
          />
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'audit-panel')} value="audit" pt="md" component="section" aria-labelledby="audit-heading">
          <AuditTab
            campaignSelectData={campaignSelectData}
            auditCampaignId={auditCampaignId}
            onAuditCampaignChange={(v) => setAuditCampaignId(v ?? '')}
            auditLoading={auditLoading}
            auditEntriesCount={auditEntries.length}
            auditRows={auditRows}
            filters={auditFilters}
            onFiltersChange={setAuditFilters}
            onExportCsv={() => apiClient.downloadGlobalAuditCsv({ campaignId: auditCampaignId, ...auditFilters })}
          />
        </Tabs.Panel>

        <Tabs.Panel value="globalAudit" pt="md" component="section" aria-labelledby="global-audit-heading">
          <GlobalAuditTab
            entries={globalAuditEntries}
            loading={globalAuditLoading}
            filters={globalAuditFilters}
            onFiltersChange={setGlobalAuditFilters}
            onExportCsv={() => apiClient.downloadGlobalAuditCsv(globalAuditFilters)}
          />
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'analytics-panel')} value="analytics" pt="md">
          <ErrorBoundary>
            <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
              <AnalyticsDashboard apiClient={apiClient} campaigns={campaignSelectData} />
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
      {campaignActions.importModalOpen && (
        <Suspense fallback={null}>
          <CampaignImportModal
            opened={campaignActions.importModalOpen}
            isSaving={campaignActions.isImporting}
            onImport={campaignActions.handleImportCampaign}
            onClose={() => campaignActions.setImportModalOpen(false)}
          />
        </Suspense>
      )}
      {campaignActions.shortcutHelpOpen && (
        <Suspense fallback={null}>
          <KeyboardShortcutsModal
            opened={campaignActions.shortcutHelpOpen}
            onClose={() => campaignActions.setShortcutHelpOpen(false)}
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
    </Card>
  );
}

setWpsgDebugDisplayName(AdminPanel, 'AdminPanel');