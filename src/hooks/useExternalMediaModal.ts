/**
 * useExternalMediaModal
 *
 * Encapsulates state and handlers for the Add External Media modal in App.tsx.
 */
import { useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign } from '@/types';
import { ApiError } from '@/services/apiClient';

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
  const [externalMediaType, setExternalMediaType] = useState<'video' | 'image'>('video');
  const [externalMediaUrl, setExternalMediaUrl] = useState('');
  const [externalMediaCaption, setExternalMediaCaption] = useState('');
  const [externalMediaThumbnail, setExternalMediaThumbnail] = useState('');

  const handleAddExternalMedia = (campaign: Campaign) => {
    if (!isAdmin) {
      onNotify({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setExternalMediaType('video');
    setExternalMediaUrl('');
    setExternalMediaCaption('');
    setExternalMediaThumbnail('');
    setExternalMediaCampaign(campaign);
  };

  const confirmAddExternalMedia = async () => {
    if (!externalMediaCampaign || !externalMediaUrl) return;
    const order =
      externalMediaCampaign.videos.length +
      externalMediaCampaign.images.length +
      1;
    try {
      await apiClient.post(
        `/wp-json/wp-super-gallery/v1/campaigns/${externalMediaCampaign.id}/media`,
        {
          type: externalMediaType,
          source: 'external',
          url: externalMediaUrl,
          caption: externalMediaCaption || undefined,
          thumbnail: externalMediaThumbnail || undefined,
          order,
        },
      );
      onNotify({ type: 'success', text: 'Media added.' });
      setExternalMediaCampaign(null);
      await onMutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        onNotify({ type: 'error', text: 'Admin permissions required.' });
      } else {
        onNotify({ type: 'error', text: 'Failed to add media.' });
      }
    }
  };

  return {
    externalMediaCampaign,
    setExternalMediaCampaign,
    externalMediaType,
    setExternalMediaType,
    externalMediaUrl,
    setExternalMediaUrl,
    externalMediaCaption,
    setExternalMediaCaption,
    externalMediaThumbnail,
    setExternalMediaThumbnail,
    handleAddExternalMedia,
    confirmAddExternalMedia,
  };
}
