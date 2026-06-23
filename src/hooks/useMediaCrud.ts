import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { showNotification } from '@mantine/notifications';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import { getMediaItemsQueryKey } from '@/services/adminQuery';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

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
      showNotification({ title: 'Deleted', message: 'Media removed.' });
      onCampaignsUpdated?.();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Delete failed', message: getErrorMessage(err, 'Failed to delete media.'), color: 'red' });
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
      showNotification({ title: 'Saved', message: 'Media updated.' });
    } catch (err) {
      showNotification({ title: 'Save failed', message: getErrorMessage(err, 'Failed to save media.'), color: 'red' });
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
        showNotification({ title: 'Rescan Complete', message: `Updated ${result.updated} of ${result.total} media items.` });
        await mutateMedia();
      } else {
        showNotification({ title: 'Rescan Complete', message: 'All media types are correct.' });
      }
    } catch (err) {
      showNotification({ title: 'Rescan failed', message: getErrorMessage(err, 'Failed to rescan media types.'), color: 'red' });
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
