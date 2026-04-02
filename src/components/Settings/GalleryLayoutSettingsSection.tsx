import { Accordion, Button, Group, Text } from '@mantine/core';
import { useLazyAccordion } from '@/hooks/useLazyAccordion';

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
  const { mounted, onChange } = useLazyAccordion('adapters');

  return (
    <Accordion variant="separated" defaultValue="adapters" onChange={onChange}>
      <Accordion.Item value="adapters">
        <Accordion.Control>Gallery Adapters</Accordion.Control>
        <Accordion.Panel>
          <Group justify="space-between" align="flex-start" mb="md">
            <Text size="sm" c="dimmed" maw={560}>
              Quick breakpoint selectors stay inline here. Use the responsive editor when you need shared layout settings, adapter-specific fields, or deeper nested config changes.
            </Text>
            <Button variant="light" onClick={onOpenResponsiveConfig}>
              Edit Responsive Config
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