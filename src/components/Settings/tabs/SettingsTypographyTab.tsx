import { memo } from 'react';
import type { ApiClient } from '@/services/apiClient';
import type { TypographyOverride } from '@/types';
import type { SettingsData } from '@/contexts/SettingsStore';
import type { CustomFontEntry } from '@/components/Common/TypographyEditor';
import { TypographySettingsSection } from '../TypographySettingsSection';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

interface SettingsTypographyTabProps {
  apiClient: ApiClient;
  customFonts: CustomFontEntry[];
  setCustomFonts: (fonts: CustomFontEntry[]) => void;
  typographyOverrides: Record<string, TypographyOverride>;
  updateSetting: <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void;
  updateTypoOverride: (elementId: string, override: TypographyOverride) => void;
}

export const SettingsTypographyTab = memo(function SettingsTypographyTab({
  apiClient,
  customFonts,
  setCustomFonts,
  typographyOverrides,
  updateSetting,
  updateTypoOverride,
}: SettingsTypographyTabProps) {
  return (
    <TypographySettingsSection
      apiClient={apiClient}
      customFonts={customFonts}
      typographyOverrides={typographyOverrides}
      onFontsChange={(fonts) => setCustomFonts(fonts)}
      onResetAll={() => updateSetting('typographyOverrides', {})}
      onOverrideChange={updateTypoOverride}
    />
  );
});
setWpsgDebugDisplayName(SettingsTypographyTab, 'SettingsPanel:TypographyTab');
