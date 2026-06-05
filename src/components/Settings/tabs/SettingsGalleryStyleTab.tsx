import { memo, type ReactNode } from 'react';
import type { SettingsData } from '@/contexts/SettingsStore';
import { GalleryStyleAccordion } from '../MediaDisplaySettingsSection';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface SettingsGalleryStyleTabProps {
  settings: SettingsData;
  updateSetting: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
  tooltipLabel: (label: string, key: string) => ReactNode;
}

export const SettingsGalleryStyleTab = memo(function SettingsGalleryStyleTab({
  settings,
  updateSetting,
  tooltipLabel,
}: SettingsGalleryStyleTabProps) {
  return (
    <GalleryStyleAccordion
      settings={settings}
      updateSetting={updateSetting}
      tooltipLabel={tooltipLabel}
    />
  );
});
setWpsgDebugDisplayName(SettingsGalleryStyleTab, 'SettingsPanel:GalleryStyleTab');
