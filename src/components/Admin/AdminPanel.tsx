import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ApiClient, CampaignTemplate } from '@/services/apiClient';
import { Tabs, Button, Group, Card, Title, ActionIcon, Center, Loader, Chip, Tooltip, Select, Switch, Menu, Collapse, Badge, Box } from '@mantine/core';
import { useReloadSafeView } from '@/hooks/useReloadSafeView';
import { IconPlus, IconArrowLeft, IconFileImport, IconKeyboard, IconSettings, IconDotsVertical, IconAdjustments, IconStack2 } from '@tabler/icons-react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { CampaignsTab } from './CampaignsTab';
import { CampaignsMobileList } from './CampaignsMobileList';
import { BulkActionsBar } from './BulkActionsBar';
import { AuditPanel } from './AuditPanel';
import { GlobalAuditTab } from './GlobalAuditTab';
import { AccessPanel } from './AccessPanel';
import { MediaPanel } from './MediaPanel';
import { LayoutTemplateList } from './LayoutTemplateList';
import { TemplatePickerModal } from './TemplatePickerModal';
import { TemplatesTab } from './TemplatesTab';
import { SpaceSelector } from '@/components/Common/SpaceSelector';
import type { SpaceSelectItem } from '@/components/Common/SpaceSelector';
import {
  useAdminCampaigns, useAllCampaignOptions, useAccessSummary,
  useGlobalAuditEntries, useSpaces,
  useCampaignCategories, useCampaignTags,
  getAdminCampaignOptionsQueryKey,
} from '@/services/adminQuery';
import type { AccessSummaryItem, AuditFilters, CampaignFilters, AdminCampaign } from '@/services/adminQuery';
import { MediaUploadController } from './MediaUploadController';
import { useAdminCampaignActions } from '@/hooks/useAdminCampaignActions';
import { useAdminZipTransfers } from '@/hooks/useAdminZipTransfers';
import { useUnifiedCampaignModal } from '@/hooks/useUnifiedCampaignModal';
import { UnifiedCampaignModal } from '@/components/Campaign/UnifiedCampaignModal';
import { useCampaignsRows } from '@/hooks/useCampaignsRows';
import { useLayoutTemplates } from '@/services/layoutTemplateQuery';
import { getWpsgDebugProps, setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { spaceColor } from '@wp-super-gallery/shared-utils';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';


const GlobalAssetTab = lazy(() => import('./GlobalAssetTab'));
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
  const { t } = useTranslation('wpsg');

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

  // P50-I: campaign targeted by the per-row "Add media" unified upload modal.
  // Not media-tab-local: its setter feeds useCampaignsRows (Campaigns tab) and
  // its modal (MediaUploadController) renders at the panel root — so it stays here.
  const [addMediaCampaign, setAddMediaCampaign] = useState<AdminCampaign | null>(null);
  // P30-D: seed pendingEditLayoutId from deep-link (stable initializer only runs once)
  const [pendingEditLayoutId, setPendingEditLayoutId] = useState<string | null>(
    () => initialBuilderTemplateId ?? null,
  );
  const [globalAuditFilters, setGlobalAuditFilters] = useState<AuditFilters & { campaignId?: string }>({});
  const zipTransfers = useAdminZipTransfers({ apiClient, onNotify });
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

  // P72-E: the media/audit/access tabs each reset their own selection via
  // `key={selectedSpaceId}` on their child panels; no shared reset effect remains.

  const spaceSelectData = useMemo<SpaceSelectItem[]>(() => [
    { value: 'all', label: t('admin_all_spaces', 'All spaces') },
    ...spaces
      .filter((s) => !s.archived)
      .map((s) => ({ value: String(s.id), label: s.isDefault ? t('admin_space_default', '{{name}} (default)', { name: s.name }) : s.name })),
  ], [spaces, t]);

  const campaignSelectData = useMemo(
    () => allCampaigns.map((c) => ({ value: String(c.id), label: c.companyId ? `${c.title} (${c.companyId})` : c.title })),
    [allCampaigns],
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

  const campaignsRows = useCampaignsRows({ campaigns, campaignActions, grantSummary, apiClient, canMoveCampaigns, onAddMedia: setAddMediaCampaign, categoryItems: campaignCategories });

  return (
    <Card {...getWpsgDebugProps('AdminPanel')} shadow="sm" radius="md" withBorder tabIndex={-1} onKeyDown={campaignActions.hotkeyHandler} style={{ outline: 'none' }}>
      <Group {...getWpsgDebugProps('AdminPanel', 'header')} justify="space-between" wrap="wrap" gap="sm" mb="md">
        <Group>
          <ActionIcon variant="light" size="lg" onClick={onClose} aria-label={t('admin_back_to_gallery', 'Back to gallery')}>
            <IconArrowLeft />
          </ActionIcon>
          <Title order={2} size="h3">{t('admin_panel_title', 'Admin Panel')}</Title>
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
                <ActionIcon variant="light" size="lg" aria-label={t('admin_actions_menu', 'Actions menu')}>
                  <IconDotsVertical size={18} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconPlus size={14} />} onClick={campaignActions.handleCreate} disabled={isAllSpaces}>
                  {t('admin_new_campaign', 'New Campaign')}
                </Menu.Item>
                {isSystemAdmin && (
                  <Menu.Item leftSection={<IconFileImport size={14} />} onClick={() => campaignActions.setImportModalOpen(true)} disabled={isAllSpaces}>
                    {t('admin_import', 'Import')}
                  </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item leftSection={<IconStack2 size={14} />} onClick={() => setSpaceManagementOpen(true)}>
                  {t('admin_manage_spaces', 'Manage spaces')}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item leftSection={<IconKeyboard size={14} />} onClick={() => campaignActions.setShortcutHelpOpen(true)}>
                  {t('admin_keyboard_shortcuts', 'Keyboard shortcuts')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <>
              <Tooltip label={isAllSpaces ? t('admin_pick_space_first', 'Pick a space first') : t('admin_create_new_campaign', 'Create new campaign')}>
                <Button leftSection={<IconPlus />} onClick={campaignActions.handleCreate} size="sm" aria-label={t('admin_create_new_campaign', 'Create new campaign')} disabled={isAllSpaces}>
                  {t('admin_new_campaign', 'New Campaign')}
                </Button>
              </Tooltip>
              {isSystemAdmin && (
                <Tooltip label={isAllSpaces ? t('admin_pick_space_first', 'Pick a space first') : t('admin_import_campaigns', 'Import campaigns')}>
                  <Button variant="outline" leftSection={<IconFileImport size={16} />} onClick={() => campaignActions.setImportModalOpen(true)} size="sm" disabled={isAllSpaces}>
                    {t('admin_import', 'Import')}
                  </Button>
                </Tooltip>
              )}
              <Tooltip label={t('admin_manage_spaces', 'Manage spaces')}>
                <ActionIcon variant="subtle" size="lg" onClick={() => setSpaceManagementOpen(true)} aria-label={t('admin_manage_spaces', 'Manage spaces')}>
                  <IconStack2 size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={t('admin_keyboard_shortcuts_tooltip', 'Keyboard shortcuts (?)')}>
                <ActionIcon variant="subtle" size="lg" onClick={() => campaignActions.setShortcutHelpOpen(true)} aria-label={t('admin_keyboard_shortcuts', 'Keyboard shortcuts')}>
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
              { value: 'campaigns', label: t('admin_tab_campaigns', 'Campaigns') },
              { value: 'media', label: t('admin_tab_media', 'Media') },
              { value: 'layouts', label: t('admin_tab_layouts', 'Layouts') },
              { value: 'templates', label: t('admin_tab_templates', 'Templates') },
              { value: 'assets', label: t('admin_tab_assets', 'Assets') },
              { value: 'access', label: t('admin_tab_access', 'Access') },
              { value: 'audit', label: t('admin_tab_audit', 'Campaign Activity') },
              // P53-A: System Audit is system-admin only.
              ...(isSystemAdmin ? [{ value: 'globalAudit', label: t('admin_tab_global_audit', 'System Audit') }] : []),
              { value: 'analytics', label: t('admin_tab_analytics', 'Analytics') },
            ]}
            mb="sm"
            aria-label={t('admin_select_tab', 'Select admin panel tab')}
          />
        ) : (
          <Tabs.List {...getWpsgDebugProps('AdminPanel', 'tab-list')} style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
            <Tabs.Tab value="campaigns">{t('admin_tab_campaigns', 'Campaigns')}</Tabs.Tab>
            <Tabs.Tab value="media">{t('admin_tab_media', 'Media')}</Tabs.Tab>
            <Tabs.Tab value="layouts">{t('admin_tab_layouts', 'Layouts')}</Tabs.Tab>
            <Tabs.Tab value="templates">{t('admin_tab_templates', 'Templates')}</Tabs.Tab>
            <Tabs.Tab value="assets">{t('admin_tab_assets', 'Assets')}</Tabs.Tab>
            <Tabs.Tab value="access">{t('admin_tab_access', 'Access')}</Tabs.Tab>
            <Tabs.Tab value="audit">{t('admin_tab_audit', 'Campaign Activity')}</Tabs.Tab>
            {isSystemAdmin && <Tabs.Tab value="globalAudit">{t('admin_tab_global_audit', 'System Audit')}</Tabs.Tab>}
            <Tabs.Tab value="analytics">{t('admin_tab_analytics', 'Analytics')}</Tabs.Tab>
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
                  {filtersOpen ? t('admin_hide_filters', 'Hide filters') : (activeFilterCount > 0 ? t('admin_filters_count', 'Filters ({{count}})', { count: activeFilterCount }) : t('admin_filters', 'Filters'))}
                </Button>
              )}
              <Collapse expanded={!isMobile || filtersOpen}>
                <Group gap="xs" wrap="wrap">
                  {campaignCategories.length > 0 && (
                    <Chip.Group multiple={false} value={categoryFilter ?? ''} onChange={(v) => setCategoryFilter(v || null)}>
                      <Group gap="xs" wrap="wrap">
                        <Chip value="" variant="light" size="sm">{t('admin_filter_all', 'All')}</Chip>
                        {campaignCategories.map((cat) => (
                          <Chip key={cat.id} value={cat.slug} variant="light" size="sm">{cat.name}</Chip>
                        ))}
                      </Group>
                    </Chip.Group>
                  )}
                  {campaignTags.length > 0 && (
                    <Select
                      size="xs"
                      placeholder={t('admin_filter_tag', 'Tag')}
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
                      { value: 'created_desc', label: t('admin_sort_newest', 'Newest first') },
                      { value: 'created_asc', label: t('admin_sort_oldest', 'Oldest first') },
                      { value: 'title_asc', label: t('admin_sort_title_az', 'Title A–Z') },
                      { value: 'title_desc', label: t('admin_sort_title_za', 'Title Z–A') },
                      { value: 'updated_desc', label: t('admin_sort_recent', 'Recently updated') },
                    ]}
                    value={sortOrder ?? 'created_desc'}
                    onChange={(v) => setSortOrder((v as CampaignFilters['sort']) ?? 'created_desc')}
                    aria-label={t('admin_sort_label', 'Sort campaigns')}
                    style={{ minWidth: 150 }}
                  />
                  <Switch
                    size="sm"
                    label={t('admin_include_archived', 'Include archived')}
                    checked={includeArchived}
                    onChange={(e) => setIncludeArchived(e.currentTarget.checked)}
                  />
                </Group>
              </Collapse>
            </Box>
            <Tooltip label={t('admin_manage_taxonomy_tooltip', 'Manage categories & tags')}>
              <ActionIcon variant="subtle" size="sm" onClick={() => setTaxonomyManagerOpen(true)} aria-label={t('admin_manage_taxonomy', 'Manage taxonomy')}>
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
              onAddCampaign={isAllSpaces ? undefined : campaignActions.handleCreate}
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
          tagItems={campaignTags}
        />

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'media-panel')} value="media" pt="md">
          {/* P72-E: media tab-selection (+ rescan loading) lives in MediaPanel now;
              key={selectedSpaceId} resets it on space change. `addMediaCampaign`
              stays in AdminPanel — it's a Campaigns-tab row action, not media-local. */}
          <MediaPanel
            key={selectedSpaceId}
            active={activeTab === 'media'}
            apiClient={apiClient}
            campaignSelectData={campaignSelectData}
            zipTransfers={zipTransfers}
            onNotify={onNotify}
            onCampaignsUpdated={onCampaignsUpdated}
            isSystemAdmin={isSystemAdmin}
          />
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'layouts-panel')} value="layouts" pt="md">
          <LayoutTemplateList apiClient={apiClient} onNotify={onNotify} initialTemplateId={pendingEditLayoutId ?? undefined} spaceId={selectedSpaceId} />
        </Tabs.Panel>

        <Tabs.Panel value="templates" pt="md">
          <TemplatesTab apiClient={apiClient} campaigns={allCampaigns} onNotify={onNotify} />
        </Tabs.Panel>

        {/* P52-B: global asset library management. */}
        <Tabs.Panel value="assets" pt="md">
          <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
            <GlobalAssetTab apiClient={apiClient} onNotify={onNotify} />
          </Suspense>
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'access-panel')} value="access" pt="md">
          {/* P72-E: access tab-selection state + its two modals live in AccessPanel now;
              key={selectedSpaceId} resets that state when the space changes. */}
          <AccessPanel
            key={selectedSpaceId}
            active={activeTab === 'access'}
            apiClient={apiClient}
            selectedSpaceId={selectedSpaceId}
            allCampaigns={allCampaigns}
            campaignSelectData={campaignSelectData}
            campaigns={campaigns}
            campaignsMutator={campaignsMutator}
            onNotify={onNotify}
            isMobile={isMobile}
            isSystemAdmin={isSystemAdmin}
          />
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'audit-panel')} value="audit" pt="md" component="section">
          {/* P72-E: audit tab-selection + filter state lives in AuditPanel now;
              key={selectedSpaceId} resets that state when the space changes. */}
          <AuditPanel
            key={selectedSpaceId}
            active={activeTab === 'audit'}
            apiClient={apiClient}
            campaignSelectData={campaignSelectData}
            zipTransfers={zipTransfers}
          />
        </Tabs.Panel>

        <Tabs.Panel value="globalAudit" pt="md" component="section">
          {isSystemAdmin && <GlobalAuditTab
            entries={globalAuditEntries}
            loading={globalAuditLoading}
            filters={globalAuditFilters}
            onFiltersChange={setGlobalAuditFilters}
            onExportCsv={() => apiClient.downloadGlobalAuditCsv(globalAuditFilters)}
            onExportZip={() => zipTransfers.exportGlobalAuditZip({
              ...(globalAuditFilters.campaignId ? { campaignId: globalAuditFilters.campaignId } : {}),
              ...(globalAuditFilters.from ? { from: globalAuditFilters.from } : {}),
              ...(globalAuditFilters.to ? { to: globalAuditFilters.to } : {}),
              ...(globalAuditFilters.action ? { action: globalAuditFilters.action } : {}),
              ...(globalAuditFilters.scope ? { scope: globalAuditFilters.scope } : {}),
              ...(globalAuditFilters.severity ? { severity: globalAuditFilters.severity } : {}),
            }, `global-audit-log-${Date.now()}.zip`)}
            exportingZip={zipTransfers.globalAuditZipExporting}
          />}
        </Tabs.Panel>

        <Tabs.Panel {...getWpsgDebugProps('AdminPanel', 'analytics-panel')} value="analytics" pt="md">
          <ErrorBoundary isAdmin={true}>
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
          title={t('admin_add_media_title', 'Add media — {{title}}', { title: addMediaCampaign.title })}
        />
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