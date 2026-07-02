import { Accordion, Button, Group, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { usePersistentAccordion } from '@/hooks/usePersistentAccordion';

import type { GalleryBehaviorSettings } from '@/types';

import { GalleryAdapterSettingsSection, type UpdateGallerySetting } from './GalleryAdapterSettingsSection';
import { GalleryLayoutDetailSections } from './GalleryLayoutDetailSections';
import { GalleryPresentationSections } from './GalleryPresentationSections';

interface GalleryLayoutSettingsSectionProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
  onOpenResponsiveConfig: () => void;
}

export function GalleryLayoutSettingsSection({
  settings,
  updateSetting,
  onOpenResponsiveConfig,
}: GalleryLayoutSettingsSectionProps) {
  const { t } = useTranslation('wpsg');
  const { mounted, value, onChange } = usePersistentAccordion('gallery-layout', 'adapters');

  return (
    <Accordion variant="separated" value={value} onChange={onChange}>
      <Accordion.Item value="adapters">
        <Accordion.Control>{t('set_gl_adapters_title', 'Gallery Adapters')}</Accordion.Control>
        <Accordion.Panel>
          <Group justify="space-between" align="flex-start" mb="md">
            <Text size="sm" c="dimmed" maw={560}>
              {t('set_gl_adapters_desc', 'Quick breakpoint selectors stay inline here. Use the responsive editor when you need shared layout settings, adapter-specific fields, or deeper nested config changes.')}
            </Text>
            <Button variant="light" onClick={onOpenResponsiveConfig}>
              {t('set_gl_edit_responsive', 'Edit Responsive Config')}
            </Button>
          </Group>
          <GalleryAdapterSettingsSection
            settings={settings}
            updateSetting={updateSetting}
          />
        </Accordion.Panel>
      </Accordion.Item>

      <GalleryPresentationSections
        settings={settings}
        updateSetting={updateSetting}
        mountedPanels={mounted}
      />

      <GalleryLayoutDetailSections
        settings={settings}
        updateSetting={updateSetting}
        mountedPanels={mounted}
      />
    </Accordion>
  );
}