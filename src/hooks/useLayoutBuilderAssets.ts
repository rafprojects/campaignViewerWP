import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import i18n from '@/i18n';
import type { ApiClient } from '@/services/apiClient';
import type { AssetLibraryItem } from '@/components/Admin/LayoutBuilder/BuilderDockContext';
import type { UseLayoutBuilderReturn } from './useLayoutBuilderState';

// [P71-E] Notification copy routed through the shared i18next instance (outside JSX).
const t = i18n.t.bind(i18n);

export function useLayoutBuilderAssets({
  apiClient,
  refetchAssetLibrary,
  builder,
  announce,
  onNotify,
}: {
  apiClient: ApiClient;
  refetchAssetLibrary: () => Promise<unknown>;
  builder: UseLayoutBuilderReturn;
  announce: (msg: string) => void;
  onNotify?: ((msg: { type: 'error' | 'success'; text: string }) => void) | undefined;
}) {
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

  const handleUploadAsset = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setIsUploadingAsset(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        const entry = await apiClient.postForm<AssetLibraryItem>(
          '/wp-json/wp-super-gallery/v1/admin/asset-library',
          formData,
        );
        await refetchAssetLibrary();
        builder.addOverlay(entry.url);
        announce('Overlay uploaded and added to canvas');
        notifications.show({ message: t('lbassets_overlay_added', 'Overlay added to canvas'), color: 'blue', autoClose: 3000 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : t('lbassets_overlay_upload_failed', 'Overlay upload failed');
        onNotify?.({ type: 'error', text: errMsg });
        notifications.show({ title: t('lbassets_overlay_upload_failed', 'Overlay upload failed'), message: errMsg, color: 'red', autoClose: 5000 });
      } finally {
        setIsUploadingAsset(false);
      }
    },
    [apiClient, refetchAssetLibrary, builder, announce, onNotify],
  );

  const handleDeleteLibraryAsset = useCallback(
    async (id: string) => {
      try {
        await apiClient.delete(`/wp-json/wp-super-gallery/v1/admin/asset-library/${id}`);
        await refetchAssetLibrary();
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to delete overlay',
        });
      }
    },
    [apiClient, refetchAssetLibrary, onNotify],
  );

  const handleSetAssetUniversal = useCallback(
    async (id: string, universal: boolean) => {
      try {
        await apiClient.post(
          `/wp-json/wp-super-gallery/v1/admin/asset-library/${id}`,
          { is_universal: universal },
        );
        await refetchAssetLibrary();
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to update asset visibility',
        });
      }
    },
    [apiClient, refetchAssetLibrary, onNotify],
  );

  const handleSetAssetTags = useCallback(
    async (id: string, tags: string[]) => {
      try {
        await apiClient.post(
          `/wp-json/wp-super-gallery/v1/admin/asset-library/${id}`,
          { tags },
        );
        await refetchAssetLibrary();
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Failed to update asset tags',
        });
      }
    },
    [apiClient, refetchAssetLibrary, onNotify],
  );

  const handleUploadBgImage = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setIsUploadingBg(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        const entry = await apiClient.postForm<AssetLibraryItem>(
          '/wp-json/wp-super-gallery/v1/admin/asset-library',
          formData,
        );
        builder.setBackgroundImage(entry.url);
        announce('Background image uploaded and applied');
        notifications.show({ message: t('lbassets_bg_applied', 'Background image applied'), color: 'blue', autoClose: 3000 });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : t('lbassets_bg_upload_failed_msg', 'Background image upload failed');
        onNotify?.({ type: 'error', text: errMsg });
        notifications.show({ title: t('lbassets_bg_upload_failed_title', 'Background upload failed'), message: errMsg, color: 'red', autoClose: 5000 });
      } finally {
        setIsUploadingBg(false);
      }
    },
    [apiClient, builder, announce, onNotify],
  );

  const handleUploadMask = useCallback(
    async (file: File): Promise<string | null> => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
        const entry = await apiClient.postForm<AssetLibraryItem>(
          '/wp-json/wp-super-gallery/v1/admin/asset-library',
          formData,
        );
        announce('Mask image uploaded');
        return entry.url;
      } catch (err) {
        onNotify?.({
          type: 'error',
          text: err instanceof Error ? err.message : 'Mask upload failed',
        });
        return null;
      }
    },
    [apiClient, announce, onNotify],
  );

  return {
    isUploadingAsset,
    isUploadingBg,
    handleUploadAsset,
    handleDeleteLibraryAsset,
    handleSetAssetUniversal,
    handleSetAssetTags,
    handleUploadBgImage,
    handleUploadMask,
  };
}
