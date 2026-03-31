import { ColorInput, Divider, NumberInput, Select, Stack, Switch } from '@mantine/core';

import { GradientEditor } from '@/components/Common/GradientEditor';
import { DEFAULT_GALLERY_BEHAVIOR_SETTINGS, type GalleryBehaviorSettings } from '@/types';

import { ThemeSelector } from '../Admin/ThemeSelector';

interface GeneralSettingsData extends GalleryBehaviorSettings {
  theme?: string;
  galleryLayout: 'grid' | 'masonry' | 'carousel';
  itemsPerPage: number;
  enableLightbox: boolean;
  enableAnimations: boolean;
}

interface GeneralSettingsSectionProps {
  settings: GeneralSettingsData;
  updateSetting: <K extends keyof GeneralSettingsData>(key: K, value: GeneralSettingsData[K]) => void;
  onThemeChange: (themeId: string) => void;
}

export function GeneralSettingsSection({ settings, updateSetting, onThemeChange }: GeneralSettingsSectionProps) {
  return (
    <Stack gap="md">
      <ThemeSelector
        description="Choose a color theme. Preview applies instantly; saved when you click Save."
        value={settings.theme}
        onThemeChange={onThemeChange}
      />

      <Select
        label="Default Layout"
        description="Default layout for displaying gallery items."
        value={settings.galleryLayout}
        onChange={(value) => updateSetting('galleryLayout', (value as GeneralSettingsData['galleryLayout']) ?? 'grid')}
        data={[
          { value: 'grid', label: 'Grid' },
          { value: 'masonry', label: 'Masonry' },
          { value: 'carousel', label: 'Carousel' },
        ]}
      />

      <NumberInput
        label="Items Per Page"
        description="Number of items to display per page (1-100)."
        value={settings.itemsPerPage}
        onChange={(value) => updateSetting('itemsPerPage', typeof value === 'number' ? value : 12)}
        min={1}
        max={100}
        step={1}
      />

      <Divider label="App Container" labelPosition="center" />

      <NumberInput
        label="App Max Width (px)"
        description="Maximum width of the gallery container. Set to 0 for full-width (edge-to-edge). Default 1200px."
        value={settings.appMaxWidth}
        onChange={(value) => updateSetting('appMaxWidth', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.appMaxWidth)}
        min={0}
        max={3000}
        step={50}
        placeholder="0 = full width"
      />

      <NumberInput
        label="Container Padding (px)"
        description="Horizontal padding inside the container. Set to 0 for true edge-to-edge content. Default 16px."
        value={settings.appPadding}
        onChange={(value) => updateSetting('appPadding', typeof value === 'number' ? value : DEFAULT_GALLERY_BEHAVIOR_SETTINGS.appPadding)}
        min={0}
        max={100}
        step={4}
        placeholder="16"
      />

      <Switch
        label="WP Full Bleed — Desktop (≥ 1024px)"
        description="Break out of the WordPress page container padding on desktop viewports. Requires page refresh."
        checked={settings.wpFullBleedDesktop}
        onChange={(event) => updateSetting('wpFullBleedDesktop', event.currentTarget.checked)}
      />
      <Switch
        label="WP Full Bleed — Tablet (768-1023px)"
        description="Break out of the WordPress page container padding on tablet viewports. Requires page refresh."
        checked={settings.wpFullBleedTablet}
        onChange={(event) => updateSetting('wpFullBleedTablet', event.currentTarget.checked)}
      />
      <Switch
        label="WP Full Bleed — Mobile (< 768px)"
        description="Break out of the WordPress page container padding on mobile viewports. Requires page refresh."
        checked={settings.wpFullBleedMobile}
        onChange={(event) => updateSetting('wpFullBleedMobile', event.currentTarget.checked)}
      />

      <Divider label="Viewer Header Visibility" labelPosition="center" />

      <Switch
        label="Show Gallery Title"
        description='Show the "Campaign Gallery" heading.'
        checked={settings.showGalleryTitle}
        onChange={(event) => updateSetting('showGalleryTitle', event.currentTarget.checked)}
      />
      <Switch
        label="Show Gallery Subtitle"
        description="Show the subtitle text beneath the title."
        checked={settings.showGallerySubtitle}
        onChange={(event) => updateSetting('showGallerySubtitle', event.currentTarget.checked)}
      />
      <Switch
        label="Show Access Mode"
        description="Show the Lock / Hide access-mode toggle (admin only)."
        checked={settings.showAccessMode}
        onChange={(event) => updateSetting('showAccessMode', event.currentTarget.checked)}
      />
      <Switch
        label="Show Filter Tabs"
        description="Show the campaign filter tab strip."
        checked={settings.showFilterTabs}
        onChange={(event) => updateSetting('showFilterTabs', event.currentTarget.checked)}
      />
      <Switch
        label="Show Search Box"
        description="Show the campaign search input."
        checked={settings.showSearchBox}
        onChange={(event) => updateSetting('showSearchBox', event.currentTarget.checked)}
      />

      <Divider label="Viewer Background" labelPosition="center" />

      <Select
        label="Background Type"
        description="Gallery container background style"
        data={[
          { value: 'theme', label: 'Default Theme' },
          { value: 'transparent', label: 'Transparent' },
          { value: 'solid', label: 'Solid color' },
          { value: 'gradient', label: 'Custom gradient' },
        ]}
        value={settings.viewerBgType ?? 'theme'}
        onChange={(value) => updateSetting('viewerBgType', (value ?? 'theme') as GalleryBehaviorSettings['viewerBgType'])}
      />
      {settings.viewerBgType === 'solid' && (
        <ColorInput
          label="Background Color"
          description="Solid background color for the gallery"
          value={settings.viewerBgColor}
          onChange={(value) => updateSetting('viewerBgColor', value)}
        />
      )}
      {settings.viewerBgType === 'gradient' && (
        <GradientEditor
          value={settings.viewerBgGradient ?? {}}
          onChange={(value) => updateSetting('viewerBgGradient', value)}
        />
      )}
      <Switch
        label="Show Header Border"
        description="Show border, shadow, and backdrop blur on the sticky gallery header."
        checked={settings.showViewerBorder ?? true}
        onChange={(event) => updateSetting('showViewerBorder', event.currentTarget.checked)}
      />

      <Divider label="Auth Bar" labelPosition="center" />

      <Select
        label="Auth Bar Display Mode"
        description="How the authentication bar appears on the page."
        data={[
          { value: 'bar', label: 'Bar (full-width sticky bar)' },
          { value: 'floating', label: 'Floating (circular icon, bottom-right)' },
          { value: 'draggable', label: 'Draggable (movable floating icon)' },
          { value: 'minimal', label: 'Minimal (thin strip, ≤32px)' },
          { value: 'auto-hide', label: 'Auto-hide (bar hides on scroll)' },
        ]}
        value={settings.authBarDisplayMode ?? 'floating'}
        onChange={(value) => updateSetting('authBarDisplayMode', (value ?? 'floating') as GalleryBehaviorSettings['authBarDisplayMode'])}
      />
      {settings.authBarDisplayMode === 'draggable' && (
        <NumberInput
          label="Drag Margin (px)"
          description="Minimum distance from viewport edges when dragging."
          value={settings.authBarDragMargin ?? 16}
          onChange={(value) => updateSetting('authBarDragMargin', Number(value) || 16)}
          min={0}
          max={64}
        />
      )}

      <Divider label="Security" labelPosition="center" />

      <NumberInput
        label="Session Idle Timeout (minutes)"
        description="Automatically sign out users after this many minutes of inactivity. Set to 0 to disable."
        value={settings.sessionIdleTimeoutMinutes}
        onChange={(value) => updateSetting('sessionIdleTimeoutMinutes', typeof value === 'number' ? value : 0)}
        min={0}
        max={480}
        step={5}
        placeholder="0 = disabled"
      />

      <Divider label="Developer" labelPosition="center" />

      <Switch
        label="Enable Advanced Settings"
        description="Unlock the Advanced tab with granular control over card opacities, tile dimensions, lightbox behavior, breakpoints, and more."
        checked={settings.advancedSettingsEnabled}
        onChange={(event) => updateSetting('advancedSettingsEnabled', event.currentTarget.checked)}
      />
      <Switch
        label="Show Settings Tooltips"
        description="Display info icons next to Advanced-tab labels that explain each setting on hover."
        checked={settings.showSettingsTooltips}
        onChange={(event) => updateSetting('showSettingsTooltips', event.currentTarget.checked)}
      />
    </Stack>
  );
}