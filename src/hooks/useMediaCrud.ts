import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { showNotification } from '@mantine/notifications';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import i18n from '@/i18n';
import { getMediaItemsQueryKey } from '@/services/adminQuery';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

// [P71-E] Notification copy routed through the shared i18next instance (outside JSX).
const t = i18n.t.bind(i18n);

export function useMediaCrud({
  apiClient,
  campaignId,
  setMedia,
  queryClient,
  onCampaignsUpdated,
  mutateMedia,
}: {
  apiClient: ApiClient;
  campaignId: string;
  setMedia: Dispatch<SetStateAction<MediaItem[]>>;
  queryClient: QueryClient;
  onCampaignsUpdated?: (() => void) | undefined;
  mutateMedia: () => void | Promise<unknown>;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingCaption, setEditingCaption] = useState('');
  const [editingThumbnail, setEditingThumbnail] = useState<string | undefined>(undefined);
  const [deleteItem, setDeleteItem] = useState<MediaItem | null>(null);
  const [rescanning, setRescanning] = useState(false);

  async function handleDelete(item: MediaItem) {
    setDeleteItem(item);
  }

  async function confirmDelete() {
    if (!deleteItem) return;
    try {
      await apiClient.delete(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${deleteItem.id}`);
      setMedia((m) => m.filter((x) => x.id !== deleteItem.id));
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), (prev) => (prev ?? []).filter((x) => x.id !== deleteItem.id));
      showNotification({ title: t('mediacrud_deleted_title', 'Deleted'), message: t('mediacrud_deleted_message', 'Media removed.') });
      onCampaignsUpdated?.();
    } catch (err) {
      console.error(err);
      showNotification({ title: t('mediacrud_delete_failed_title', 'Delete failed'), message: getErrorMessage(err, t('mediacrud_delete_failed_message', 'Failed to delete media.')), color: 'red' });
    } finally {
      setDeleteItem(null);
    }
  }

  function openEdit(item: MediaItem) {
    setEditingItem(item);
    setEditingTitle(item.title ?? '');
    setEditingCaption(item.caption ?? '');
    setEditingThumbnail(item.thumbnail);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editingItem) return;
    try {
      const updated = await apiClient.put<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/${editingItem.id}`, {
        title: editingTitle.trim() || undefined,
        caption: editingCaption,
        thumbnail: editingThumbnail
      });
      setMedia((m) => m.map((it) => (it.id === updated.id ? updated : it)));
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), (prev) => (prev ?? []).map((it) => (it.id === updated.id ? updated : it)));
      setEditOpen(false);
      showNotification({ title: t('mediacrud_saved_title', 'Saved'), message: t('mediacrud_saved_message', 'Media updated.') });
    } catch (err) {
      showNotification({ title: t('mediacrud_save_failed_title', 'Save failed'), message: getErrorMessage(err, t('mediacrud_save_failed_message', 'Failed to save media.')), color: 'red' });
    }
  }

  async function handleRescanTypes() {
    setRescanning(true);
    try {
      const result = await apiClient.post<{ message: string; updated: number; total: number }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media/rescan`,
        {},
      );
      if (result.updated > 0) {
        showNotification({ title: t('mediacrud_rescan_complete_title', 'Rescan Complete'), message: t('mediacrud_rescan_updated_message', 'Updated {{updated}} of {{total}} media items.', { updated: result.updated, total: result.total }) });
        await mutateMedia();
      } else {
        showNotification({ title: t('mediacrud_rescan_complete_title', 'Rescan Complete'), message: t('mediacrud_rescan_correct_message', 'All media types are correct.') });
      }
    } catch (err) {
      showNotification({ title: t('mediacrud_rescan_failed_title', 'Rescan failed'), message: getErrorMessage(err, t('mediacrud_rescan_failed_message', 'Failed to rescan media types.')), color: 'red' });
    } finally {
      setRescanning(false);
    }
  }

  return {
    editOpen,
    setEditOpen,
    editingItem,
    editingTitle,
    setEditingTitle,
    editingCaption,
    setEditingCaption,
    editingThumbnail,
    setEditingThumbnail,
    deleteItem,
    setDeleteItem,
    rescanning,
    handleDelete,
    confirmDelete,
    openEdit,
    saveEdit,
    handleRescanTypes,
  };
}
