import { Accordion, Stack, TextInput } from '@mantine/core';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';
import { ModalSelect } from '@/components/Common/ModalSelect';
import { getScopeGalleryCommonSetting, resolveGalleryConfig, setScopeGalleryCommonSetting } from '@/utils/galleryConfig';

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
  mountedPanels?: Set<string>;
}

export function GalleryPresentationSections({ settings, updateSetting, mountedPanels }: GalleryPresentationSectionsProps) {
  const resolvedGalleryConfig = resolveGalleryConfig(settings);

  const updateScopeBackground = (
    scope: 'image' | 'video' | 'unified',
    key: 'viewportBgType' | 'viewportBgColor' | 'viewportBgGradient' | 'viewportBgImageUrl',
    value: string,
  ) => {
    updateSetting('galleryConfig', setScopeGalleryCommonSetting(resolvedGalleryConfig, scope, key, value));
  };

  return (
    <>
      <Accordion.Item value="backgrounds">
        <Accordion.Control>Viewport Backgrounds</Accordion.Control>
        <Accordion.Panel>
          {(!mountedPanels || mountedPanels.has('backgrounds')) && <Stack gap="md">
            <GalleryBackgroundFields
              label="Image Gallery Background"
              description="Background applied behind image gallery viewports"
              bgType={(getScopeGalleryCommonSetting(resolvedGalleryConfig, 'image', 'viewportBgType') as ViewportBgType | undefined) ?? settings.imageBgType}
              bgColor={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'image', 'viewportBgColor') ?? settings.imageBgColor}
              bgGradient={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'image', 'viewportBgGradient') ?? settings.imageBgGradient}
              bgImageUrl={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'image', 'viewportBgImageUrl') ?? settings.imageBgImageUrl}
              onBgTypeChange={(value) => updateScopeBackground('image', 'viewportBgType', value)}
              onBgColorChange={(value) => updateScopeBackground('image', 'viewportBgColor', value)}
              onBgGradientChange={(value) => updateScopeBackground('image', 'viewportBgGradient', value)}
              onBgImageChange={(value) => updateScopeBackground('image', 'viewportBgImageUrl', value)}
            />

            <GalleryBackgroundFields
              label="Video Gallery Background"
              description="Background applied behind video gallery viewports"
              bgType={(getScopeGalleryCommonSetting(resolvedGalleryConfig, 'video', 'viewportBgType') as ViewportBgType | undefined) ?? settings.videoBgType}
              bgColor={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'video', 'viewportBgColor') ?? settings.videoBgColor}
              bgGradient={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'video', 'viewportBgGradient') ?? settings.videoBgGradient}
              bgImageUrl={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'video', 'viewportBgImageUrl') ?? settings.videoBgImageUrl}
              onBgTypeChange={(value) => updateScopeBackground('video', 'viewportBgType', value)}
              onBgColorChange={(value) => updateScopeBackground('video', 'viewportBgColor', value)}
              onBgGradientChange={(value) => updateScopeBackground('video', 'viewportBgGradient', value)}
              onBgImageChange={(value) => updateScopeBackground('video', 'viewportBgImageUrl', value)}
            />

            <GalleryBackgroundFields
              label="Unified Gallery Background"
              description="Background applied when unified gallery mode is active"
              bgType={(getScopeGalleryCommonSetting(resolvedGalleryConfig, 'unified', 'viewportBgType') as ViewportBgType | undefined) ?? settings.unifiedBgType}
              bgColor={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'unified', 'viewportBgColor') ?? settings.unifiedBgColor}
              bgGradient={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'unified', 'viewportBgGradient') ?? settings.unifiedBgGradient}
              bgImageUrl={getScopeGalleryCommonSetting(resolvedGalleryConfig, 'unified', 'viewportBgImageUrl') ?? settings.unifiedBgImageUrl}
              onBgTypeChange={(value) => updateScopeBackground('unified', 'viewportBgType', value)}
              onBgColorChange={(value) => updateScopeBackground('unified', 'viewportBgColor', value)}
              onBgGradientChange={(value) => updateScopeBackground('unified', 'viewportBgGradient', value)}
              onBgImageChange={(value) => updateScopeBackground('unified', 'viewportBgImageUrl', value)}
            />
          </Stack>}
        </Accordion.Panel>
      </Accordion.Item>
    </>
  );
}