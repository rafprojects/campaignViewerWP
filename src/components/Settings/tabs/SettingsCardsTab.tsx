import { memo } from 'react';
import { Accordion, Box, SegmentedControl, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '@/services/apiClient';
import type { CardConfigBreakpoint } from '@/types';
import type { SettingsData } from '@/contexts/SettingsStore';
import type { UpdateGallerySetting } from '../GalleryAdapterSettingsSection';
import { CampaignCardSettingsSection } from '../CampaignCardSettingsSection';
import { usePersistentAccordion } from '@/hooks/usePersistentAccordion';
import { setWpsgDebugDisplayName } from '@/utils/wpsgDebug';

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
  const { t } = useTranslation('wpsg');
  const { value: cardAccordionValue, onChange: cardAccordionOnChange } = usePersistentAccordion('cards', 'appearance');
  const cardBreakpointOptions: Array<{ value: CardConfigBreakpoint; label: string }> = [
    { value: 'desktop', label: t('admin_bp_desktop', 'Desktop') },
    { value: 'tablet', label: t('admin_bp_tablet', 'Tablet') },
    { value: 'mobile', label: t('admin_bp_mobile', 'Mobile') },
  ];

  return (
    <Stack gap="md">
      <Box>
        <Text size="sm" c="dimmed" mb="xs">
          {t('set_cards_tab_intro', 'Desktop edits the base card settings. Tablet and mobile can override selected layout and appearance fields without changing the desktop baseline.')}
        </Text>
        <SegmentedControl
          data={cardBreakpointOptions}
          value={cardSettingsBreakpoint}
          onChange={(value) => setCardSettingsBreakpoint(value as CardConfigBreakpoint)}
          aria-label={t('set_cards_tab_bp_aria', 'Card settings breakpoint')}
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
