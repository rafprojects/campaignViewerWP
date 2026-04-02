import { Accordion, ColorInput, Stack, Switch, TextInput } from '@mantine/core';
import { ModalSelect } from '@/components/Common/ModalSelect';

import type { GalleryBehaviorSettings, ViewportBgType } from '@/types';

import type { UpdateGallerySetting } from './GalleryAdapterSettingsSection';

interface GalleryBackgroundFieldsProps {
  label: string;
  description: string;
  bgType: ViewportBgType;
  bgColor: string;
  bgGradient: string;
  bgImageUrl: string;
  onBgTypeChange: (value: ViewportBgType) => void;
  onBgColorChange: (value: string) => void;
  onBgGradientChange: (value: string) => void;
  onBgImageChange: (value: string) => void;
}

function GalleryBackgroundFields({
  label,
  description,
  bgType,
  bgColor,
  bgGradient,
  bgImageUrl,
  onBgTypeChange,
  onBgColorChange,
  onBgGradientChange,
  onBgImageChange,
}: GalleryBackgroundFieldsProps) {
  return (
    <>
      <ModalSelect
        label={label}
        description={description}
        value={bgType}
        onChange={(value) => onBgTypeChange((value as ViewportBgType) ?? 'none')}
        data={[
          { value: 'none', label: 'None' },
          { value: 'solid', label: 'Solid Color' },
          { value: 'gradient', label: 'Gradient' },
          { value: 'image', label: 'Background Image' },
        ]}
      />
      {bgType === 'solid' && (
        <ColorInput
          label="Background Color"
          description="Solid background color behind the viewport"
          value={bgColor}
          onChange={onBgColorChange}
        />
      )}
      {bgType === 'gradient' && (
        <TextInput
          label="Background Gradient"
          description="CSS gradient string used behind the viewport"
          value={bgGradient}
          onChange={(event) => onBgGradientChange(event.currentTarget.value)}
        />
      )}
      {bgType === 'image' && (
        <TextInput
          label="Background Image URL"
          description="Image shown behind the viewport"
          value={bgImageUrl}
          onChange={(event) => onBgImageChange(event.currentTarget.value)}
        />
      )}
    </>
  );
}

interface GalleryPresentationSectionsProps {
  settings: GalleryBehaviorSettings;
  updateSetting: UpdateGallerySetting;
}

export function GalleryPresentationSections({ settings, updateSetting }: GalleryPresentationSectionsProps) {
  return (
    <>
      <Accordion.Item value="backgrounds">
        <Accordion.Control>Viewport Backgrounds</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <GalleryBackgroundFields
              label="Image Gallery Background"
              description="Background applied behind image gallery viewports"
              bgType={settings.imageBgType}
              bgColor={settings.imageBgColor}
              bgGradient={settings.imageBgGradient}
              bgImageUrl={settings.imageBgImageUrl}
              onBgTypeChange={(value) => updateSetting('imageBgType', value)}
              onBgColorChange={(value) => updateSetting('imageBgColor', value)}
              onBgGradientChange={(value) => updateSetting('imageBgGradient', value)}
              onBgImageChange={(value) => updateSetting('imageBgImageUrl', value)}
            />

            <GalleryBackgroundFields
              label="Video Gallery Background"
              description="Background applied behind video gallery viewports"
              bgType={settings.videoBgType}
              bgColor={settings.videoBgColor}
              bgGradient={settings.videoBgGradient}
              bgImageUrl={settings.videoBgImageUrl}
              onBgTypeChange={(value) => updateSetting('videoBgType', value)}
              onBgColorChange={(value) => updateSetting('videoBgColor', value)}
              onBgGradientChange={(value) => updateSetting('videoBgGradient', value)}
              onBgImageChange={(value) => updateSetting('videoBgImageUrl', value)}
            />

            <GalleryBackgroundFields
              label="Unified Gallery Background"
              description="Background applied when unified gallery mode is active"
              bgType={settings.unifiedBgType}
              bgColor={settings.unifiedBgColor}
              bgGradient={settings.unifiedBgGradient}
              bgImageUrl={settings.unifiedBgImageUrl}
              onBgTypeChange={(value) => updateSetting('unifiedBgType', value)}
              onBgColorChange={(value) => updateSetting('unifiedBgColor', value)}
              onBgGradientChange={(value) => updateSetting('unifiedBgGradient', value)}
              onBgImageChange={(value) => updateSetting('unifiedBgImageUrl', value)}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>

      <Accordion.Item value="gallery-labels">
        <Accordion.Control>Gallery Labels</Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            <TextInput
              label="Image Gallery Label"
              description="Custom label for image gallery sections. Count is appended automatically."
              value={settings.galleryImageLabel ?? 'Images'}
              onChange={(event) => updateSetting('galleryImageLabel', event.currentTarget.value)}
            />
            <TextInput
              label="Video Gallery Label"
              description="Custom label for video gallery sections. Count is appended automatically."
              value={settings.galleryVideoLabel ?? 'Videos'}
              onChange={(event) => updateSetting('galleryVideoLabel', event.currentTarget.value)}
            />
            <ModalSelect
              label="Label Justification"
              description="Horizontal alignment for gallery section labels"
              data={[
                { value: 'left', label: 'Left' },
                { value: 'center', label: 'Center' },
                { value: 'right', label: 'Right' },
              ]}
              value={settings.galleryLabelJustification ?? 'left'}
              onChange={(value) => updateSetting('galleryLabelJustification', (value ?? 'left') as GalleryBehaviorSettings['galleryLabelJustification'])}
            />
            <Switch
              label="Show Gallery Label Icon"
              description="Display an icon prefix before each gallery section label"
              checked={settings.showGalleryLabelIcon ?? false}
              onChange={(event) => updateSetting('showGalleryLabelIcon', event.currentTarget.checked)}
            />
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </>
  );
}