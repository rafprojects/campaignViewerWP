import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { showNotification } from '@mantine/notifications';
import { useXhrUpload } from '@wp-super-gallery/shared-utils';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import { getMediaItemsQueryKey } from '@/services/adminQuery';
import type { ApiClient } from '@/services/apiClient';
import type {
  BatchUploadResponse,
  CampaignMediaBatchRequestItem,
  MediaItem,
  UploadDuplicateCampaign,
} from '@/types';
import type { QueryClient } from '@tanstack/react-query';

export interface NearDuplicateEntry {
  file: File;
  filename: string;
  similarId: number;
  similarUrl: string;
  distance: number;
  similarName: string;
  campaigns: UploadDuplicateCampaign[];
}

function normalizeSelectedFiles(value: File | File[] | null): File[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getNextMediaOrder(items: MediaItem[]): number {
  return items.reduce((maxOrder, item) => Math.max(maxOrder, item.order ?? 0), 0) + 1;
}

export function useMediaUpload({
  apiClient,
  campaignId,
  maxBatchUploadSize,
  media,
  setMedia,
  queryClient,
  onCampaignsUpdated,
  setAddOpen,
}: {
  apiClient: ApiClient;
  campaignId: string;
  maxBatchUploadSize: number;
  media: MediaItem[];
  setMedia: Dispatch<SetStateAction<MediaItem[]>>;
  queryClient: QueryClient;
  onCampaignsUpdated?: (() => void) | undefined;
  setAddOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadErrors, setUploadErrors] = useState<Array<string | null>>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [pendingNearDuplicates, setPendingNearDuplicates] = useState<NearDuplicateEntry[]>([]);
  const [nearDupLoading, setNearDupLoading] = useState(false);

  const { upload, uploadMany, batchProgress, isUploading: uploading, resetProgress } = useXhrUpload();

  const handleSelectFiles = useCallback((value: File | File[] | null) => {
    if (value === null) return;
    const incoming = normalizeSelectedFiles(value);
    const mediaFiles = incoming.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
    const skippedCount = incoming.length - mediaFiles.length;

    if (skippedCount > 0) {
      showNotification({
        title: 'Some files were skipped',
        message: `${skippedCount} non-media file${skippedCount === 1 ? '' : 's'} ${skippedCount === 1 ? 'was' : 'were'} ignored.`,
        color: 'yellow',
      });
    }

    const existingKeys = new Set(selectedFiles.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
    const merged = [
      ...selectedFiles,
      ...mediaFiles.filter((f) => !existingKeys.has(`${f.name}-${f.size}-${f.lastModified}`)),
    ];

    if (merged.length > maxBatchUploadSize) {
      showNotification({
        title: 'Batch limit reached',
        message: `Only the first ${maxBatchUploadSize} files were kept.`,
        color: 'yellow',
      });
    }

    const limited = merged.slice(0, maxBatchUploadSize);
    setSelectedFiles(limited);
    setUploadErrors(Array(limited.length).fill(null));
    if (limited.length !== 1) {
      setUploadTitle('');
      setUploadCaption('');
    }
  }, [maxBatchUploadSize, selectedFiles]);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadErrors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearFiles = useCallback(() => {
    setSelectedFiles([]);
    setUploadErrors([]);
    setUploadTitle('');
    setUploadCaption('');
  }, []);

  async function handleUpload() {
    if (selectedFiles.length === 0) return;

    try {
      setUploadErrors(Array(selectedFiles.length).fill(null));

      const authHeaders = await apiClient.getAuthHeaders();
      const uploadResponse = await uploadMany<BatchUploadResponse>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        files: selectedFiles,
        headers: authHeaders,
        extraFields: { campaign_id: String(campaignId) },
      });

      const nextOrder = getNextMediaOrder(media);
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
        order: nextOrder + index,
      }));

      let addedMedia: MediaItem[] = [];
      let batchAddFailures = 0;

      if (batchItems.length > 0) {
        const batchAddResponse = await apiClient.addCampaignMediaBatch(campaignId, batchItems);
        addedMedia = batchAddResponse.added;
        batchAddFailures = batchAddResponse.failed.length;

        if (addedMedia.length > 0) {
          setMedia((current) => [...current, ...addedMedia]);
          queryClient.setQueryData<MediaItem[]>(
            getMediaItemsQueryKey(apiClient, campaignId),
            (prev) => [...(prev ?? []), ...addedMedia],
          );
          onCampaignsUpdated?.();
        }
      }

      // Separate near-duplicates (interactive resolution) from hard errors.
      const nearDupEntries: NearDuplicateEntry[] = uploadResponse.results
        .map((result, index) => ({ result, file: selectedFiles[index] }))
        .filter(({ result, file }) => Boolean(file) && !result.success && result.near_duplicate === true)
        .map(({ result, file }) => ({
          file: file!,
          filename: file!.name,
          similarId: result.similar_id!,
          similarUrl: result.similar_url!,
          distance: result.distance ?? 0,
          similarName: result.similar_name ?? '',
          campaigns: result.similar_campaigns ?? [],
        }));

      const nearDupFiles = new Set(nearDupEntries.map((e) => e.file));

      const failedUploadEntries = uploadResponse.results
        .map((result, index) => {
          let error: string | null = null;
          if (!result.success && !result.near_duplicate) {
            if (result.duplicate && result.existing_name) {
              const name = result.existing_name;
              const camps = result.existing_campaigns ?? [];
              if (camps.length === 0) {
                error = `Already uploaded as '${name}'`;
              } else if (camps.length === 1) {
                error = `Already uploaded as '${name}' — used in ${camps[0]!.title}`;
              } else {
                error = `Already uploaded as '${name}' — used in ${camps.length} campaigns`;
              }
            } else {
              error = result.error ?? 'Upload failed.';
            }
          }
          return { file: selectedFiles[index], error };
        })
        .filter((entry): entry is { file: File; error: string } =>
          Boolean(entry.file) && Boolean(entry.error) && !nearDupFiles.has(entry.file!),
        );

      if (nearDupEntries.length > 0) {
        setPendingNearDuplicates((prev) => [...prev, ...nearDupEntries]);
      }

      const uploadedCount = addedMedia.length;
      const totalCount = selectedFiles.length;
      const hasFailures = failedUploadEntries.length > 0 || batchAddFailures > 0;

      if (failedUploadEntries.length > 0) {
        setSelectedFiles(failedUploadEntries.map((entry) => entry.file));
        setUploadErrors(failedUploadEntries.map((entry) => entry.error));
      } else {
        setSelectedFiles([]);
        setUploadErrors([]);
        setUploadTitle('');
        setUploadCaption('');
        setAddOpen(false);
      }

      showNotification({
        title: hasFailures ? 'Upload complete with issues' : 'Upload complete',
        message: `${uploadedCount} of ${totalCount} file${totalCount === 1 ? '' : 's'} uploaded successfully.${batchAddFailures > 0 ? ` ${batchAddFailures} file${batchAddFailures === 1 ? '' : 's'} could not be added to the campaign.` : ''}`,
        color: hasFailures ? 'yellow' : 'blue',
      });
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Upload failed', message: getErrorMessage(err, 'Upload failed.'), color: 'red' });
    } finally {
      resetProgress();
    }
  }

  // P38-MD1: Near-duplicate resolution handlers.
  async function handleNearDupUseExisting() {
    const entry = pendingNearDuplicates[0];
    if (!entry) return;
    setNearDupLoading(true);
    try {
      const nextOrder = getNextMediaOrder(media);
      const batchAddResponse = await apiClient.addCampaignMediaBatch(campaignId, [{
        type: 'image',
        source: 'upload',
        provider: 'wordpress',
        attachmentId: entry.similarId,
        url: entry.similarUrl,
        thumbnail: entry.similarUrl,
        caption: entry.filename,
        order: nextOrder,
      }]);
      if (batchAddResponse.added.length > 0) {
        setMedia((current) => [...current, ...batchAddResponse.added]);
        queryClient.setQueryData<MediaItem[]>(
          getMediaItemsQueryKey(apiClient, campaignId),
          (prev) => [...(prev ?? []), ...batchAddResponse.added],
        );
        onCampaignsUpdated?.();
        showNotification({ title: 'Existing image added', message: `Using existing image for "${entry.filename}".`, color: 'blue' });
      }
    } catch (err) {
      showNotification({ title: 'Failed to add image', message: getErrorMessage(err, 'Could not add existing image.'), color: 'red' });
    } finally {
      setNearDupLoading(false);
      setPendingNearDuplicates((prev) => prev.slice(1));
    }
  }

  async function handleNearDupUploadAnyway() {
    const entry = pendingNearDuplicates[0];
    if (!entry) return;
    setNearDupLoading(true);
    try {
      const authHeaders = await apiClient.getAuthHeaders();
      const singleResult = await upload<{ attachmentId: number; url: string; thumbnail?: string }>({
        url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
        file: entry.file,
        headers: authHeaders,
        extraFields: { force: '1', campaign_id: String(campaignId) },
      });
      const nextOrder = getNextMediaOrder(media);
      const batchAddResponse = await apiClient.addCampaignMediaBatch(campaignId, [{
        type: entry.file.type.startsWith('image') ? 'image' : 'video',
        source: 'upload',
        provider: 'wordpress',
        attachmentId: singleResult.attachmentId,
        url: singleResult.url,
        thumbnail: singleResult.thumbnail ?? singleResult.url,
        caption: entry.filename,
        order: nextOrder,
      }]);
      if (batchAddResponse.added.length > 0) {
        setMedia((current) => [...current, ...batchAddResponse.added]);
        queryClient.setQueryData<MediaItem[]>(
          getMediaItemsQueryKey(apiClient, campaignId),
          (prev) => [...(prev ?? []), ...batchAddResponse.added],
        );
        onCampaignsUpdated?.();
        showNotification({ title: 'Image uploaded', message: `"${entry.filename}" uploaded successfully.`, color: 'blue' });
      }
    } catch (err) {
      showNotification({ title: 'Upload failed', message: getErrorMessage(err, 'Upload failed.'), color: 'red' });
    } finally {
      setNearDupLoading(false);
      setPendingNearDuplicates((prev) => prev.slice(1));
    }
  }

  function handleNearDupDismiss() {
    setPendingNearDuplicates((prev) => prev.slice(1));
  }

  return {
    selectedFiles,
    uploadErrors,
    uploadTitle,
    setUploadTitle,
    uploadCaption,
    setUploadCaption,
    batchProgress,
    uploading,
    pendingNearDuplicates,
    nearDupLoading,
    handleSelectFiles,
    handleRemoveFile,
    handleClearFiles,
    handleUpload,
    handleNearDupUseExisting,
    handleNearDupUploadAnyway,
    handleNearDupDismiss,
  };
}
