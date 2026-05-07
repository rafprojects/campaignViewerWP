/**
 * useExternalMediaModal
 *
 * Encapsulates state and handlers for the shared campaign media-entry modal in App.tsx.
 */
import { useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign, OEmbedResponse, UploadResponse } from '@/types';
import { ApiError } from '@/services/apiClient';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { useXhrUpload } from './useXhrUpload';

interface UseExternalMediaModalOptions {
  apiClient: ApiClient;
  isAdmin: boolean;
  onMutate: () => Promise<unknown>;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function useExternalMediaModal({
  apiClient,
  isAdmin,
  onMutate,
  onNotify,
}: UseExternalMediaModalOptions) {
  const [externalMediaCampaign, setExternalMediaCampaign] =
    useState<Campaign | null>(null);
  const [externalMediaUrl, setExternalMediaUrl] = useState('');
  const [externalMediaError, setExternalMediaError] = useState<string | null>(null);
  const [externalMediaPreview, setExternalMediaPreview] = useState<OEmbedResponse | null>(null);
  const [externalMediaLoading, setExternalMediaLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const dropRef = useRef<HTMLDivElement | null>(null);
  const { upload, isUploading: uploading, progress: uploadProgress, resetProgress } = useXhrUpload();

  useEffect(() => {
    const element = dropRef.current;
    if (!element) {
      return;
    }

    const handleDragOver = (event: globalThis.DragEvent) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleDrop = (event: globalThis.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    };

    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  const resetModalState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadTitle('');
    setUploadCaption('');
    setExternalMediaUrl('');
    setExternalMediaError(null);
    setExternalMediaPreview(null);
    setExternalMediaLoading(false);
    resetProgress();
  };

  function getMediaTypeFromUrl(url: string): 'image' | 'video' {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
    const lowerUrl = url.toLowerCase();
    if (imageExtensions.some((extension) => lowerUrl.includes(extension))) {
      return 'image';
    }
    return 'video';
  }

  function isValidExternalUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  const handleAddExternalMedia = (campaign: Campaign) => {
    if (!isAdmin) {
      onNotify({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    resetModalState();
    setExternalMediaCampaign(campaign);
  };

  const confirmAddExternalMedia = async () => {
    if (!externalMediaCampaign || !externalMediaUrl) return;
    if (!isValidExternalUrl(externalMediaUrl)) {
      setExternalMediaError('Please enter a valid https URL.');
      onNotify({ type: 'error', text: 'Please enter a valid https URL.' });
      return;
    }

    const order =
      externalMediaCampaign.videos.length +
      externalMediaCampaign.images.length +
      1;

    try {
      await apiClient.post(
        `/wp-json/wp-super-gallery/v1/campaigns/${externalMediaCampaign.id}/media`,
        {
          type: externalMediaPreview?.type || getMediaTypeFromUrl(externalMediaUrl),
          source: 'external',
          provider: externalMediaPreview?.provider ?? externalMediaPreview?.provider_name ?? 'external',
          url: externalMediaUrl,
          caption: externalMediaPreview?.title || undefined,
          thumbnail: externalMediaPreview?.thumbnail_url || undefined,
          order,
        },
      );
      onNotify({ type: 'success', text: 'Media added.' });
      setExternalMediaCampaign(null);
      resetModalState();
      await onMutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        onNotify({ type: 'error', text: 'Admin permissions required.' });
      } else {
        onNotify({ type: 'error', text: getErrorMessage(err, 'Failed to add media.') });
      }
    }
  };

  const fetchExternalPreview = async () => {
    if (!externalMediaUrl) return;
    if (!isValidExternalUrl(externalMediaUrl)) {
      setExternalMediaError('Please enter a valid https URL.');
      return;
    }

    try {
      setExternalMediaLoading(true);
      setExternalMediaError(null);
      const response = await apiClient.get<OEmbedResponse>(
        `/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(externalMediaUrl)}`,
      );
      setExternalMediaPreview(response);
      onNotify({ type: 'success', text: response.title ?? 'Preview available.' });
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to preview external media.');
      setExternalMediaError(message);
      onNotify({ type: 'error', text: message });
    } finally {
      setExternalMediaLoading(false);
    }
  };

  const confirmUploadMedia = async () => {
    if (!externalMediaCampaign || !selectedFile) return;

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/ogg',
    ];
    const maxSize = 50 * 1024 * 1024;

    if (!allowedTypes.includes(selectedFile.type)) {
      onNotify({ type: 'error', text: 'File type not allowed. Accepted: JPEG, PNG, GIF, WebP, MP4, WebM, OGG.' });
      return;
    }

    if (selectedFile.size > maxSize) {
      onNotify({ type: 'error', text: `File too large (${Math.round(selectedFile.size / 1024 / 1024)} MB). Maximum size is 50 MB.` });
      return;
    }

    try {
      const authHeaders = await apiClient.getAuthHeaders();
      const uploadResponse = await upload<UploadResponse>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        file: selectedFile,
        headers: authHeaders,
      });

      const mediaType = selectedFile.type.startsWith('image') ? 'image' : 'video';
      const order = externalMediaCampaign.videos.length + externalMediaCampaign.images.length + 1;

      await apiClient.post(
        `/wp-json/wp-super-gallery/v1/campaigns/${externalMediaCampaign.id}/media`,
        {
          type: mediaType,
          source: 'upload',
          provider: 'wordpress',
          attachmentId: uploadResponse.attachmentId,
          url: uploadResponse.url,
          thumbnail: uploadResponse.thumbnail ?? uploadResponse.url,
          caption: uploadCaption.trim() || uploadTitle.trim() || selectedFile.name,
          title: uploadTitle.trim() || undefined,
          order,
        },
      );

      onNotify({ type: 'success', text: 'File uploaded and added to campaign.' });
      setExternalMediaCampaign(null);
      resetModalState();
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Upload failed.') });
    }
  };

  const closeExternalMediaModal = () => {
    setExternalMediaCampaign(null);
    resetModalState();
  };

  return {
    externalMediaCampaign,
    setExternalMediaCampaign,
    closeExternalMediaModal,
    dropRef,
    selectedFile,
    setSelectedFile,
    previewUrl,
    uploadTitle,
    setUploadTitle,
    uploadCaption,
    setUploadCaption,
    uploadProgress,
    uploading,
    confirmUploadMedia,
    externalMediaUrl,
    setExternalMediaUrl,
    externalMediaError,
    externalMediaPreview,
    externalMediaLoading,
    fetchExternalPreview,
    handleAddExternalMedia,
    confirmAddExternalMedia,
  };
}
