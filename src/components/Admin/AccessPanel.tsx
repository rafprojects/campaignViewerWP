import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import type { AdminCampaign } from '@/services/adminQuery';
import type { CampaignSelectItem } from '@/components/Common/CampaignSelector';
import { useAccessGrants, useCompanies, prefetchAllCampaignAccess } from '@/services/adminQuery';
import { useAdminAccessState } from '@/hooks/useAdminAccessState';
import { useAccessRows } from '@/hooks/useAccessRows';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { AccessTab } from './AccessTab';

const ArchiveCompanyModal = lazy(() => import('./ArchiveCompanyModal').then((m) => ({ default: m.ArchiveCompanyModal })));
const QuickAddUserModal = lazy(() => import('./QuickAddUserModal').then((m) => ({ default: m.QuickAddUserModal })));

interface AccessPanelProps {
  /**
   * P72-E: fetch-gating flag (`activeTab === 'access'`). Mantine v9 keeps inactive
   * `Tabs.Panel`s mounted, so the data hooks must be gated by an explicit flag
   * rather than by mount/unmount — exactly as the old inline code did.
   */
  active: boolean;
  apiClient: ApiClient;
  /** Owning space id — keys `useCompanies` (and the parent's `key` remount on change). */
  selectedSpaceId: string;
  /** Full campaign options for the space, for the campaign selector + selectedCampaign lookup. */
  allCampaigns: AdminCampaign[];
  campaignSelectData: CampaignSelectItem[];
  /** Paginated campaigns for the current page — consumed by QuickAddUserModal. */
  campaigns: AdminCampaign[];
  /** Revalidates the campaign lists after a grant/company mutation. */
  campaignsMutator: () => Promise<unknown>;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  isMobile: boolean;
  isSystemAdmin: boolean;
}

/**
 * P72-E: the Access tab, split out of AdminPanel so its view-mode / campaign /
 * company / expired-grants selection state (and the access-form state hook that
 * depends on it) live here and no longer re-render the whole panel. The two
 * access modals (ArchiveCompany, QuickAddUser) are driven entirely by
 * `accessState`, so they move here too — leaving them at the root would keep
 * `accessState` lifted and defeat the isolation. The parent remounts this via
 * `key={selectedSpaceId}`, which resets the selection on space change.
 */
export function AccessPanel({
  active,
  apiClient,
  selectedSpaceId,
  allCampaigns,
  campaignSelectData,
  campaigns,
  campaignsMutator,
  onNotify,
  isMobile,
  isSystemAdmin,
}: AccessPanelProps) {
  const queryClient = useQueryClient();
  const [accessCampaignId, setAccessCampaignId] = useState('');
  const [accessViewMode, setAccessViewMode] = useState<'campaign' | 'company' | 'all'>('campaign');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [showExpiredGrants, setShowExpiredGrants] = useState(false);

  const accessTargetId = accessViewMode === 'campaign' ? accessCampaignId : selectedCompanyId;
  const { accessEntries, accessLoading, mutateAccess } = useAccessGrants(
    apiClient, accessViewMode, active ? accessTargetId : '', showExpiredGrants,
  );
  const companiesEnabled = active && (accessViewMode === 'company' || accessViewMode === 'all');
  const { companies, companiesLoading, mutateCompanies } = useCompanies(apiClient, selectedSpaceId, companiesEnabled);

  const mutateAccessWrapped = useCallback(() => mutateAccess() as Promise<unknown>, [mutateAccess]);
  const mutateCompaniesWrapped = useCallback(() => mutateCompanies() as Promise<unknown>, [mutateCompanies]);

  const accessState = useAdminAccessState({
    apiClient, accessCampaignId, selectedCompanyId, accessViewMode,
    mutateAccess: mutateAccessWrapped,
    mutateCompanies: mutateCompaniesWrapped,
    mutateCampaigns: campaignsMutator,
    onNotify,
  });

  // Default the campaign / company selection to the first available option.
  useEffect(() => {
    if (active && !accessCampaignId && allCampaigns.length > 0 && accessViewMode === 'campaign') {
      setAccessCampaignId(String(allCampaigns[0]!.id));
    }
  }, [active, accessCampaignId, allCampaigns, accessViewMode]);
  useEffect(() => {
    if (active && (accessViewMode === 'company' || accessViewMode === 'all') && !selectedCompanyId && companies.length > 0) {
      setSelectedCompanyId(String(companies[0]!.id));
    }
  }, [active, accessViewMode, selectedCompanyId, companies]);

  // Prefetch all campaigns' access grants once per mount, once the tab is active.
  const accessPrefetchedRef = useRef(false);
  const cancelAccessRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (active && allCampaigns.length > 0 && !accessPrefetchedRef.current) {
      accessPrefetchedRef.current = true;
      cancelAccessRef.current = prefetchAllCampaignAccess(
        apiClient, allCampaigns.map((c) => String(c.id)), queryClient,
      );
    }
  }, [active, allCampaigns, apiClient, queryClient]);
  useEffect(() => () => { cancelAccessRef.current?.(); }, []);

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

  const accessRows = useAccessRows({
    accessEntries, accessViewMode,
    onRevokeAccess: accessState.handleRevokeAccess,
    onChangeRole: accessState.handleChangeRole,
  });

  return (
    <>
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
    </>
  );
}

setWpsgDebugDisplayName(AccessPanel, 'AccessPanel');
