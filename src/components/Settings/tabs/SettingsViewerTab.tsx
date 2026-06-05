import { memo } from 'react';
import type { SettingsData } from '@/contexts/SettingsStore';
import type { UpdateGallerySetting } from '../GalleryAdapterSettingsSection';
import { CampaignViewerSettingsSection } from '../CampaignViewerSettingsSection';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface SettingsViewerTabProps {
  settings: SettingsData;
  updateSetting: UpdateGallerySetting;
}

export const SettingsViewerTab = memo(function SettingsViewerTab({
  settings,
  updateSetting,
}: SettingsViewerTabProps) {
  return (
    <CampaignViewerSettingsSection
      settings={settings}
      updateSetting={updateSetting}
    />
  );
});
setWpsgDebugDisplayName(SettingsViewerTab, 'SettingsPanel:ViewerTab');
