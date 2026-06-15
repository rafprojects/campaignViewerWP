/**
 * useExternalMediaModal
 *
 * Encapsulates state and handlers for the shared campaign media-entry modal in App.tsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import { useGetSettings } from '@/services/settingsQuery';
import type {
  BatchUploadResponse,
  Campaign,
  CampaignMediaBatchRequestItem,
  OEmbedResponse,
} from '@/types';
import { ApiError } from '@/services/apiClient';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import { useXhrUpload } from '@wp-super-gallery/shared-utils';

function normalizeSelectedFiles(value: File | File[] | null): File[] {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Array<string | null>>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const dropRef = useRef<HTMLDivElement | null>(null);
  const { data: settingsResponse } = useGetSettings(apiClient);
  const { uploadMany, isUploading: uploading, batchProgress, resetProgress } = useXhrUpload();
  const maxBatchUploadSize = settingsResponse?.maxBatchUploadSize ?? 20;

  const handleSelectFiles = useCallback((value: File | File[] | null) => {
    const nextFiles = normalizeSelectedFiles(value);
    const mediaFiles = nextFiles.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    const limitedFiles = mediaFiles.slice(0, maxBatchUploadSize);

    if (nextFiles.length !== mediaFiles.length) {
      onNotify({ type: 'error', text: 'Only image and video files can be uploaded.' });
    }

    if (mediaFiles.length > maxBatchUploadSize) {
      onNotify({ type: 'error', text: `Only the first ${maxBatchUploadSize} files were kept.` });
    }

    setSelectedFiles(limitedFiles);
    setUploadErrors(Array(limitedFiles.length).fill(null));
    if (limitedFiles.length !== 1) {
      setUploadTitle('');
      setUploadCaption('');
    }
  }, [maxBatchUploadSize, onNotify]);

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
      const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
      if (files.length > 0) {
        handleSelectFiles(files);
      }
    };

    element.addEventListener('dragover', handleDragOver);
    element.addEventListener('drop', handleDrop);

    return () => {
      element.removeEventListener('dragover', handleDragOver);
      element.removeEventListener('drop', handleDrop);
    };
  }, [handleSelectFiles, maxBatchUploadSize]);

  useEffect(() => {
    if (selectedFiles.length !== 1) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFiles[0]!);
    setPreviewUrl(nextPreviewUrl);

    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFiles]);

  const resetModalState = () => {
    setSelectedFiles([]);
    setUploadErrors([]);
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
    if (!externalMediaCampaign || selectedFiles.length === 0) return;

    try {
      setUploadErrors(Array(selectedFiles.length).fill(null));

      const authHeaders = await apiClient.getAuthHeaders();
      const uploadResponse = await uploadMany<BatchUploadResponse>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        files: selectedFiles,
        headers: authHeaders,
      });

      const baseOrder = externalMediaCampaign.videos.length + externalMediaCampaign.images.length + 1;
      const successfulUploadEntries = uploadResponse.results
        .map((result, index) => ({ result, file: selectedFiles[index] }))
        .filter(({ result, file }) => Boolean(file) && result.success && result.attachmentId && result.url);

      const batchItems: CampaignMediaBatchRequestItem[] = successfulUploadEntries.map(({ result, file }, index) => ({
        type: file!.type.startsWith('image') ? 'image' : 'video',
        source: 'upload',
        provider: 'wordpress',
        attachmentId: result.attachmentId!,
        url: result.url!,
        thumbnail: result.thumbnail ?? result.url,
        caption: selectedFiles.length === 1
          ? uploadCaption.trim() || uploadTitle.trim() || file!.name
          : file!.name,
        title: selectedFiles.length === 1 ? uploadTitle.trim() || undefined : undefined,
        order: baseOrder + index,
      }));

      let batchAddFailures = 0;
      if (batchItems.length > 0) {
        const batchAddResponse = await apiClient.addCampaignMediaBatch(externalMediaCampaign.id, batchItems);
        batchAddFailures = batchAddResponse.failed.length;
      }

      const failedUploadEntries = uploadResponse.results
        .map((result, index) => ({
          file: selectedFiles[index],
          error: result.success ? null : (result.error ?? 'Upload failed.'),
        }))
        .filter((entry): entry is { file: File; error: string } => Boolean(entry.file) && Boolean(entry.error));

      if (failedUploadEntries.length > 0) {
        setSelectedFiles(failedUploadEntries.map((entry) => entry.file));
        setUploadErrors(failedUploadEntries.map((entry) => entry.error));
      } else {
        setExternalMediaCampaign(null);
        resetModalState();
      }

      const successCount = batchItems.length - batchAddFailures;
      const hasFailures = failedUploadEntries.length > 0 || batchAddFailures > 0;
      onNotify({
        type: hasFailures ? 'error' : 'success',
        text: `${successCount} of ${selectedFiles.length} file${selectedFiles.length === 1 ? '' : 's'} uploaded successfully.${batchAddFailures > 0 ? ` ${batchAddFailures} file${batchAddFailures === 1 ? '' : 's'} could not be added to the campaign.` : ''}`,
      });
      await onMutate();
    } catch (err) {
      onNotify({ type: 'error', text: getErrorMessage(err, 'Upload failed.') });
    } finally {
      resetProgress();
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
    selectedFiles,
    setSelectedFiles: handleSelectFiles,
    uploadErrors,
    previewUrl,
    uploadTitle,
    setUploadTitle,
    uploadCaption,
    setUploadCaption,
    uploadProgresses: batchProgress,
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
