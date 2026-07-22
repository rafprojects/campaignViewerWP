/**
 * Phase 70-H: unit tests for the extracted admin ZIP transfers hook.
 *
 * Covers the four exposed handlers' happy paths (start job → poll to completion
 * → download → best-effort delete, with a success toast) and an error path
 * (start throws → error toast, flag resets).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useAdminZipTransfers } from './useAdminZipTransfers';
import type { ApiClient } from '@/services/apiClient';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, def: string) => def }),
}));

function makeApiClient(overrides: Record<string, unknown> = {}): ApiClient {
  return {
    startAuditLogBinaryExport: vi.fn().mockResolvedValue({ jobId: 'audit-job' }),
    startMediaLibraryBinaryExport: vi.fn().mockResolvedValue({ jobId: 'media-job' }),
    getExportJob: vi.fn().mockResolvedValue({ status: 'completed' }),
    downloadExportJob: vi.fn().mockResolvedValue(undefined),
    deleteExportJob: vi.fn().mockResolvedValue(undefined),
    importMediaLibraryBinary: vi.fn().mockResolvedValue({ imported: [{}, {}], skipped: [] }),
    ...overrides,
  } as unknown as ApiClient;
}

describe('useAdminZipTransfers', () => {
  it('exportMediaZip: starts a scoped job, downloads, cleans up, toasts success', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const { result } = renderHook(() => useAdminZipTransfers({ apiClient, onNotify }));

    await act(async () => { await result.current.exportMediaZip('c1'); });

    expect(apiClient.startMediaLibraryBinaryExport).toHaveBeenCalledWith({ campaignId: 'c1' });
    expect(apiClient.downloadExportJob).toHaveBeenCalledWith('media-job', expect.stringMatching(/^media-library-\d+\.zip$/));
    expect(apiClient.deleteExportJob).toHaveBeenCalledWith('media-job');
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: expect.stringContaining('Building media library ZIP') });
    expect(result.current.mediaZipExporting).toBe(false);
  });

  it('exportMediaZip: omits the campaign scope when none is passed', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const { result } = renderHook(() => useAdminZipTransfers({ apiClient, onNotify }));

    await act(async () => { await result.current.exportMediaZip(); });

    expect(apiClient.startMediaLibraryBinaryExport).toHaveBeenCalledWith({});
  });

  it('exportMediaZip: toasts the error and resets the flag when the job start fails', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient({ startMediaLibraryBinaryExport: vi.fn().mockRejectedValue(new Error('boom')) });
    const { result } = renderHook(() => useAdminZipTransfers({ apiClient, onNotify }));

    await act(async () => { await result.current.exportMediaZip('c1'); });

    expect(onNotify).toHaveBeenCalledWith({ type: 'error', text: 'boom' });
    expect(result.current.mediaZipExporting).toBe(false);
  });

  it('importMediaZip: imports the file and toasts the imported count', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const { result } = renderHook(() => useAdminZipTransfers({ apiClient, onNotify }));

    const file = new File([''], 'lib.zip');
    await act(async () => { await result.current.importMediaZip(file); });

    expect(apiClient.importMediaLibraryBinary).toHaveBeenCalledWith(file);
    expect(onNotify).toHaveBeenCalledWith({ type: 'success', text: expect.stringContaining('Imported') });
    expect(result.current.mediaZipImporting).toBe(false);
  });

  it('exportAuditZip / exportGlobalAuditZip: pass params + filename through to the shared runner', async () => {
    const onNotify = vi.fn();
    const apiClient = makeApiClient();
    const { result } = renderHook(() => useAdminZipTransfers({ apiClient, onNotify }));

    await act(async () => { await result.current.exportAuditZip({ campaignId: 'c1' }, 'audit.zip'); });
    expect(apiClient.startAuditLogBinaryExport).toHaveBeenCalledWith({ campaignId: 'c1' });
    expect(apiClient.downloadExportJob).toHaveBeenCalledWith('audit-job', 'audit.zip');

    await act(async () => { await result.current.exportGlobalAuditZip({ campaignId: 'c2' }, 'global.zip'); });
    expect(apiClient.startAuditLogBinaryExport).toHaveBeenCalledWith({ campaignId: 'c2' });
    expect(apiClient.downloadExportJob).toHaveBeenCalledWith('audit-job', 'global.zip');
    expect(result.current.auditZipExporting).toBe(false);
    expect(result.current.globalAuditZipExporting).toBe(false);
  });
});
