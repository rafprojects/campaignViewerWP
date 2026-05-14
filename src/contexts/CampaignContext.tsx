import { createContext, useContext, useState, useCallback } from 'react';
import type { Campaign } from '@/types';

interface CampaignContextValue {
  /** The campaign currently open in CampaignViewer (null when closed). */
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;
  onEditCampaign?: ((campaign: Campaign) => void) | undefined;
  onEditGalleryConfig?: ((campaign: Campaign) => void) | undefined;
  setOnEditGalleryConfig: (handler?: (campaign: Campaign) => void) => void;
  onArchiveCampaign?: ((campaign: Campaign) => void) | undefined;
  onAddExternalMedia?: ((campaign: Campaign) => void) | undefined;
}

const CampaignContext = createContext<CampaignContextValue>({
  activeCampaign: null,
  setActiveCampaign: () => { },
  setOnEditGalleryConfig: () => { },
});

export function useCampaignContext() {
  return useContext(CampaignContext);
}

interface CampaignContextProviderProps {
  children: React.ReactNode;
  onEditCampaign?: ((campaign: Campaign) => void) | undefined;
  onEditGalleryConfig?: ((campaign: Campaign) => void) | undefined;
  onArchiveCampaign?: ((campaign: Campaign) => void) | undefined;
  onAddExternalMedia?: ((campaign: Campaign) => void) | undefined;
}

export function CampaignContextProvider({
  children,
  onEditCampaign,
  onEditGalleryConfig,
  onArchiveCampaign,
  onAddExternalMedia,
}: CampaignContextProviderProps) {
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [registeredEditGalleryConfig, setRegisteredEditGalleryConfig] = useState<
    ((campaign: Campaign) => void) | undefined
  >(undefined);

  const value: CampaignContextValue = {
    activeCampaign,
    setActiveCampaign: useCallback((c: Campaign | null) => setActiveCampaign(c), []),
    onEditCampaign,
    onEditGalleryConfig: registeredEditGalleryConfig ?? onEditGalleryConfig,
    setOnEditGalleryConfig: useCallback((handler?: (campaign: Campaign) => void) => {
      setRegisteredEditGalleryConfig(() => handler);
    }, []),
    onArchiveCampaign,
    onAddExternalMedia,
  };

  return (
    <CampaignContext.Provider value={value}>
      {children}
    </CampaignContext.Provider>
  );
}
