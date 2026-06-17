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
          onSuccess: () => onNotify({ type: 'success', text: 'Asset uploaded.' }),
        },
      );
    },
    [uploadAsset, onNotify],
  );

  const handleDeleteRequest = useCallback(
    (id: string) => {
      const item = assets?.find((a) => a.id === id);
      if (!item) return;
      modals.openConfirmModal({
        title: 'Delete asset?',
        children: `Delete "${item.name}"? This cannot be undone.`,
        labels: { confirm: 'Delete', cancel: 'Cancel' },
        confirmProps: { color: 'red' },
        onConfirm: async () => {
          try {
            await deleteAsset.mutateAsync({ id });
            onNotify({ type: 'success', text: `Deleted "${item.name}".` });
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
    [assets, deleteAsset, onNotify],
  );

  const handleForceDelete = useCallback(async () => {
    if (!forceDelete) return;
    setForceDeleting(true);
    try {
      await deleteAsset.mutateAsync({ id: forceDelete.item.id, force: true });
      onNotify({ type: 'success', text: `Deleted "${forceDelete.item.name}".` });
      setForceDelete(null);
    } catch (err) {
      onNotify({ type: 'error', text: (err as Error).message });
    } finally {
      setForceDeleting(false);
    }
  }, [deleteAsset, forceDelete, onNotify]);

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
        <Title order={5}>Asset Library</Title>
        <AssetUploader
          onFileSelect={handleFileSelect}
          isUploading={uploadAsset.isPending}
          accept="image/*"
          uploadLabel="Upload asset"
          uploadAriaLabel="Upload asset to library"
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
        title="Asset is in use"
        message={
          `"${forceDelete?.item.name ?? ''}" is associated with ` +
          `${forceDelete?.inUse ?? 0} space${(forceDelete?.inUse ?? 0) !== 1 ? 's' : ''}. ` +
          `Removing it will unlink it from all spaces. Delete anyway?`
        }
        confirmLabel="Delete anyway"
        confirmColor="red"
        loading={forceDeleting}
      />
    </>
  );
}

setWpsgDebugDisplayName(GlobalAssetManager, 'Admin:GlobalAssetManager');
