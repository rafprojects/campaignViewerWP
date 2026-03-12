import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ApiClient } from '@/services/apiClient';
import { Tabs, Button, Group, Card, Title, ActionIcon, Center, Loader, Chip, Tooltip } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { IconPlus, IconArrowLeft, IconFileImport, IconKeyboard } from '@tabler/icons-react';
import { CampaignFormModal } from './CampaignFormModal';
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
import useSWR from 'swr';
import type { LayoutTemplate } from '@/types';
import {
  useAdminCampaigns, useAccessGrants, useCompanies, useAuditEntries,
  prefetchAllCampaignMedia, prefetchAllCampaignAccess, prefetchAllCampaignAudit,
} from '@/hooks/useAdminSWR';
import { useAdminCampaignActions } from '@/hooks/useAdminCampaignActions';
import { useAdminAccessState } from '@/hooks/useAdminAccessState';
import { useCampaignsRows } from '@/hooks/useCampaignsRows';
import { useAccessRows } from '@/hooks/useAccessRows';
import { useAuditRows } from '@/hooks/useAuditRows';

const MediaTab = lazy(() => import('./MediaTab'));
const AnalyticsDashboard = lazy(() => import('./AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));

interface AdminPanelProps {
  apiClient: ApiClient;
  onClose: () => void;
  onCampaignsUpdated: () => void;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

export function AdminPanel({ apiClient, onClose, onCampaignsUpdated, onNotify }: AdminPanelProps) {
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
  const [rescanAllLoading, setRescanAllLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const { campaigns, campaignsLoading: isLoading, campaignsError: error, mutateCampaigns } = useAdminCampaigns(apiClient);
  const campaignsMutator = useCallback(() => mutateCampaigns() as Promise<unknown>, [mutateCampaigns]);

  const { data: layoutTemplates } = useSWR<LayoutTemplate[]>(
    'admin-layout-templates-for-form',
    () => apiClient.getLayoutTemplates(),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const { data: campaignCategories = [] } = useSWR(
    'campaign-categories',
    () => apiClient.listCampaignCategories(),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const accessTargetId = accessViewMode === 'campaign' ? accessCampaignId : selectedCompanyId;
  const { accessEntries, accessLoading, mutateAccess } = useAccessGrants(
    apiClient, accessViewMode, activeTab === 'access' ? accessTargetId : '',
  );
  const companiesEnabled = activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all');
  const { companies, companiesLoading, mutateCompanies } = useCompanies(apiClient, companiesEnabled);
  const { auditEntries, auditLoading } = useAuditEntries(apiClient, activeTab === 'audit' ? auditCampaignId : '');

  const campaignActions = useAdminCampaignActions({
    apiClient, campaigns, onMutate: campaignsMutator, onCampaignsUpdated, onNotify,
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
    if (activeTab === 'media' && !mediaCampaignId && campaigns.length > 0) setMediaCampaignId(String(campaigns[0].id));
  }, [activeTab, campaigns, mediaCampaignId]);
  useEffect(() => {
    if (activeTab === 'access' && !accessCampaignId && campaigns.length > 0 && accessViewMode === 'campaign') setAccessCampaignId(String(campaigns[0].id));
  }, [activeTab, accessCampaignId, campaigns, accessViewMode]);
  useEffect(() => {
    if (activeTab === 'audit' && !auditCampaignId && campaigns.length > 0) setAuditCampaignId(String(campaigns[0].id));
  }, [activeTab, auditCampaignId, campaigns]);
  useEffect(() => {
    if (activeTab === 'access' && (accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId && companies.length > 0) setSelectedCompanyId(String(companies[0].id));
  }, [activeTab, accessViewMode, selectedCompanyId, companies]);

  const mediaPrefetchedRef = useRef(false);
  const accessPrefetchedRef = useRef(false);
  const auditPrefetchedRef = useRef(false);
  const cancelMediaRef = useRef<(() => void) | null>(null);
  const cancelAccessRef = useRef<(() => void) | null>(null);
  const cancelAuditRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (activeTab === 'media' && campaigns.length > 0 && !mediaPrefetchedRef.current) {
      mediaPrefetchedRef.current = true;
      cancelMediaRef.current = prefetchAllCampaignMedia(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);
  useEffect(() => {
    if (activeTab === 'access' && campaigns.length > 0 && !accessPrefetchedRef.current) {
      accessPrefetchedRef.current = true;
      cancelAccessRef.current = prefetchAllCampaignAccess(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);
  useEffect(() => {
    if (activeTab === 'audit' && campaigns.length > 0 && !auditPrefetchedRef.current) {
      auditPrefetchedRef.current = true;
      cancelAuditRef.current = prefetchAllCampaignAudit(apiClient, campaigns.map((c) => String(c.id)));
    }
  }, [activeTab, campaigns, apiClient]);
  useEffect(() => () => { cancelMediaRef.current?.(); cancelAccessRef.current?.(); cancelAuditRef.current?.(); }, []);

  const campaignSelectData = useMemo(
    () => campaigns.map((c) => ({ value: String(c.id), label: c.companyId ? `${c.title} (${c.companyId})` : c.title })),
    [campaigns],
  );
  const companySelectData = useMemo(
    () => companies.map((c) => ({ value: String(c.id), label: `${c.name} (${c.activeCampaigns} active, ${c.archivedCampaigns} archived)` })),
    [companies],
  );
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => String(c.id) === String(accessCampaignId)) ?? null,
    [accessCampaignId, campaigns],
  );
  const selectedCompany = useMemo(
    () => companies.find((c) => String(c.id) === selectedCompanyId) ?? null,
    [selectedCompanyId, companies],
  );
  const availableCategoryNames = useMemo(() => campaignCategories.map((c) => c.name), [campaignCategories]);

  const filteredCampaigns = useMemo(
    () => categoryFilter ? campaigns.filter((c) => (c.categories ?? []).includes(categoryFilter)) : campaigns,
    [campaigns, categoryFilter],
  );
  const campaignsRows = useCampaignsRows({ campaigns, categoryFilter, campaignActions });
  const accessRows = useAccessRows({ accessEntries, accessViewMode, onRevokeAccess: accessState.handleRevokeAccess });
  const auditRows = useAuditRows(auditEntries);

  return (
    <Card shadow="sm" radius="md" withBorder tabIndex={-1} onKeyDown={campaignActions.hotkeyHandler} style={{ outline: 'none' }}>
      <Group justify="space-between" wrap="wrap" gap="sm" mb="md">
        <Group>
          <ActionIcon variant="light" size="lg" onClick={onClose} aria-label="Back to gallery">
            <IconArrowLeft />
          </ActionIcon>
          <Title order={2} size="h3">Admin Panel</Title>
        </Group>
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
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>
          <Tabs.Tab value="media">Media</Tabs.Tab>
          <Tabs.Tab value="layouts">Layouts</Tabs.Tab>
          <Tabs.Tab value="access">Access</Tabs.Tab>
          <Tabs.Tab value="audit">Audit</Tabs.Tab>
          <Tabs.Tab value="analytics">Analytics</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="campaigns" pt="md">
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
            selectMode={campaignActions.selectMode}
            selectedCount={campaignActions.selectedCampaignIds.size}
            totalCount={filteredCampaigns.length}
            onToggleSelectMode={campaignActions.handleToggleSelectMode}
            onSelectAll={() => campaignActions.handleSelectAll(filteredCampaigns.map((c) => String(c.id)))}
            onDeselectAll={campaignActions.handleDeselectAll}
          />
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

        <CampaignFormModal
          opened={campaignActions.campaignFormOpen}
          editingCampaign={campaignActions.editingCampaign}
          formState={campaignActions.formState}
          onFormChange={campaignActions.dispatchFormState}
          onClose={campaignActions.closeCampaignForm}
          onSave={() => campaignActions.saveCampaign(campaignActions.formState)}
          isSaving={campaignActions.isSavingCampaign}
          onGoToMedia={(id) => { setMediaCampaignId(id); campaignActions.closeCampaignForm(); setActiveTab('media'); }}
          layoutTemplates={layoutTemplates ?? []}
          onEditLayout={(id) => { campaignActions.closeCampaignForm(); setPendingEditLayoutId(id); setActiveTab('layouts'); }}
          availableCategories={availableCategoryNames}
        />

        <Tabs.Panel value="media" pt="md">
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
                  onNotify({ type: 'success', text: result.media_updated > 0
                    ? `Rescanned: ${result.media_updated} media items updated across ${result.campaigns_updated} campaigns.`
                    : 'All media types are correct.' });
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

        <Tabs.Panel value="layouts" pt="md">
          <LayoutTemplateList apiClient={apiClient} onNotify={onNotify} initialTemplateId={pendingEditLayoutId ?? undefined} />
        </Tabs.Panel>

        <Tabs.Panel value="access" pt="md">
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
            onArchiveCompanyClick={(c) => accessState.setConfirmArchiveCompany(c)}
            userCombobox={accessState.userCombobox}
            userSearchResults={accessState.userSearchResults}
            userSearchQuery={accessState.userSearchQuery}
            userSearchLoading={accessState.userSearchLoading}
            selectedUser={accessState.selectedUser}
            setSelectedUser={accessState.setSelectedUser}
            setUserSearchQuery={accessState.setUserSearchQuery}
            setAccessUserId={accessState.setAccessUserId}
            accessUserId={accessState.accessUserId}
            blurTimeoutRef={accessState.blurTimeoutRef}
            accessSource={accessState.accessSource}
            onAccessSourceChange={accessState.setAccessSource}
            accessAction={accessState.accessAction}
            onAccessActionChange={accessState.setAccessAction}
            onGrantAccess={accessState.handleGrantAccess}
            accessSaving={accessState.accessSaving}
            onQuickAddUser={() => {
              if (accessViewMode === 'campaign' && accessCampaignId) accessState.setQuickAddCampaignId(accessCampaignId);
              accessState.setQuickAddUserOpen(true);
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
          <ErrorBoundary>
            <Suspense fallback={<Center py="xl"><Loader size="sm" /></Center>}>
              <AnalyticsDashboard apiClient={apiClient} campaigns={campaignSelectData} />
            </Suspense>
          </ErrorBoundary>
        </Tabs.Panel>
      </Tabs>

      <AdminCampaignArchiveModal
        opened={!!campaignActions.confirmArchive}
        campaign={campaignActions.confirmArchive ? { id: campaignActions.confirmArchive.id, title: campaignActions.confirmArchive.title } : null}
        onClose={() => campaignActions.setConfirmArchive(null)}
        onConfirm={async () => {
          if (campaignActions.confirmArchive) { campaignActions.setConfirmArchive(null); await campaignActions.archiveCampaign(campaignActions.confirmArchive); }
        }}
      />
      <AdminCampaignRestoreModal
        opened={!!campaignActions.confirmRestore}
        campaign={campaignActions.confirmRestore ? { id: campaignActions.confirmRestore.id, title: campaignActions.confirmRestore.title } : null}
        onClose={() => campaignActions.setConfirmRestore(null)}
        onConfirm={async () => {
          if (campaignActions.confirmRestore) { campaignActions.setConfirmRestore(null); await campaignActions.restoreCampaign(campaignActions.confirmRestore); }
        }}
      />
      <ArchiveCompanyModal
        opened={!!accessState.confirmArchiveCompany}
        company={accessState.confirmArchiveCompany}
        archiveRevokeAccess={accessState.archiveRevokeAccess}
        onArchiveRevokeAccessChange={accessState.setArchiveRevokeAccess}
        onClose={() => { accessState.setConfirmArchiveCompany(null); accessState.setArchiveRevokeAccess(false); }}
        onConfirm={accessState.handleArchiveCompany}
        accessSaving={accessState.accessSaving}
      />
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
      <CampaignDuplicateModal
        source={campaignActions.duplicateSource}
        isSaving={campaignActions.isDuplicating}
        onConfirm={campaignActions.handleDuplicateCampaign}
        onClose={() => campaignActions.setDuplicateSource(null)}
      />
      <CampaignImportModal
        opened={campaignActions.importModalOpen}
        isSaving={campaignActions.isImporting}
        onImport={campaignActions.handleImportCampaign}
        onClose={() => campaignActions.setImportModalOpen(false)}
      />
      <KeyboardShortcutsModal
        opened={campaignActions.shortcutHelpOpen}
        onClose={() => campaignActions.setShortcutHelpOpen(false)}
      />
    </Card>
  );
}
