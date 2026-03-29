/**
 * useUnifiedCampaignModal
 *
 * Consolidated hook managing all state for the UnifiedCampaignModal:
 * - Combined form fields from both old EditCampaignModal and CampaignFormModal
 * - Media management (list, add external, add from library, upload, remove)
 * - Thumbnail / cover image upload
 * - Library search
 * - Save handler that sends ALL fields in a single PUT/POST
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, MediaItem, UploadResponse } from '@/types';
import type { AdminCampaign } from '@/hooks/useAdminSWR';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { sortByOrder } from '@/utils/sortByOrder';
import { FALLBACK_IMAGE_SRC } from '@/utils/fallback';
import { cloneGalleryConfig } from '@/utils/galleryConfig';
import {
  getUniformCampaignScopeAdapterId,
  normalizeCampaignLegacyAdapterOverrides,
} from '@/utils/campaignGalleryOverrides';
import { useXhrUpload } from './useXhrUpload';
import type { GalleryConfig } from '@/types';

export interface UnifiedCampaignFormState {
  title: string;
  description: string;
  company: string;
  coverImage: string;
  status: Campaign['status'];
  visibility: Campaign['visibility'];
  tags: string;
  borderColor?: string;
  publishAt: string;
  unpublishAt: string;
  layoutTemplateId: string;
  imageAdapterId: string;
  videoAdapterId: string;
  galleryOverrides?: Partial<GalleryConfig>;
  categories: string[];
}

const emptyForm: UnifiedCampaignFormState = {
  title: '',
  description: '',
  company: '',
  coverImage: '',
  status: 'draft',
  visibility: 'private',
  tags: '',
  publishAt: '',
  unpublishAt: '',
  layoutTemplateId: '',
  imageAdapterId: '',
  videoAdapterId: '',
  galleryOverrides: undefined,
  categories: [],
};

interface UseUnifiedCampaignModalOptions {
  apiClient: ApiClient;
  isAdmin: boolean;
  onMutate: () => Promise<unknown>;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function useUnifiedCampaignModal({
  apiClient,
  isAdmin,
  onMutate,
  onNotify,
}: UseUnifiedCampaignModalOptions) {
  const [opened, setOpened] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('edit');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [formState, setFormState] = useState<UnifiedCampaignFormState>({ ...emptyForm });
  const [isSaving, setIsSaving] = useState(false);

  // Thumbnail / cover image
  const [coverImageChanged, setCoverImageChanged] = useState(false);
  const [coverImageUploading, setCoverImageUploading] = useState(false);

  // Media management
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>('details');
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
  const libraryAbortRef = useRef<AbortController | null>(null);

  const savingRef = useRef(false);

  useEffect(() => {
    return () => { libraryAbortRef.current?.abort(); };
  }, []);

  // ── Open / Close ──────────────────────────────────────────

  const openForEdit = useCallback(async (campaign: Campaign | AdminCampaign) => {
    if (!isAdmin) {
      onNotify({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    const c = campaign as Campaign & Partial<AdminCampaign>;
    setMode('edit');
    setEditingCampaignId(String(c.id));
    const galleryOverrides = cloneGalleryConfig(c.galleryOverrides);
    setFormState({
      title: c.title ?? '',
      description: c.description ?? '',
      company: c.companyId ?? (c as Campaign).company?.id ?? '',
      coverImage:
        (c as Campaign).coverImage && (c as Campaign).coverImage !== FALLBACK_IMAGE_SRC
          ? (c as Campaign).coverImage
          : '',
      status: c.status ?? 'draft',
      visibility: c.visibility ?? 'private',
      tags: (c.tags ?? []).join(', '),
      publishAt: c.publishAt ?? '',
      unpublishAt: c.unpublishAt ?? '',
      layoutTemplateId: c.layoutTemplateId ?? '',
      imageAdapterId: getUniformCampaignScopeAdapterId(galleryOverrides, 'image') || (c.imageAdapterId ?? ''),
      videoAdapterId: getUniformCampaignScopeAdapterId(galleryOverrides, 'video') || (c.videoAdapterId ?? ''),
      galleryOverrides,
      categories: c.categories ?? [],
      borderColor: (c as Campaign).borderColor,
    });
    setCoverImageChanged(false);
    setActiveTab('details');
    setAddMediaUrl('');
    setAddMediaType('video');
    setAddMediaCaption('');
    setOpened(true);

    // Load media for this campaign
    setMediaLoading(true);
    try {
      const response = await apiClient.get<MediaItem[] | { items: MediaItem[] }>(
        `/wp-json/wp-super-gallery/v1/campaigns/${c.id}/media`,
      );
      const items = Array.isArray(response) ? response : (response.items ?? []);
      setMediaItems(sortByOrder(items));
    } catch {
      setMediaItems([]);
    } finally {
      setMediaLoading(false);
    }
  }, [isAdmin, apiClient, onNotify]);

  const openForCreate = useCallback(() => {
    setMode('create');
    setEditingCampaignId(null);
    setFormState({ ...emptyForm });
    setCoverImageChanged(false);
    setMediaItems([]);
    setActiveTab('details');
    setOpened(true);
  }, []);

  const close = useCallback(() => {
    setOpened(false);
    setEditingCampaignId(null);
    setFormState({ ...emptyForm });
    setMediaItems([]);
    setCoverImageChanged(false);
    setUploadFile(null);
    resetProgress();
  }, [resetProgress]);

  // ── Form helpers ──────────────────────────────────────────

  const updateForm = useCallback((next: UnifiedCampaignFormState) => {
    setFormState(next);
  }, []);

  // ── Thumbnail ─────────────────────────────────────────────

  const handleSelectCoverImage = useCallback((value: string) => {
    setFormState((prev) => ({ ...prev, coverImage: value }));
    setCoverImageChanged(true);
  }, []);

  const handleUploadCoverImage = useCallback(async (file: File) => {
    if (!editingCampaignId) return;
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
      // Defer state update past focus-trap restoration cycle (fixes FileButton freeze)
      requestAnimationFrame(() => {
        setFormState((prev) => ({ ...prev, coverImage: response.thumbnail ?? response.url }));
        setCoverImageChanged(true);
      });
      onNotify({ type: 'success', text: 'Campaign thumbnail uploaded.' });
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to upload campaign thumbnail.') });
    } finally {
      setCoverImageUploading(false);
    }
  }, [editingCampaignId, apiClient, onNotify]);

  // ── Save ──────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);

    const normalizedLegacyAdapterOverrides = normalizeCampaignLegacyAdapterOverrides(formState);

    const payload: Record<string, unknown> = {
      title: formState.title,
      description: formState.description,
      company: formState.company,
      status: formState.status,
      visibility: formState.visibility,
      tags: formState.tags.split(',').map((t) => t.trim()).filter(Boolean),
      categories: formState.categories,
      publishAt: formState.publishAt || '',
      unpublishAt: formState.unpublishAt || '',
      layoutTemplateId: formState.layoutTemplateId || '',
      imageAdapterId: normalizedLegacyAdapterOverrides.imageAdapterId,
      videoAdapterId: normalizedLegacyAdapterOverrides.videoAdapterId,
      galleryOverrides: formState.galleryOverrides ?? null,
    };
    if (coverImageChanged) payload.coverImage = formState.coverImage || '';
    if (formState.borderColor !== undefined) payload.borderColor = formState.borderColor;

    try {
      if (editingCampaignId) {
        await apiClient.put(`/wp-json/wp-super-gallery/v1/campaigns/${editingCampaignId}`, payload);
        onNotify({ type: 'success', text: 'Campaign updated.' });
      } else {
        await apiClient.post('/wp-json/wp-super-gallery/v1/campaigns', payload);
        onNotify({ type: 'success', text: 'Campaign created.' });
      }
      close();
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to save campaign.') });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [formState, editingCampaignId, coverImageChanged, apiClient, onNotify, close, onMutate]);

  // ── Media management ──────────────────────────────────────

  const handleRemoveMedia = useCallback(async (mediaItem: MediaItem) => {
    if (!editingCampaignId) return;
    try {
      await apiClient.delete(
        `/wp-json/wp-super-gallery/v1/campaigns/${editingCampaignId}/media/${mediaItem.id}`,
      );
      setMediaItems((prev) => prev.filter((m) => m.id !== mediaItem.id));
      onNotify({ type: 'success', text: 'Media removed from campaign.' });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to remove media.') });
    }
  }, [editingCampaignId, apiClient, onNotify, onMutate]);

  const loadLibraryMedia = useCallback(async (search?: string) => {
    if (libraryAbortRef.current) libraryAbortRef.current.abort();
    const controller = new AbortController();
    libraryAbortRef.current = controller;
    setLibraryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('per_page', '50');
      if (search) params.set('search', search);
      const response = await apiClient.get<{ items: MediaItem[]; total: number }>(
        `/wp-json/wp-super-gallery/v1/media/library?${params.toString()}`,
      );
      if (!controller.signal.aborted) setLibraryMedia(response.items ?? []);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setLibraryMedia([]);
    } finally {
      if (!controller.signal.aborted) {
        setLibraryLoading(false);
        libraryAbortRef.current = null;
      }
    }
  }, [apiClient]);

  const handleAddFromLibrary = useCallback(async (libraryItem: MediaItem) => {
    if (!editingCampaignId) return;
    if (mediaItems.some((m) => m.id === libraryItem.id || m.url === libraryItem.url)) {
      onNotify({ type: 'error', text: 'This media is already in the campaign.' });
      return;
    }
    try {
      const order = mediaItems.length + 1;
      const response = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editingCampaignId}/media`,
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
      setMediaItems((prev) => [...prev, response]);
      onNotify({ type: 'success', text: 'Media added to campaign.' });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
    }
  }, [editingCampaignId, mediaItems, apiClient, onNotify, onMutate]);

  const handleAddExternalMedia = useCallback(async () => {
    if (!editingCampaignId || !addMediaUrl) return;
    setAddMediaLoading(true);
    try {
      const order = mediaItems.length + 1;
      const response = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editingCampaignId}/media`,
        { type: addMediaType, source: 'external', url: addMediaUrl, caption: addMediaCaption || undefined, order },
      );
      setMediaItems((prev) => [...prev, response]);
      setAddMediaUrl('');
      setAddMediaCaption('');
      onNotify({ type: 'success', text: 'Media added.' });
      setActiveTab('media');
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
    } finally {
      setAddMediaLoading(false);
    }
  }, [editingCampaignId, addMediaUrl, addMediaType, addMediaCaption, mediaItems, apiClient, onNotify, onMutate]);

  const handleUploadMedia = useCallback(async (file: File) => {
    if (!editingCampaignId || !file) return;
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
      const order = mediaItems.length + 1;
      const newMedia = await apiClient.post<MediaItem>(
        `/wp-json/wp-super-gallery/v1/campaigns/${editingCampaignId}/media`,
        { type: mediaType, source: 'upload', url: response.url, thumbnail: response.thumbnail ?? response.url, attachmentId: response.attachmentId, order },
      );
      setMediaItems((prev) => [...prev, newMedia]);
      onNotify({ type: 'success', text: 'File uploaded and added to campaign.' });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Upload failed.') });
    } finally {
      setUploadFile(null);
      resetProgress();
    }
  }, [editingCampaignId, mediaItems, apiClient, upload, resetProgress, onNotify, onMutate]);

  return {
    // Modal state
    opened,
    mode,
    editingCampaignId,

    // Form
    formState,
    updateForm,
    isSaving,

    // Thumbnail
    coverImageUploading,
    handleSelectCoverImage,
    handleUploadCoverImage,

    // Tabs
    activeTab,
    setActiveTab,

    // Media
    mediaItems,
    mediaLoading,
    handleRemoveMedia,
    handleAddFromLibrary,
    handleUploadMedia,
    handleAddExternalMedia,
    uploadFile,
    uploadProgress,
    addMediaUrl,
    setAddMediaUrl,
    addMediaType,
    setAddMediaType,
    addMediaCaption,
    setAddMediaCaption,
    addMediaLoading,

    // Library
    libraryMedia,
    libraryLoading,
    librarySearch,
    setLibrarySearch,
    loadLibraryMedia,

    // Actions
    openForEdit,
    openForCreate,
    close,
    save,
  };
}

export type UnifiedCampaignModalHandle = ReturnType<typeof useUnifiedCampaignModal>;
