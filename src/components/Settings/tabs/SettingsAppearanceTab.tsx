import { memo } from 'react';
import type { SettingsData } from '@/contexts/SettingsStore';
import { GeneralSettingsSection } from '../GeneralSettingsSection';
import { setMullionDebugDisplayName } from '@/utils/mullionDebug';

interface SettingsAppearanceTabProps {
  settings: SettingsData;
  updateSetting: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
  isSystemAdmin?: boolean;
}

export const SettingsAppearanceTab = memo(function SettingsAppearanceTab({
  settings,
  updateSetting,
  isSystemAdmin = false,
}: SettingsAppearanceTabProps) {
  return (
    <GeneralSettingsSection
      settings={settings}
      updateSetting={updateSetting}
      onThemeChange={(id) => updateSetting('theme', id)}
      isSystemAdmin={isSystemAdmin}
    />
  );
});
setMullionDebugDisplayName(SettingsAppearanceTab, 'SettingsPanel:AppearanceTab');
