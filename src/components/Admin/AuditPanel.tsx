import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '@/services/apiClient';
import type { CampaignSelectItem } from '@/components/Common/CampaignSelector';
import { useAuditEntries, prefetchAllCampaignAudit } from '@/services/adminQuery';
import type { AuditFilters } from '@/services/adminQuery';
import { useAuditRows } from '@/hooks/useAuditRows';
import type { useAdminZipTransfers } from '@/hooks/useAdminZipTransfers';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';
import { AuditTab } from './AuditTab';

interface AuditPanelProps {
  /**
   * P72-E: fetch-gating flag (`activeTab === 'audit'`). Mantine v9 keeps inactive
   * `Tabs.Panel`s mounted, so — exactly as the old inline code did — the data hook
   * must be gated by an explicit flag rather than by mount/unmount.
   */
  active: boolean;
  apiClient: ApiClient;
  campaignSelectData: CampaignSelectItem[];
  zipTransfers: ReturnType<typeof useAdminZipTransfers>;
}

/**
 * P72-E: the Campaign Activity (audit) tab, split out of AdminPanel so its
 * campaign-selection + filter state lives here and no longer re-renders the
 * whole panel. The parent remounts this via `key={selectedSpaceId}`, which
 * resets the selection on space change (behaviour previously handled by the
 * shared `selectedSpaceId` reset effect).
 */
export function AuditPanel({ active, apiClient, campaignSelectData, zipTransfers }: AuditPanelProps) {
  const queryClient = useQueryClient();
  const [auditCampaignId, setAuditCampaignId] = useState('');
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({});

  const { auditEntries, auditLoading, auditError } = useAuditEntries(
    apiClient, active ? auditCampaignId : '', auditFilters,
  );
  const auditRows = useAuditRows(auditEntries);

  // Default to the first campaign when the tab activates with no selection.
  useEffect(() => {
    if (active && !auditCampaignId && campaignSelectData.length > 0) {
      setAuditCampaignId(campaignSelectData[0]!.value);
    }
  }, [active, auditCampaignId, campaignSelectData]);

  // Prefetch all campaigns' audit logs once per mount, once the tab is active.
  const auditPrefetchedRef = useRef(false);
  const cancelAuditRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (active && campaignSelectData.length > 0 && !auditPrefetchedRef.current) {
      auditPrefetchedRef.current = true;
      cancelAuditRef.current = prefetchAllCampaignAudit(
        apiClient, campaignSelectData.map((c) => c.value), queryClient,
      );
    }
  }, [active, campaignSelectData, apiClient, queryClient]);
  useEffect(() => () => { cancelAuditRef.current?.(); }, []);

  return (
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
      onExportZip={() => zipTransfers.exportAuditZip({
        ...(auditCampaignId ? { campaignId: auditCampaignId } : {}),
        ...(auditFilters.from ? { from: auditFilters.from } : {}),
        ...(auditFilters.to ? { to: auditFilters.to } : {}),
        ...(auditFilters.action ? { action: auditFilters.action } : {}),
        ...(auditFilters.scope ? { scope: auditFilters.scope } : {}),
        ...(auditFilters.severity ? { severity: auditFilters.severity } : {}),
      }, `audit-log-${Date.now()}.zip`)}
      exportingZip={zipTransfers.auditZipExporting}
    />
  );
}

setWpsgDebugDisplayName(AuditPanel, 'AuditPanel');
