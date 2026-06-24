import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { showNotification } from '@mantine/notifications';
import { getErrorMessage } from '@wp-super-gallery/shared-utils';
import { getMediaItemsQueryKey } from '@/services/adminQuery';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem, OEmbedResponse } from '@/types';
import type { QueryClient } from '@tanstack/react-query';

function getMediaTypeFromUrl(url: string): 'image' | 'video' {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff'];
  const lowerUrl = url.toLowerCase();
  if (imageExtensions.some(ext => lowerUrl.includes(ext))) {
    return 'image';
  }
  // Default to video for external links, as most oEmbed content is video
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

export function useMediaExternal({
  apiClient,
  campaignId,
  setMedia,
  queryClient,
  onCampaignsUpdated,
  setAddOpen,
}: {
  apiClient: ApiClient;
  campaignId: string;
  setMedia: Dispatch<SetStateAction<MediaItem[]>>;
  queryClient: QueryClient;
  onCampaignsUpdated?: (() => void) | undefined;
  setAddOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const [externalUrl, setExternalUrl] = useState('');
  const [externalPreview, setExternalPreview] = useState<OEmbedResponse | null>(null);
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);

  async function handleAddExternal() {
    if (!externalUrl) return;
    if (!isValidExternalUrl(externalUrl)) {
      showNotification({ title: 'Invalid URL', message: 'Please enter a valid https URL.', color: 'red' });
      return;
    }
    try {
      const inferredType = externalPreview?.type || getMediaTypeFromUrl(externalUrl);
      const payload: Record<string, unknown> = {
        type: inferredType,
        source: 'external',
        provider: externalPreview?.provider ?? externalPreview?.provider_name ?? 'external',
        url: externalUrl,
        caption: externalPreview?.title ?? '',
        thumbnail: externalPreview?.thumbnail_url ?? undefined,
      };
      const created = await apiClient.post<MediaItem>(`/wp-json/wp-super-gallery/v1/campaigns/${campaignId}/media`, payload);
      setMedia((m) => [...m, created]);
      queryClient.setQueryData<MediaItem[]>(getMediaItemsQueryKey(apiClient, campaignId), (prev) => [...(prev ?? []), created]);
      setExternalUrl('');
      setExternalPreview(null);
      setAddOpen(false);
      showNotification({ title: 'Added', message: 'External media added.' });
      onCampaignsUpdated?.();
    } catch (err) {
      console.error(err);
      showNotification({ title: 'Add failed', message: getErrorMessage(err, 'Failed to add external media.'), color: 'red' });
    }
  }

  async function handleFetchOEmbed() {
    if (!externalUrl) return;
    if (!isValidExternalUrl(externalUrl)) {
      setExternalError('Please enter a valid https URL.');
      return;
    }
    try {
      setExternalLoading(true);
      setExternalError(null);
      // Rely on server-side proxy to avoid CORS/provider restrictions.
      // The server implements provider handlers and caching; if it cannot
      // fetch a preview it will return a non-200 or error payload.
      const data = await apiClient.get<OEmbedResponse>(`/wp-json/wp-super-gallery/v1/oembed?url=${encodeURIComponent(externalUrl)}`);
      if (data) {
        setExternalPreview(data);
        showNotification({ title: 'Preview loaded', message: data.title ?? 'Preview available' });
      } else {
        throw new Error('No preview available');
      }
    } catch (err) {
      console.error(err);
      setExternalError(getErrorMessage(err, 'Failed to load preview.'));
      showNotification({ title: 'Preview failed', message: getErrorMessage(err, 'Failed to load preview.'), color: 'red' });
    } finally {
      setExternalLoading(false);
    }
  }

  return {
    externalUrl,
    setExternalUrl,
    externalPreview,
    externalLoading,
    externalError,
    handleAddExternal,
    handleFetchOEmbed,
  };
}
