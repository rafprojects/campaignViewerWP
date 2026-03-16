/**
 * useEditCampaignModal
 *
 * Encapsulates all state and handlers for the Edit Campaign modal in App.tsx:
 * - Campaign form fields (title, description, cover image)
 * - Media management (list, add external, add from library, upload, remove)
 * - Cover image upload
 * - Library search & pagination
 */
import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, MediaItem, UploadResponse } from '@/types';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { sortByOrder } from '@/utils/sortByOrder';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { useXhrUpload } from './useXhrUpload';

interface UseEditCampaignModalOptions {
  apiClient: ApiClient;
  isAdmin: boolean;
  onMutate: () => Promise<unknown>;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function useEditCampaignModal({
  apiClient,
  isAdmin,
  onMutate,
  onNotify,
}: UseEditCampaignModalOptions) {
  const [editModalCampaign, setEditModalCampaign] = useState<Campaign | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverImage, setEditCoverImage] = useState('');
  const [coverImageChanged, setCoverImageChanged] = useState(false);
  const [coverImageUploading, setCoverImageUploading] = useState(false);

  // Media management
  const [editCampaignMedia, setEditCampaignMedia] = useState<MediaItem[]>([]);
  const [editMediaLoading, setEditMediaLoading] = useState(false);
  const [editMediaTab, setEditMediaTab] = useState<string | null>('details');
  const [addMediaUrl, setAddMediaUrl] = useState('');
  const [addMediaType, setAddMediaType] = useState<'video' | 'image'>('video');
  const [addMediaCaption, setAddMediaCaption] = useState('');
  const [addMediaLoading, setAddMediaLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const { upload, progress: uploadProgress, resetProgress } = useXhrUpload();

  // Library
  const [libraryMedia, setLibraryMedia] = useState<MediaItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const libraryAbortControllerRef = useRef<AbortController | null>(null);

  // Abort in-flight library fetch on unmount
  useEffect(() => {
    return () => {
      libraryAbortControllerRef.current?.abort();
    };
  }, []);

  const openEditModal = async (campaign: Campaign) => {
    if (!isAdmin) {
      onNotify({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setEditTitle(campaign.title);
    setEditDescription(campaign.description ?? '');
    setEditCoverImage(
      campaign.coverImage && campaign.coverImage !== FALLBACK_IMAGE_SRC
        ? campaign.coverImage
        : '',
    );
    setCoverImageChanged(false);
    setEditModalCampaign(campaign);
    setEditMediaTab('details');
    setAddMediaUrl('');
    setAddMediaType('video');
    setAddMediaCaption('');

    setEditMediaLoading(true);
    try {
      const response = await apiClient.get<MediaItem[] | { items: MediaItem[] }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${campaign.id}/media`,
      );
      const items = Array.isArray(response) ? response : (response.items ?? []);
      setEditCampaignMedia(sortByOrder(items));
    } catch {
      setEditCampaignMedia([]);
    } finally {
      setEditMediaLoading(false);
    }
  };

  const closeEditModal = () => {
    setEditModalCampaign(null);
    setEditCampaignMedia([]);
    setEditCoverImage('');
    setCoverImageChanged(false);
    setUploadFile(null);
    resetProgress();
  };

  const handleSelectCoverImage = (value: string) => {
    setEditCoverImage(value);
    setCoverImageChanged(true);
  };

  const handleUploadCoverImage = async (file: File) => {
    if (!editModalCampaign) return;
    if (!file.type.startsWith('image/')) {
      onNotify({ type: 'error', text: 'Please select an image file for campaign thumbnail.' });
      return;
    }
    setCoverImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.postForm<UploadResponse>(
        '/wp-json/wp-super-gallery/v1/media/upload',
        formData,
      );
      setEditCoverImage(response.thumbnail ?? response.url);
      setCoverImageChanged(true);
      onNotify({ type: 'success', text: 'Campaign thumbnail uploaded.' });
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to upload campaign thumbnail.') });
    } finally {
      setCoverImageUploading(false);
    }
  };

  const handleRemoveMedia = async (mediaItem: MediaItem) => {
    if (!editModalCampaign) return;
    try {
      await apiClient.delete(
        `/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media/${mediaItem.id}`,
      );
      setEditCampaignMedia((prev) => prev.filter((m) => m.id !== mediaItem.id));
      onNotify({ type: 'success', text: 'Media removed from campaign.' });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to remove media.') });
    }
  };

  const loadLibraryMedia = async (search?: string) => {
    if (libraryAbortControllerRef.current) libraryAbortControllerRef.current.abort();
    const abortController = new AbortController();
    libraryAbortControllerRef.current = abortController;
    setLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '50');
      if (search) params.set('search', search);
      const response = await apiClient.get<{ items: MediaItem[]; total: number }>(
        `/wp-json/wp-super-gallery/v1/media/library?${params.toString()}`,
      );
      if (!abortController.signal.aborted) setLibraryMedia(response.items ?? []);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setLibraryMedia([]);
    } finally {
      if (!abortController.signal.aborted) {
        setLibraryLoading(false);
        libraryAbortControllerRef.current = null;
      }
    }
  };

  const handleAddFromLibrary = async (libraryItem: MediaItem) => {
    if (!editModalCampaign) return;
    if (editCampaignMedia.some((m) => m.id === libraryItem.id || m.url === libraryItem.url)) {
      onNotify({ type: 'error', text: 'This media is already in the campaign.' });
      return;
    }
    try {
      const order = editCampaignMedia.length + 1;
      const response = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media`,
        {
          type: libraryItem.type,
          source: 'upload',
          url: libraryItem.url,
          thumbnail: libraryItem.thumbnail,
          caption: libraryItem.caption,
          attachmentId: parseInt(libraryItem.id, 10),
          order,
        },
      );
      setEditCampaignMedia((prev) => [...prev, response]);
      onNotify({ type: 'success', text: 'Media added to campaign.' });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
    }
  };

  const handleAddExternalMediaInEdit = async () => {
    if (!editModalCampaign || !addMediaUrl) return;
    setAddMediaLoading(true);
    try {
      const order = editCampaignMedia.length + 1;
      const response = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media`,
        { type: addMediaType, source: 'external', url: addMediaUrl, caption: addMediaCaption || undefined, order },
      );
      setEditCampaignMedia((prev) => [...prev, response]);
      setAddMediaUrl('');
      setAddMediaCaption('');
      onNotify({ type: 'success', text: 'Media added.' });
      setEditMediaTab('list');
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
    } finally {
      setAddMediaLoading(false);
    }
  };

  const handleUploadMediaInEdit = async (file: File) => {
    if (!editModalCampaign || !file) return;
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
    ];
    const MAX_SIZE = 50 * 1024 * 1024;
    if (!ALLOWED_TYPES.includes(file.type)) {
      onNotify({ type: 'error', text: 'File type not allowed. Accepted: JPEG, PNG, GIF, WebP, MP4, WebM, OGG.' });
      return;
    }
    if (file.size > MAX_SIZE) {
      onNotify({ type: 'error', text: `File too large (${Math.round(file.size / 1024 / 1024)} MB). Maximum size is 50 MB.` });
      return;
    }
    setUploadFile(file);
    try {
      const authHeaders = await apiClient.getAuthHeaders();
      const response = await upload<UploadResponse>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        file,
        headers: authHeaders,
      });
      const mediaType = file.type.startsWith('image') ? 'image' : 'video';
      const order = editCampaignMedia.length + 1;
      const newMedia = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}/media`,
        { type: mediaType, source: 'upload', url: response.url, thumbnail: response.thumbnail ?? response.url, attachmentId: response.attachmentId, order },
      );
      setEditCampaignMedia((prev) => [...prev, newMedia]);
      onNotify({ type: 'success', text: 'File uploaded and added to campaign.' });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Upload failed.') });
    } finally {
      setUploadFile(null);
      resetProgress();
    }
  };

  const confirmEditCampaign = async () => {
    if (!editModalCampaign) return;
    try {
      const payload: { title: string; description: string; coverImage?: string } = {
        title: editTitle,
        description: editDescription,
      };
      if (coverImageChanged) payload.coverImage = editCoverImage || '';
      await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editModalCampaign.id}`, payload);
      onNotify({ type: 'success', text: 'Campaign updated.' });
      closeEditModal();
      await onMutate();
    } catch {
      onNotify({ type: 'error', text: 'Failed to update campaign.' });
    }
  };

  return {
    editModalCampaign,
    editTitle, setEditTitle,
    editDescription, setEditDescription,
    editCoverImage,
    coverImageUploading,
    editCampaignMedia,
    editMediaLoading,
    editMediaTab, setEditMediaTab,
    addMediaUrl, setAddMediaUrl,
    addMediaType, setAddMediaType,
    addMediaCaption, setAddMediaCaption,
    addMediaLoading,
    uploadFile,
    uploadProgress,
    libraryMedia,
    libraryLoading,
    librarySearch, setLibrarySearch,
    openEditModal,
    closeEditModal,
    handleSelectCoverImage,
    handleUploadCoverImage,
    handleRemoveMedia,
    loadLibraryMedia,
    handleAddFromLibrary,
    handleAddExternalMediaInEdit,
    handleUploadMediaInEdit,
    confirmEditCampaign,
  };
}
