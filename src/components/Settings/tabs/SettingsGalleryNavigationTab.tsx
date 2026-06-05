import { memo, type ReactNode } from 'react';
import type { SettingsData } from '@/contexts/SettingsStore';
import { GalleryNavigationAccordion } from '../MediaDisplaySettingsSection';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface SettingsGalleryNavigationTabProps {
  settings: SettingsData;
  updateSetting: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
  tooltipLabel: (label: string, key: string) => ReactNode;
}

export const SettingsGalleryNavigationTab = memo(function SettingsGalleryNavigationTab({
  settings,
  updateSetting,
  tooltipLabel,
}: SettingsGalleryNavigationTabProps) {
  return (
    <GalleryNavigationAccordion
      settings={settings}
      updateSetting={updateSetting}
      tooltipLabel={tooltipLabel}
    />
  );
});
setWpsgDebugDisplayName(SettingsGalleryNavigationTab, 'SettingsPanel:GalleryNavigationTab');
