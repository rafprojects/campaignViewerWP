/**
 * P50-I — Unified media upload container.
 *
 * A self-contained wrapper around {@link MediaAddModal} that owns the upload
 * state and routes uploads by a user-selected "Add to" target:
 *
 *  - **General library** → the campaign-agnostic overlay/asset library
 *    (`POST /admin/asset-library`), optionally marked universal.
 *  - **A campaign** → the campaign media flow (`POST /media/upload` then
 *    `addCampaignMediaBatch`).
 *
 * Used by the Layout Builder Media panel (defaults to the general library) and
 * the Admin → Campaigns "Add media" action (defaults to that campaign).
 *
 * Video/oEmbed embedding remains in MediaTab's richer flow; this controller
 * handles direct file uploads and direct image-URL registration.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Checkbox, Stack, TagsInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { MediaAddModal } from './MediaAddModal';
import type { ApiClient } from '@/services/apiClient';
import type {
  BatchUploadResponse,
  CampaignMediaBatchRequestItem,
  OEmbedResponse,
} from '@/types';
import { useXhrUpload } from '@wp-super-gallery/shared-utils';
import { getAssetLibraryQueryKey } from '@/services/layoutTemplateQuery';
import { getMediaItemsQueryKey } from '@/services/adminQuery';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

/** Sentinel target value for the campaign-agnostic general asset library. */
export const GENERAL_LIBRARY_TARGET = '__general__';

export interface MediaUploadControllerProps {
  opened: boolean;
  onClose: () => void;
  apiClient: ApiClient;
  campaigns: Array<{ id: number | string; title: string }>;
  /** `GENERAL_LIBRARY_TARGET` or a campaign id string. Defaults to the general library. */
  defaultTarget?: string;
  /** Whether the "General library" option is offered (default true). */
  allowGeneral?: boolean;
  /** Fired after a successful upload, with the target the upload routed to. */
  onUploaded?: (target: string) => void;
  title?: string;
  zIndex?: number;
}

export function MediaUploadController({
  opened,
  onClose,
  apiClient,
  campaigns,
  defaultTarget,
  allowGeneral = true,
  onUploaded,
  title = 'Add Media',
  zIndex,
}: MediaUploadControllerProps) {
  const queryClient = useQueryClient();
  const dropRef = useRef<HTMLDivElement>(null);
  const { uploadMany, batchProgress, isUploading } = useXhrUpload();

  const initialTarget = defaultTarget ?? (allowGeneral ? GENERAL_LIBRARY_TARGET : '');
  const [target, setTarget] = useState<string>(initialTarget);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadErrors, setUploadErrors] = useState<Array<string | null>>([]);
  const [markUniversal, setMarkUniversal] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [externalUrl, setExternalUrl] = useState('');
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalPreview, setExternalPreview] = useState<OEmbedResponse | null>(null);

  // Re-seed the target whenever the modal (re)opens or the default changes.
  useEffect(() => {
    if (opened) {
      setTarget(defaultTarget ?? (allowGeneral ? GENERAL_LIBRARY_TARGET : ''));
    }
  }, [opened, defaultTarget, allowGeneral]);

  const isGeneral = target === GENERAL_LIBRARY_TARGET;

  const targetOptions = [
    ...(allowGeneral ? [{ value: GENERAL_LIBRARY_TARGET, label: 'General library (all campaigns)' }] : []),
    ...campaigns.map((c) => ({ value: String(c.id), label: c.title })),
  ];

  const resetState = useCallback(() => {
    setSelectedFiles([]);
    setUploadTitle('');
    setUploadCaption('');
    setUploadErrors([]);
    setMarkUniversal(false);
    setTags([]);
    setExternalUrl('');
    setExternalError(null);
    setExternalPreview(null);
  }, []);

  const handleClose = useCallback(() => {
    if (busy || isUploading) return;
    resetState();
    onClose();
  }, [busy, isUploading, resetState, onClose]);

  const handleSelectFiles = useCallback((files: File[]) => {
    setSelectedFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      const merged = [...current];
      for (const f of files) {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        if (!seen.has(key)) merged.push(f);
      }
      return merged;
    });
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  }, []);

  // ── General library upload (per file → asset-library) ──────────────
  const uploadToGeneral = useCallback(async () => {
    let failures = 0;
    for (const file of selectedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('name', uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, ''));
        if (markUniversal) formData.append('is_universal', '1');
        if (tags.length) formData.append('tags', JSON.stringify(tags));
        await apiClient.postForm('/wp-json/wp-super-gallery/v1/admin/asset-library', formData);
      } catch {
        failures += 1;
      }
    }
    await queryClient.invalidateQueries({ queryKey: getAssetLibraryQueryKey(apiClient) });
    return failures;
  }, [selectedFiles, uploadTitle, markUniversal, tags, apiClient, queryClient]);

  // ── Campaign upload (batch → media/upload → addCampaignMediaBatch) ────
  const uploadToCampaign = useCallback(async (campaignId: string) => {
    const authHeaders = await apiClient.getAuthHeaders();
    const response = await uploadMany<BatchUploadResponse>({
      url: `${apiClient.getBaseUrl()}/wp-json/wp-super-gallery/v1/media/upload`,
      files: selectedFiles,
      headers: authHeaders,
      extraFields: { campaign_id: campaignId },
    });

    const single = selectedFiles.length === 1;
    const batchItems: CampaignMediaBatchRequestItem[] = response.results
      .map((result, index) => ({ result, file: selectedFiles[index] }))
      .filter(({ result, file }) => Boolean(file) && result.success && result.attachmentId && result.url)
      .map(({ result, file }) => ({
        type: file!.type.startsWith('image') ? ('image' as const) : ('video' as const),
        source: 'upload' as const,
        provider: 'wordpress',
        attachmentId: result.attachmentId!,
        url: result.url!,
        thumbnail: result.thumbnail ?? result.url,
        caption: single ? uploadCaption.trim() || uploadTitle.trim() || file!.name : file!.name,
        title: single ? uploadTitle.trim() || undefined : undefined,
      }));

    if (batchItems.length > 0) {
      await apiClient.addCampaignMediaBatch(campaignId, batchItems);
      await queryClient.invalidateQueries({ queryKey: getMediaItemsQueryKey(apiClient, campaignId) });
    }
    return response.results.filter((r) => !r.success).length;
  }, [apiClient, uploadMany, selectedFiles, uploadCaption, uploadTitle, queryClient]);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0 || !target) return;
    setBusy(true);
    setUploadErrors([]);
    try {
      const failures = isGeneral ? await uploadToGeneral() : await uploadToCampaign(target);
      const total = selectedFiles.length;
      const succeeded = total - failures;
      if (succeeded > 0) {
        notifications.show({
          message: `${succeeded} file${succeeded !== 1 ? 's' : ''} added${isGeneral ? ' to the asset library' : ''}`,
          color: 'green',
          autoClose: 3000,
        });
        onUploaded?.(target);
      }
      if (failures > 0) {
        notifications.show({
          title: 'Some uploads failed',
          message: `${failures} of ${total} file${total !== 1 ? 's' : ''} could not be uploaded.`,
          color: 'red',
          autoClose: 5000,
        });
      } else {
        resetState();
        onClose();
      }
    } catch (err) {
      notifications.show({
        title: 'Upload failed',
        message: err instanceof Error ? err.message : 'Upload failed.',
        color: 'red',
        autoClose: 5000,
      });
    } finally {
      setBusy(false);
    }
  }, [selectedFiles, target, isGeneral, uploadToGeneral, uploadToCampaign, onUploaded, resetState, onClose]);

  // ── External URL (direct image registration) ─────────────────────────
  const handleFetchExternal = useCallback(() => {
    setExternalError(null);
    if (!externalUrl.trim()) {
      setExternalError('Enter a URL to preview.');
      return;
    }
    setExternalPreview({ type: 'photo', thumbnail_url: externalUrl.trim(), title: externalUrl.trim() });
  }, [externalUrl]);

  const handleAddExternal = useCallback(async () => {
    const url = externalUrl.trim();
    if (!url || !target) return;
    setBusy(true);
    setExternalError(null);
    try {
      if (isGeneral) {
        await apiClient.post('/wp-json/wp-super-gallery/v1/admin/asset-library', {
          url,
          name: url.split('/').pop() || 'external asset',
          ...(markUniversal ? { is_universal: true } : {}),
          ...(tags.length ? { tags } : {}),
        });
        await queryClient.invalidateQueries({ queryKey: getAssetLibraryQueryKey(apiClient) });
      } else {
        await apiClient.addCampaignMediaBatch(target, [{
          type: 'image',
          source: 'external',
          url,
          thumbnail: url,
        }]);
        await queryClient.invalidateQueries({ queryKey: getMediaItemsQueryKey(apiClient, target) });
      }
      notifications.show({ message: 'External asset added', color: 'green', autoClose: 3000 });
      onUploaded?.(target);
      resetState();
      onClose();
    } catch (err) {
      setExternalError(err instanceof Error ? err.message : 'Failed to add external asset.');
    } finally {
      setBusy(false);
    }
  }, [externalUrl, target, isGeneral, markUniversal, tags, apiClient, queryClient, onUploaded, resetState, onClose]);

  return (
    <MediaAddModal
      opened={opened}
      onClose={handleClose}
      title={title}
      {...(zIndex !== undefined ? { zIndex } : {})}
      dropRef={dropRef}
      selectedFiles={selectedFiles}
      onSelectFiles={handleSelectFiles}
      onRemoveFile={handleRemoveFile}
      onClearFiles={() => setSelectedFiles([])}
      uploadTitle={uploadTitle}
      onUploadTitleChange={setUploadTitle}
      uploadCaption={uploadCaption}
      onUploadCaptionChange={setUploadCaption}
      uploadProgresses={isGeneral ? null : batchProgress}
      uploadErrors={uploadErrors}
      uploading={busy || isUploading}
      onUpload={handleUpload}
      externalUrl={externalUrl}
      onExternalUrlChange={setExternalUrl}
      externalError={externalError}
      onFetchOEmbed={handleFetchExternal}
      externalLoading={false}
      onAddExternal={handleAddExternal}
      externalPreview={externalPreview}
      targetOptions={targetOptions}
      targetValue={target}
      onTargetChange={(value) => setTarget(value ?? initialTarget)}
      targetExtra={
        isGeneral ? (
          <Stack gap={6}>
            <Checkbox
              size="xs"
              label="Make available to all spaces (universal)"
              checked={markUniversal}
              onChange={(e) => setMarkUniversal(e.currentTarget.checked)}
            />
            <TagsInput
              size="xs"
              label="Tags"
              placeholder="Add tags for filtering…"
              value={tags}
              onChange={setTags}
              clearable
            />
          </Stack>
        ) : undefined
      }
    />
  );
}

setWpsgDebugDisplayName(MediaUploadController, 'AdminPanel:MediaUploadController');
