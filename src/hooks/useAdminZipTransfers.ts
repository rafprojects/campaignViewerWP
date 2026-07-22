import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';

interface Options {
  apiClient: ApiClient;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

type AuditZipParams = Parameters<ApiClient['startAuditLogBinaryExport']>[0];

/**
 * Admin ZIP export/import transfers (P70-H).
 *
 * Owns the four in-flight flags and the long-running binary job handlers
 * extracted verbatim from `AdminPanel`: audit-log ZIP export, global-audit ZIP
 * export (both driven by one shared runner), and media-library ZIP
 * export/import. Behaviour is unchanged — start the job, poll every 3 s until
 * done with a 5-minute deadline, toast success/failure, download on success,
 * and best-effort delete the server-side job afterwards. Selection state (which
 * campaign a media export targets) stays in the caller and is passed to
 * `exportMediaZip`.
 */
export function useAdminZipTransfers({ apiClient, onNotify }: Options) {
  const { t } = useTranslation('wpsg');

  const [auditZipExporting, setAuditZipExporting] = useState(false);
  const [globalAuditZipExporting, setGlobalAuditZipExporting] = useState(false);
  const [mediaZipExporting, setMediaZipExporting] = useState(false);
  const [mediaZipImporting, setMediaZipImporting] = useState(false);

  const runAuditZipExport = useCallback(async (
    params: AuditZipParams,
    setExporting: (v: boolean) => void,
    filename: string,
  ) => {
    setExporting(true);
    try {
      const { jobId } = await apiClient.startAuditLogBinaryExport(params);
      onNotify({ type: 'success', text: t('admin_building_audit_zip', 'Building audit log ZIP — this may take a moment.') });
      try {
        const deadline = Date.now() + 300_000;
        let job = await apiClient.getExportJob(jobId);
        while (job.status === 'pending' || job.status === 'processing') {
          if (Date.now() > deadline) throw new Error(t('admin_export_timeout', 'Export timed out after 5 minutes.'));
          await new Promise((resolve) => setTimeout(resolve, 3000));
          job = await apiClient.getExportJob(jobId);
        }
        if (job.status === 'failed') throw new Error(job.error ?? t('admin_export_failed', 'Export failed'));
        await apiClient.downloadExportJob(jobId, filename);
      } finally {
        await apiClient.deleteExportJob(jobId).catch(() => undefined);
      }
    } catch (err) {
      onNotify({ type: 'error', text: (err instanceof Error ? err.message : t('admin_audit_zip_failed', 'Audit ZIP export failed')) });
    } finally {
      setExporting(false);
    }
  }, [apiClient, onNotify, t]);

  const exportAuditZip = useCallback(
    (params: AuditZipParams, filename: string) => runAuditZipExport(params, setAuditZipExporting, filename),
    [runAuditZipExport],
  );

  const exportGlobalAuditZip = useCallback(
    (params: AuditZipParams, filename: string) => runAuditZipExport(params, setGlobalAuditZipExporting, filename),
    [runAuditZipExport],
  );

  const exportMediaZip = useCallback(async (campaignId?: string) => {
    setMediaZipExporting(true);
    try {
      const params = campaignId ? { campaignId } : {};
      const { jobId } = await apiClient.startMediaLibraryBinaryExport(params);
      onNotify({ type: 'success', text: t('admin_building_media_zip', 'Building media library ZIP — this may take a moment.') });
      try {
        const deadline = Date.now() + 300_000;
        let job = await apiClient.getExportJob(jobId);
        while (job.status === 'pending' || job.status === 'processing') {
          if (Date.now() > deadline) throw new Error(t('admin_export_timeout', 'Export timed out after 5 minutes.'));
          await new Promise((resolve) => setTimeout(resolve, 3000));
          job = await apiClient.getExportJob(jobId);
        }
        if (job.status === 'failed') throw new Error(job.error ?? t('admin_export_failed', 'Export failed'));
        await apiClient.downloadExportJob(jobId, `media-library-${Date.now()}.zip`);
      } finally {
        await apiClient.deleteExportJob(jobId).catch(() => undefined);
      }
    } catch (err) {
      onNotify({ type: 'error', text: (err instanceof Error ? err.message : t('admin_media_zip_failed', 'Media ZIP export failed')) });
    } finally {
      setMediaZipExporting(false);
    }
  }, [apiClient, onNotify, t]);

  const importMediaZip = useCallback(async (file: File) => {
    setMediaZipImporting(true);
    try {
      const result = await apiClient.importMediaLibraryBinary(file);
      const msg = result.skipped.length > 0
        ? t('admin_media_imported_skipped', 'Imported {{count}} media item ({{skipped}} skipped).', { count: result.imported.length, skipped: result.skipped.length })
        : t('admin_media_imported', 'Imported {{count}} media item.', { count: result.imported.length });
      onNotify({ type: 'success', text: msg });
    } catch (err) {
      onNotify({ type: 'error', text: (err instanceof Error ? err.message : t('admin_media_zip_import_failed', 'Media ZIP import failed')) });
    } finally {
      setMediaZipImporting(false);
    }
  }, [apiClient, onNotify, t]);

  return {
    auditZipExporting,
    globalAuditZipExporting,
    mediaZipExporting,
    mediaZipImporting,
    exportAuditZip,
    exportGlobalAuditZip,
    exportMediaZip,
    importMediaZip,
  };
}
