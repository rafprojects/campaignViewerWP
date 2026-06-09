import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { safeLocalStorage } from '@/lib/safeLocalStorage';
import type { ApiClient } from '@/services/apiClient';
import type { MediaItem } from '@/types';
import { useAllCampaignOptions, useMediaItems } from '@/services/adminQuery';

interface Campaign {
  id: number;
  title: string;
}

interface UseBuilderCampaignMediaResult {
  campaigns: Campaign[];
  media: MediaItem[];
  selectedCampaignId: string | null;
  setSelectedCampaignId: Dispatch<SetStateAction<string | null>>;
}

/** Fetches campaign list + media for the selected campaign, persisting the selection per-template. */
export function useBuilderCampaignMedia(
  apiClient: ApiClient,
  opened: boolean,
  initialTemplateId: string | undefined,
): UseBuilderCampaignMediaResult {
  const campaignOptions = useAllCampaignOptions(apiClient, 'all', opened);
  const campaigns = useMemo(
    () => campaignOptions.map((campaign) => ({ id: Number(campaign.id), title: campaign.title })),
    [campaignOptions],
  );

  const campaignSelectionStorageKey = useMemo(
    () => `wpsg_layout_builder_campaign_${initialTemplateId ?? 'new'}`,
    [initialTemplateId],
  );

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Restore campaign selection when editor opens.
  useEffect(() => {
    if (!opened || !campaigns || campaigns.length === 0) return;

    const saved = safeLocalStorage.getItem(campaignSelectionStorageKey);
    const hasSaved = saved && campaigns.some((c) => String(c.id) === saved);

    if (hasSaved) {
      setSelectedCampaignId(saved);
      return;
    }

    setSelectedCampaignId((curr) => {
      if (curr && campaigns.some((c) => String(c.id) === curr)) return curr;
      return String(campaigns[0]!.id);
    });
  }, [opened, campaigns, campaignSelectionStorageKey]);

  // Persist campaign selection per-layout while editing.
  useEffect(() => {
    if (!selectedCampaignId) return;
    safeLocalStorage.setItem(campaignSelectionStorageKey, selectedCampaignId);
  }, [selectedCampaignId, campaignSelectionStorageKey]);

  const { mediaItems: campaignMedia } = useMediaItems(apiClient, opened ? (selectedCampaignId ?? '') : '');
  const media = useMemo(() => campaignMedia ?? [], [campaignMedia]);

  return { campaigns, media, selectedCampaignId, setSelectedCampaignId };
}
