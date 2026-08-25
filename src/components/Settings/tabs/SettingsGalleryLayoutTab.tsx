import { memo } from 'react';
import type { SettingsData } from '@/contexts/SettingsStore';
import type { UpdateGallerySetting } from '../GalleryAdapterSettingsSection';
import { GalleryLayoutSettingsSection } from '../GalleryLayoutSettingsSection';
import { setMullionDebugDisplayName } from '@/utils/mullionDebug';

interface SettingsGalleryLayoutTabProps {
  settings: SettingsData;
  updateSetting: UpdateGallerySetting;
  onOpenResponsiveConfig: () => void;
}

export const SettingsGalleryLayoutTab = memo(function SettingsGalleryLayoutTab({
  settings,
  updateSetting,
  onOpenResponsiveConfig,
}: SettingsGalleryLayoutTabProps) {
  return (
    <GalleryLayoutSettingsSection
      settings={settings}
      updateSetting={updateSetting}
      onOpenResponsiveConfig={onOpenResponsiveConfig}
    />
  );
});
setMullionDebugDisplayName(SettingsGalleryLayoutTab, 'SettingsPanel:GalleryLayoutTab');
