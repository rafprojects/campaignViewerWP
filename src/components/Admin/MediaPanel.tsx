import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Center, FileButton, Group, Loader } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { ApiClient } from '@/services/apiClient';
import type { CampaignSelectItem } from '@/components/Common/CampaignSelector';
import { CampaignSelector } from '@/components/Common/CampaignSelector';
import { prefetchAllCampaignMedia } from '@/services/adminQuery';
import type { useAdminZipTransfers } from '@/hooks/useAdminZipTransfers';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const MediaTab = lazy(() => import('./MediaTab'));

interface MediaPanelProps {
  /**
   * P72-E: fetch-gating flag (`activeTab === 'media'`). Mantine v9 keeps inactive
   * `Tabs.Panel`s mounted, so the default-select + prefetch are gated by this flag
   * rather than by mount/unmount (MediaTab's own query is gated by an empty
   * campaignId until a campaign is selected).
   */
  active: boolean;
  apiClient: ApiClient;
  campaignSelectData: CampaignSelectItem[];
  zipTransfers: ReturnType<typeof useAdminZipTransfers>;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
  onCampaignsUpdated: () => void;
  isSystemAdmin: boolean;
}

/**
 * P72-E: the Media tab, split out of AdminPanel so its campaign selection (and
 * the rescan-all loading flag) live here and no longer re-render the whole
 * panel. The parent remounts this via `key={selectedSpaceId}`, which resets the
 * selection on space change. Note: `addMediaCampaign` (the per-row "Add media"
 * upload target) intentionally stays in AdminPanel — its setter is consumed by
 * the Campaigns tab's row builder and its modal renders at the panel root.
 */
export function MediaPanel({
  active,
  apiClient,
  campaignSelectData,
  zipTransfers,
  onNotify,
  onCampaignsUpdated,
  isSystemAdmin,
}: MediaPanelProps) {
  const { t } = useTranslation('wpsg');
  const queryClient = useQueryClient();
  const [mediaCampaignId, setMediaCampaignId] = useState('');
  const [rescanAllLoading, setRescanAllLoading] = useState(false);

  // Default to the first campaign when the tab activates with no selection.
  useEffect(() => {
    if (active && !mediaCampaignId && campaignSelectData.length > 0) {
      setMediaCampaignId(campaignSelectData[0]!.value);
    }
  }, [active, mediaCampaignId, campaignSelectData]);

  // Prefetch all campaigns' media once per mount, once the tab is active.
  const mediaPrefetchedRef = useRef(false);
  const cancelMediaRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (active && campaignSelectData.length > 0 && !mediaPrefetchedRef.current) {
      mediaPrefetchedRef.current = true;
      cancelMediaRef.current = prefetchAllCampaignMedia(
        apiClient, campaignSelectData.map((c) => c.value), queryClient,
      );
    }
  }, [active, campaignSelectData, apiClient, queryClient]);
  useEffect(() => () => { cancelMediaRef.current?.(); }, []);

  return (
    <>
      <Group mb="md" justify="space-between" wrap="wrap" gap="sm">
        <CampaignSelector data={campaignSelectData} value={mediaCampaignId} onChange={setMediaCampaignId} style={{ minWidth: 200, flex: '1 1 200px' }} />
        {/* P53-A: library-wide media tools (binary export/import, cross-space rescan) are system-admin only. */}
        {isSystemAdmin && (
          <>
            <Button
              size="sm"
              variant="light"
              loading={zipTransfers.mediaZipExporting}
              style={{ flex: '0 0 auto' }}
              onClick={() => zipTransfers.exportMediaZip(mediaCampaignId)}
              aria-label={t('admin_export_zip_aria', 'Export media library as ZIP')}
            >
              {t('admin_export_zip', 'Export ZIP')}
            </Button>
            <FileButton
              onChange={(file) => { if (file) zipTransfers.importMediaZip(file); }}
              accept=".zip,application/zip"
            >
              {(props) => (
                <Button
                  {...props}
                  size="sm"
                  variant="light"
                  loading={zipTransfers.mediaZipImporting}
                  style={{ flex: '0 0 auto' }}
                  aria-label={t('admin_import_zip_aria', 'Import media library from ZIP')}
                >
                  {t('admin_import_zip', 'Import ZIP')}
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
                      ? t('admin_rescan_done', 'Rescanned: {{media}} media items updated across {{campaigns}} campaigns.', { media: result.media_updated, campaigns: result.campaigns_updated })
                      : t('admin_rescan_none', 'All media types are correct.')
                  });
                  onCampaignsUpdated();
                } catch (err) { onNotify({ type: 'error', text: (err as Error).message }); }
                finally { setRescanAllLoading(false); }
              }}
            >
              {t('admin_rescan_all', 'Rescan All')}
            </Button>
          </>
        )}
      </Group>
      <ErrorBoundary isAdmin={true}>
        <Suspense fallback={<Center py="md"><Loader /></Center>}>
          <MediaTab campaignId={mediaCampaignId} apiClient={apiClient} onCampaignsUpdated={onCampaignsUpdated} />
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

setWpsgDebugDisplayName(MediaPanel, 'MediaPanel');
