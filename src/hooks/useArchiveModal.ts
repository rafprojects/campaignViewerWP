/**
 * useArchiveModal
 *
 * Encapsulates state and handlers for the Archive Campaign confirmation modal.
 */
import { useState } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { Campaign } from '@/types';
import { ApiError } from '@/services/apiClient';

interface UseArchiveModalOptions {
  apiClient: ApiClient;
  isAdmin: boolean;
  onMutate: () => Promise<unknown>;
  onNotify: (msg: { type: 'error' | 'success'; text: string }) => void;
}

export function useArchiveModal({
  apiClient,
  isAdmin,
  onMutate,
  onNotify,
}: UseArchiveModalOptions) {
  const [archiveModalCampaign, setArchiveModalCampaign] = useState<Campaign | null>(null);

  const handleArchiveCampaign = (campaign: Campaign) => {
    if (!isAdmin) {
      onNotify({ type: 'error', text: 'Admin permissions required.' });
      return;
    }
    setArchiveModalCampaign(campaign);
  };

  const confirmArchiveCampaign = async () => {
    if (!archiveModalCampaign) return;
    try {
      await apiClient.post(
        `/wp-json/wp-super-gallery/v1/campaigns/${archiveModalCampaign.id}/archive`,
        {},
      );
      onNotify({ type: 'success', text: 'Campaign archived.' });
      setArchiveModalCampaign(null);
      await onMutate();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        onNotify({ type: 'error', text: 'Admin permissions required.' });
      } else {
        onNotify({ type: 'error', text: 'Failed to archive campaign.' });
      }
    }
  };

  return {
    archiveModalCampaign,
    setArchiveModalCampaign,
    handleArchiveCampaign,
    confirmArchiveCampaign,
  };
}
