import { Accordion, Button, Divider, Stack, Text } from '@mantine/core';

import { TypographyEditor, type CustomFontEntry } from '@/components/Common/TypographyEditor';
import { FontLibraryManager } from '@/components/Admin/FontLibraryManager';
import type { ApiClient } from '@/services/apiClient';
import type { TypographyOverride } from '@/types';
import type { FontLibraryEntry } from '@/utils/loadCustomFonts';

interface TypographySettingsSectionProps {
  apiClient: ApiClient;
  customFonts: CustomFontEntry[];
  typographyOverrides: Record<string, TypographyOverride>;
  onFontsChange: (fonts: CustomFontEntry[]) => void;
  onResetAll: () => void;
  onOverrideChange: (elementId: string, override: TypographyOverride) => void;
}

const TYPOGRAPHY_SECTIONS = [
  { id: 'viewerTitle', label: 'Viewer Title' },
  { id: 'viewerSubtitle', label: 'Viewer Subtitle' },
  { id: 'cardTitle', label: 'Card Title' },
  { id: 'cardDescription', label: 'Card Description' },
  { id: 'cardCompanyName', label: 'Card Company Name' },
  { id: 'cardMediaCounts', label: 'Card Media Counts' },
  { id: 'campaignTitle', label: 'Campaign Title' },
  { id: 'campaignDescription', label: 'Campaign Description' },
  { id: 'campaignDate', label: 'Campaign Date' },
  { id: 'campaignAboutHeading', label: 'Campaign About Heading' },
  { id: 'campaignStatsValue', label: 'Campaign Stats Value' },
  { id: 'campaignStatsLabel', label: 'Campaign Stats Label' },
  { id: 'galleryLabel', label: 'Gallery Label' },
  { id: 'mediaCaption', label: 'Media Caption' },
  { id: 'authBarText', label: 'Auth Bar Text' },
  { id: 'accessBadgeText', label: 'Access Badge Text' },
] as const;

export function TypographySettingsSection({
  apiClient,
  customFonts,
  typographyOverrides,
  onFontsChange,
  onResetAll,
  onOverrideChange,
}: TypographySettingsSectionProps) {
  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Customize fonts, sizes, colors, and effects for individual text elements. Empty fields use theme defaults.
      </Text>
      <FontLibraryManager
        apiClient={apiClient}
        onFontsChange={(fonts: FontLibraryEntry[]) => onFontsChange(fonts.map((font) => ({
          name: font.name,
          family: `'${font.name}', sans-serif`,
        })))}
      />

      <Divider label="Element Overrides" labelPosition="left" />

      <Button
        variant="subtle"
        color="red"
        size="xs"
        disabled={Object.keys(typographyOverrides).length === 0}
        onClick={onResetAll}
      >
        Reset all typography
      </Button>

      <Accordion variant="separated" chevronPosition="left">
        {TYPOGRAPHY_SECTIONS.map((section) => (
          <Accordion.Item key={section.id} value={section.id}>
            <Accordion.Control>{section.label}</Accordion.Control>
            <Accordion.Panel>
              <TypographyEditor
                value={typographyOverrides[section.id] ?? {}}
                customFonts={customFonts}
                onChange={(value) => onOverrideChange(section.id, value)}
              />
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}