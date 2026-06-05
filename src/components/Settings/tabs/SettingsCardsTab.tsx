import { memo } from 'react';
import { Accordion, Box, SegmentedControl, Stack, Text } from '@mantine/core';
import type { ApiClient } from '@/services/apiClient';
import type { CardConfigBreakpoint } from '@/types';
import type { SettingsData } from '@/contexts/SettingsStore';
import type { UpdateGallerySetting } from '../GalleryAdapterSettingsSection';
import { CampaignCardSettingsSection } from '../CampaignCardSettingsSection';
import { usePersistentAccordion } from '@/hooks/usePersistentAccordion';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

const CARD_SETTINGS_BREAKPOINT_OPTIONS: Array<{ value: CardConfigBreakpoint; label: string }> = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

interface SettingsCardsTabProps {
  settings: SettingsData;
  updateSetting: UpdateGallerySetting;
  apiClient: ApiClient;
  cardSettingsBreakpoint: CardConfigBreakpoint;
  setCardSettingsBreakpoint: (value: CardConfigBreakpoint) => void;
}

export const SettingsCardsTab = memo(function SettingsCardsTab({
  settings,
  updateSetting,
  apiClient,
  cardSettingsBreakpoint,
  setCardSettingsBreakpoint,
}: SettingsCardsTabProps) {
  const { value: cardAccordionValue, onChange: cardAccordionOnChange } = usePersistentAccordion('cards', 'appearance');

  return (
    <Stack gap="md">
      <Box>
        <Text size="sm" c="dimmed" mb="xs">
          Desktop edits the base card settings. Tablet and mobile can override selected layout and appearance fields without changing the desktop baseline.
        </Text>
        <SegmentedControl
          data={CARD_SETTINGS_BREAKPOINT_OPTIONS}
          value={cardSettingsBreakpoint}
          onChange={(value) => setCardSettingsBreakpoint(value as CardConfigBreakpoint)}
          aria-label="Card settings breakpoint"
          size="xs"
          fullWidth
        />
      </Box>
      <Accordion variant="separated" value={cardAccordionValue} onChange={cardAccordionOnChange}>
        <CampaignCardSettingsSection
          settings={settings}
          updateSetting={updateSetting}
          activeBreakpoint={cardSettingsBreakpoint}
          apiClient={apiClient}
        />
      </Accordion>
    </Stack>
  );
});
setWpsgDebugDisplayName(SettingsCardsTab, 'SettingsPanel:CardsTab');
