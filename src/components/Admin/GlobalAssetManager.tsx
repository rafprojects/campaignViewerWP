/**
 * P52-B — GlobalAssetManager
 *
 * Shared CRUD component for the global visual asset library.  Used in both the
 * Admin Panel "Assets" tab and the WP-admin "Asset Library" page
 * (#wpsg-assets-admin).
 *
 * REST routes used (all require_admin / manage_wpsg):
 *   GET  /admin/asset-library          — list all assets
 *   POST /admin/asset-library          — upload new asset
 *   POST /admin/asset-library/{id}     — update is_universal / tags
 *   DELETE /admin/asset-library/{id}   — delete (409 in-use guard from P52-A5c)
 */
import { useCallback, useState } from 'react';
import { Center, Group, Loader, Title } from '@mantine/core';
import { modals } from '@mantine/modals';
import { useTranslation } from 'react-i18next';

import type { ApiClient } from '@/services/apiClient';
import { ApiError } from '@/services/apiClient';
import type { AssetLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';
import { AssetUploader } from '@/components/Admin/LayoutBuilder/AssetUploader';
import { DesignAssetsGrid } from '@/components/Admin/LayoutBuilder/DesignAssetsGrid';
import { ConfirmModal } from '@/components/Common/ConfirmModal';
import { useAssetLibrary } from '@/services/layoutTemplateQuery';
import {
  useUploadGlobalAsset,
  useUpdateGlobalAsset,
  useDeleteGlobalAsset,
} from '@/services/adminQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface GlobalAssetManagerProps {
  apiClient: ApiClient;
  onNotify: (message: { type: 'error' | 'success'; text: string }) => void;
}

export function GlobalAssetManager({ apiClient, onNotify }: GlobalAssetManagerProps) {
  const { t } = useTranslation('wpsg');
  const { data: assets, isLoading } = useAssetLibrary(apiClient);
  const uploadAsset = useUploadGlobalAsset(apiClient);
  const updateAsset = useUpdateGlobalAsset(apiClient);
  const deleteAsset = useDeleteGlobalAsset(apiClient);

  // P52-A5c in-use guard: when DELETE returns 409, park the asset here so a
  // force-confirm modal can offer a second attempt with force=true.
  const [forceDelete, setForceDelete] = useState<{ item: AssetLibraryItem; inUse: number } | null>(null);
  const [forceDeleting, setForceDeleting] = useState(false);

  const handleFileSelect = useCallback(
    (file: File) => {
      uploadAsset.mutate(
        { file },
        {
          onError: (err) => onNotify({ type: 'error', text: (err as Error).message }),
          onSuccess: () => onNotify({ type: 'success', text: t('admin_asset_uploaded', 'Asset uploaded.') }),
        },
      );
    },
    [uploadAsset, onNotify, t],
  );

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const item = assets?.find((a) => a.id === id);
      if (!item) return;
      modals.openConfirmModal({
        title: t('admin_asset_delete_title', 'Delete asset?'),
        children: t('admin_asset_delete_confirm', 'Delete "{{name}}"? This cannot be undone.', { name: item.name }),
        labels: { confirm: t('admin_asset_delete', 'Delete'), cancel: t('admin_asset_cancel', 'Cancel') },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
          try {
            await deleteAsset.mutateAsync({ id });
            onNotify({ type: 'success', text: t('admin_asset_deleted', 'Deleted "{{name}}".', { name: item.name }) });
          } catch (err) {
            // P52-A5c: 409 means the asset is still linked to one or more spaces.
            if (err instanceof ApiError && err.status === 409) {
              const inUse = Number(
                (err.data as { data?: { inUse?: number } } | undefined)?.data?.inUse ?? 0,
              );
              setForceDelete({ item, inUse });
              return;
            }
            onNotify({ type: 'error', text: (err as Error).message });
          }
        },
      });
    },
    [assets, deleteAsset, onNotify, t],
  );

  const handleForceDelete = useCallback(async () => {
    if (!forceDelete) return;
    setForceDeleting(true);
    try {
      await deleteAsset.mutateAsync({ id: forceDelete.item.id, force: true });
      onNotify({ type: 'success', text: t('admin_asset_deleted', 'Deleted "{{name}}".', { name: forceDelete.item.name }) });
      setForceDelete(null);
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message });
    } finally {
      setForceDeleting(false);
    }
  }, [deleteAsset, forceDelete, onNotify, t]);

  const handleSetUniversal = useCallback(
    (id: string, universal: boolean) => {
      updateAsset.mutate(
        { id, is_universal: universal },
        { onError: (err) => onNotify({ type: 'error', text: (err as Error).message }) },
      );
    },
    [updateAsset, onNotify],
  );

  const handleSetTags = useCallback(
    (id: string, tags: string[]) => {
      updateAsset.mutate(
        { id, tags },
        { onError: (err) => onNotify({ type: 'error', text: (err as Error).message }) },
      );
    },
    [updateAsset, onNotify],
  );

  return (
    <>
      <Group justify="space-between" align="center" mb="md">
        <Title order={5}>{t('admin_asset_library_title', 'Asset Library')}</Title>
        <AssetUploader
          onFileSelect={handleFileSelect}
          isUploading={uploadAsset.isPending}
          accept="image/*"
          uploadLabel={t('admin_asset_upload', 'Upload asset')}
          uploadAriaLabel={t('admin_asset_upload_aria', 'Upload asset to library')}
        />
      </Group>

      {isLoading ? (
        <Center py="xl"><Loader size="sm" /></Center>
      ) : (
        <DesignAssetsGrid
          items={assets ?? []}
          onDelete={handleDeleteRequest}
          onSetUniversal={handleSetUniversal}
          onSetTags={handleSetTags}
          maxHeight={560}
          columns={5}
        />
      )}

      {/* P52-A5c: in-use (409) escalation — offer a force delete. */}
      <ConfirmModal
        opened={!!forceDelete}
        onClose={() => setForceDelete(null)}
        onConfirm={handleForceDelete}
        title={t('admin_asset_inuse_title', 'Asset is in use')}
        message={t('admin_asset_inuse_msg', '"{{name}}" is associated with {{count}} space. Removing it will unlink it from all spaces. Delete anyway?', { name: forceDelete?.item.name ?? '', count: forceDelete?.inUse ?? 0 })}
        confirmLabel={t('admin_asset_delete_anyway', 'Delete anyway')}
        confirmColor="red"
        loading={forceDeleting}
      />
    </>
  );
}

setWpsgDebugDisplayName(GlobalAssetManager, 'Admin:GlobalAssetManager');
