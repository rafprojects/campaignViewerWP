import { Accordion, Button, Drawer, Group, Menu, NumberInput, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useState, type ReactElement } from 'react';
import { ModalColorInput as ColorInput } from '@/components/Common/ModalColorInput';

import {
  getActiveSettingGroupDefinitions,
  getAdapterSelectOptions,
} from '@/components/Galleries/Adapters/adapterRegistry';
import { ModalSelect as Select } from '@/components/Common/ModalSelect';
import { DimensionInput } from '@/components/Settings/DimensionInput';
import type {
  AdapterSettingFieldDefinition,
} from '@/components/Galleries/Adapters/GalleryAdapter';
import {
  type GalleryConfig,
  type GalleryConfigBreakpoint,
} from '@/types';
import { useLazyAccordion } from '@/hooks/useLazyAccordion';
import { cloneGalleryConfig } from '@/utils/galleryConfig';
;
import {
  GALLERY_BREAKPOINTS,
  getScopeAdapterId,
  hasConfiguredAdapterId,
  getEditableScopes,
  formatScopeLabel,
  getScopeViewportBackgroundFallbacks,
  getRepresentativeNumberCommonValue,
  getRepresentativeStringCommonValue,
  getRepresentativeBooleanCommonValue,
  getRepresentativeAdapterSettingValue,
  getScopeCommonValue,
  pruneConfig,
  setConfigMode,
  setScopeAdapterId,
  setCommonSettingForEditableScopes,
  setCommonSettingForScope,
  shouldRenderAdapterSettingField,
  formatSettingGroupLabel,
  setAdapterSettingForMatchingScopes,
  resetBreakpointToBaseline,
  resetScopeToBaseline,
} from './galleryConfigUtils';

interface GalleryConfigEditorModalProps {
  opened: boolean;
  title: string;
  value?: Partial<GalleryConfig> | undefined;
  onClose: () => void;
  onSave: (value: GalleryConfig | undefined) => void;
  onChange?: ((value: GalleryConfig | undefined) => void) | undefined;
  onClear?: (() => void) | undefined;
  contextSummary?: string | undefined;
  saveLabel?: string | undefined;
  clearLabel?: string | undefined;
  clearMode?: 'external' | 'draft' | undefined;
  unifiedAdapterEnabled?: boolean | undefined;
  unifiedAdapterDescription?: string | undefined;
  zIndex?: number | undefined;
  blurEnabled?: boolean | undefined;
}

type NamedComponent<Props = Record<string, never>> = ((props: Props) => ReactElement) & {
  displayName?: string;
};

type GalleryConfigDraftUpdater = (updater: (current: GalleryConfig) => GalleryConfig) => void;

interface GalleryConfigEditorIntroProps {
  contextSummary?: string | undefined;
  resolvedDraft: GalleryConfig;
  unifiedAdapterEnabled: boolean;
  unifiedAdapterHelpText: string;
  updateDraft: GalleryConfigDraftUpdater;
  clearMode?: 'external' | 'draft' | undefined;
  clearLabel?: string | undefined;
  onClear?: (() => void) | undefined;
  onClearDraft?: (() => void) | undefined;
}

const GalleryConfigEditorIntro: NamedComponent<GalleryConfigEditorIntroProps> = ({
  contextSummary,
  resolvedDraft,
  unifiedAdapterEnabled,
  unifiedAdapterHelpText,
  updateDraft,
  clearMode,
  clearLabel,
  onClear,
  onClearDraft,
}) => (
  <>
    <Text size="sm" c="dimmed">
      This shared editor owns the nested gallery selection model. Inline selectors remain available for quick scanning and small edits.
    </Text>

    {contextSummary && (
      <Text size="sm" fw={500} c="blue">
        {contextSummary}
      </Text>
    )}

    <Select
      label="Gallery Mode"
      description="Choose whether this config resolves a unified gallery or separate image and video galleries."
      data={[
        { value: 'unified', label: 'Unified' },
        { value: 'per-type', label: 'Per-Type' },
      ]}
      value={resolvedDraft.mode ?? 'per-type'}
      onChange={(nextMode) => {
        if (nextMode === 'unified' || nextMode === 'per-type') {
          updateDraft((current) => setConfigMode(current, nextMode));
        }
      }}
    />

    {resolvedDraft.mode === 'unified' ? (
      unifiedAdapterEnabled ? (
        <Text size="sm" c="dimmed">
          {unifiedAdapterHelpText}
        </Text>
      ) : (
        <Text size="sm" c="dimmed">
          Unified mode selection is supported here, but campaign-level unified adapter overrides still inherit the global unified adapter in this slice.
        </Text>
      )
    ) : null}

    {(clearMode === 'draft' || onClear) && clearLabel && (
      <Button
        variant="subtle"
        color="red"
        size="sm"
        onClick={() => {
          if (clearMode === 'draft') {
            onClearDraft?.();
            return;
          }
          onClear?.();
        }}
      >
        {clearLabel}
      </Button>
    )}
  </>
);

GalleryConfigEditorIntro.displayName = 'GalleryConfigEditorIntro';

interface GalleryConfigBreakpointAdaptersSectionProps {
  resolvedDraft: GalleryConfig;
  activeBreakpoint: GalleryConfigBreakpoint;
  setActiveBreakpoint: (value: GalleryConfigBreakpoint) => void;
  unifiedAdapterEnabled: boolean;
  updateDraft: GalleryConfigDraftUpdater;
}

const GalleryConfigBreakpointAdaptersSection: NamedComponent<GalleryConfigBreakpointAdaptersSectionProps> = ({
  resolvedDraft,
  activeBreakpoint,
  setActiveBreakpoint,
  unifiedAdapterEnabled,
  updateDraft,
}) => (
  <Accordion.Item value="breakpoint-adapters">
    <Accordion.Control>Breakpoint Adapters</Accordion.Control>
    <Accordion.Panel>
      <Stack gap="md">
        <Tabs
          value={activeBreakpoint}
          onChange={(value) => value && setActiveBreakpoint(value as GalleryConfigBreakpoint)}
          keepMounted={false}
        >
          <Tabs.List grow>
            {GALLERY_BREAKPOINTS.map((breakpoint) => (
              <Tabs.Tab key={breakpoint} value={breakpoint}>
                {breakpoint.charAt(0).toUpperCase() + breakpoint.slice(1)}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {GALLERY_BREAKPOINTS.map((breakpoint) => {
            if (resolvedDraft.mode === 'unified') {
              return (
                <Tabs.Panel key={breakpoint} value={breakpoint} pt="md">
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">
                      Editing breakpoint-specific unified settings for the {breakpoint} layout.
                    </Text>
                    {unifiedAdapterEnabled ? (
                      <Select
                        label="Unified Gallery Adapter"
                        description={`Unified gallery adapter for the ${breakpoint} breakpoint.`}
                        data={getAdapterSelectOptions({ context: 'unified-gallery', breakpoint })}
                        value={getScopeAdapterId(resolvedDraft, breakpoint, 'unified') || null}
                        onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'unified', adapterId ?? ''))}
                        clearable
                        placeholder="Default adapter"
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        Unified adapter overrides remain inherited in this slice.
                      </Text>
                    )}
                  </Stack>
                </Tabs.Panel>
              );
            }

            const adapterOptions = getAdapterSelectOptions({
              context: 'per-breakpoint-gallery',
              breakpoint,
            });

            return (
              <Tabs.Panel key={breakpoint} value={breakpoint} pt="md">
                <Stack gap="md">
                  <Select
                    label="Image Adapter"
                    description={`Image gallery adapter for the ${breakpoint} breakpoint.`}
                    data={adapterOptions}
                    value={getScopeAdapterId(resolvedDraft, breakpoint, 'image') || null}
                    onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'image', adapterId ?? ''))}
                    clearable
                    placeholder="Default adapter"
                  />
                  <Select
                    label="Video Adapter"
                    description={`Video gallery adapter for the ${breakpoint} breakpoint.`}
                    data={adapterOptions}
                    value={getScopeAdapterId(resolvedDraft, breakpoint, 'video') || null}
                    onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'video', adapterId ?? ''))}
                    clearable
                    placeholder="Default adapter"
                  />
                </Stack>
              </Tabs.Panel>
            );
          })}
        </Tabs>

        <Text size="xs" c="dimmed">
          Settings below apply to the {activeBreakpoint} breakpoint {resolvedDraft.mode === 'unified'
            ? 'for the unified gallery surface.'
            : 'for the current per-type gallery surface.'}
        </Text>
      </Stack>
    </Accordion.Panel>
  </Accordion.Item>
);

GalleryConfigBreakpointAdaptersSection.displayName = 'GalleryConfigBreakpointAdaptersSection';


export function GalleryConfigEditorModal({
  opened,
  title,
  value,
  onClose,
  onSave,
  onChange,
  onClear,
  contextSummary,
  saveLabel = 'Apply Gallery Config',
  clearLabel = 'Clear Overrides',
  clearMode = 'external',
  unifiedAdapterEnabled = true,
  unifiedAdapterDescription,
  zIndex,
  blurEnabled,
}: GalleryConfigEditorModalProps) {
  const [draft, setDraft] = useState<GalleryConfig | undefined>(undefined);
  const [baseline, setBaseline] = useState<GalleryConfig | undefined>(undefined);
  const [activeBreakpoint, setActiveBreakpoint] = useState<GalleryConfigBreakpoint>('desktop');
  const resolvedDraft = draft ?? { mode: 'per-type' as const, breakpoints: {} };
  const resolvedBaseline = baseline ?? { mode: 'per-type' as const, breakpoints: {} };
  const updateDraft = (updater: (current: GalleryConfig) => GalleryConfig) => {
    setDraft((current) => updater(current ?? { mode: 'per-type', breakpoints: {} }));
  };
  const activeAdapterIds = getEditableScopes(resolvedDraft.mode ?? 'per-type')
    .map((scope) => resolvedDraft.breakpoints?.[activeBreakpoint]?.[scope]?.adapterId)
    .filter(hasConfiguredAdapterId);
  const activeSettingGroups = getActiveSettingGroupDefinitions(
    activeAdapterIds,
  ).filter((group) => group.fields.some((field) => shouldRenderAdapterSettingField(resolvedDraft, activeBreakpoint, group, field)));
  const unifiedAdapterHelpText = `${unifiedAdapterDescription ?? 'Adapter applied when images and videos render together.'} Each breakpoint tab controls its own unified adapter and responsive settings.`;
  const defaultAccordionSections = [
    'breakpoint-adapters',
    'adapter-specific-settings',
  ];
  const { mounted: mountedAccordionSections, onChange: handleAccordionChange } = useLazyAccordion(defaultAccordionSections);
  const handleClearDraft = () => {
    setDraft(undefined);
  };
  const handleResetAllChanges = () => {
    setDraft(baseline);
  };
  const handleSaveDraft = () => {
    onSave(draft ? pruneConfig(draft) : undefined);
  };

  useEffect(() => {
    if (!opened) {
      return;
    }

    const nextBaseline = value
      ? pruneConfig(cloneGalleryConfig(value as GalleryConfig) ?? { mode: 'per-type', breakpoints: {} })
      : undefined;
    setBaseline(nextBaseline);
    setDraft(nextBaseline);
    setActiveBreakpoint('desktop');
  }, [opened, value]);

  useEffect(() => {
    if (!opened || !onChange) {
      return;
    }

    onChange(draft ? pruneConfig(draft) : undefined);
  }, [draft, onChange, opened]);

  const activeBreakpointLabel = activeBreakpoint.charAt(0).toUpperCase() + activeBreakpoint.slice(1);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      withinPortal={false}
      title={
        <Group w="100%" justify="space-between" wrap="nowrap" gap="sm">
          <Text fw={600} size="sm" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Text>
          <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
            <Menu shadow="md" position="bottom-end">
              <Menu.Target>
                <Button variant="subtle" size="sm" rightSection={<IconChevronDown size={14} />}>
                  Reset
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => updateDraft((c) => resetBreakpointToBaseline(c, resolvedBaseline, activeBreakpoint))}>
                  Reset {activeBreakpointLabel}
                </Menu.Item>
                {getEditableScopes(resolvedDraft.mode ?? 'per-type').map((scope) => (
                  <Menu.Item key={scope} onClick={() => updateDraft((c) => resetScopeToBaseline(c, resolvedBaseline, scope))}>
                    Reset {formatScopeLabel(scope)}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item color="red" onClick={handleResetAllChanges}>
                  Reset All Changes
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSaveDraft}>{saveLabel}</Button>
          </Group>
        </Group>
      }
      position="right"
      size="lg"
      {...(zIndex !== undefined ? { zIndex } : {})}
      transitionProps={{ transition: 'slide-left', duration: 200 }}
      overlayProps={{
        backgroundOpacity: 0.6,
        blur: blurEnabled !== false ? 4 : 0,
      }}
    >
      <Stack gap="md">
        <GalleryConfigEditorIntro
          contextSummary={contextSummary}
          resolvedDraft={resolvedDraft}
          unifiedAdapterEnabled={unifiedAdapterEnabled}
          unifiedAdapterHelpText={unifiedAdapterHelpText}
          updateDraft={updateDraft}
          clearMode={clearMode}
          clearLabel={clearLabel}
          onClear={onClear}
          onClearDraft={handleClearDraft}
        />
        <Accordion
          variant="separated"
          multiple
          defaultValue={defaultAccordionSections}
          onChange={handleAccordionChange}
          chevronPosition="left"
        >
          <GalleryConfigBreakpointAdaptersSection
            resolvedDraft={resolvedDraft}
            activeBreakpoint={activeBreakpoint}
            setActiveBreakpoint={setActiveBreakpoint}
            unifiedAdapterEnabled={unifiedAdapterEnabled}
            updateDraft={updateDraft}
          />

          <Accordion.Item value="shared-section-sizing">
            <Accordion.Control>Shared Section Sizing</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-section-sizing') ? (
                <Stack gap="md">
                  <NumberInput
                    label="Gallery Section Max Width (px)"
                    description="Maximum width for each gallery section. 0 keeps the section fully responsive."
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMaxWidth') ?? 0}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMaxWidth', typeof value === 'number' ? value : 0))}
                    min={0}
                    max={2000}
                    step={50}
                  />

                  <NumberInput
                    label="Gallery Section Min Width (px)"
                    description="Minimum width floor for each gallery section."
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMinWidth') ?? 300}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMinWidth', typeof value === 'number' ? value : 300))}
                    min={200}
                    max={600}
                    step={50}
                  />

                  <Select
                    label="Section Height Mode"
                    description="How section height is determined. Auto is content-driven and remains the safest default for masonry and justified layouts."
                    data={[
                      { value: 'auto', label: 'Auto (content-driven)' },
                      { value: 'manual', label: 'Manual (fixed max height)' },
                      { value: 'viewport', label: 'Viewport (% of screen)' },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'sectionHeightMode') ?? 'auto'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionHeightMode', value ?? 'auto'))}
                    allowDeselect={false}
                  />

                  {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'sectionHeightMode') === 'manual' && (
                    <NumberInput
                      label="Gallery Section Max Height (px)"
                      description="Maximum height used when section height mode is manual."
                      value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMaxHeight') ?? 0}
                      onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMaxHeight', typeof value === 'number' ? value : 0))}
                      min={0}
                      max={2000}
                      step={50}
                    />
                  )}

                  <NumberInput
                    label="Gallery Section Min Height (px)"
                    description="Minimum height floor for each gallery section."
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMinHeight') ?? 150}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMinHeight', typeof value === 'number' ? value : 150))}
                    min={100}
                    max={400}
                    step={50}
                  />

                  <Select
                    label="Equal Height Sections (Per-Type)"
                    description="Controls whether image and video sections align to equal height in per-type layouts on wider viewports."
                    data={[
                      { value: 'false', label: 'Off' },
                      { value: 'true', label: 'On' },
                    ]}
                    value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'perTypeSectionEqualHeight') ?? false)}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'perTypeSectionEqualHeight', value === 'true'))}
                    allowDeselect={false}
                  />
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="shared-section-spacing">
            <Accordion.Control>Shared Section Spacing</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-section-spacing') ? (
                <Stack gap="md">
                  <NumberInput
                    label="Section Padding (px)"
                    description="Applies the same inner section padding across the currently edited gallery mode surface."
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionPadding') ?? 16}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionPadding', typeof value === 'number' ? value : 16))}
                    min={0}
                    max={32}
                    step={4}
                  />

                  <NumberInput
                    label="Adapter Content Padding (px)"
                    description="Applies the same inner adapter padding across the currently edited gallery mode surface."
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterContentPadding') ?? 0}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterContentPadding', typeof value === 'number' ? value : 0))}
                    min={0}
                    max={24}
                    step={4}
                  />
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="shared-adapter-sizing">
            <Accordion.Control>Shared Adapter Sizing</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-adapter-sizing') ? (
                <Stack gap="md">
                  <Select
                    label="Adapter Sizing Mode"
                    description="How adapters fill their gallery section. Fill uses the full section; Manual lets you cap width and height percentages."
                    data={[
                      { value: 'fill', label: 'Fill (100%)' },
                      { value: 'manual', label: 'Manual (custom %)' },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterSizingMode') ?? 'fill'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterSizingMode', value ?? 'fill'))}
                    allowDeselect={false}
                  />

                  {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterSizingMode') === 'manual' && (
                    <>
                      <NumberInput
                        label="Adapter Max Width (%)"
                        description="Maximum adapter width as a percentage of its gallery section."
                        value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterMaxWidthPct') ?? 100}
                        onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterMaxWidthPct', typeof value === 'number' ? value : 100))}
                        min={50}
                        max={100}
                        step={5}
                      />

                      <NumberInput
                        label="Adapter Max Height (%)"
                        description="Maximum adapter height as a percentage of its gallery section."
                        value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterMaxHeightPct') ?? 100}
                        onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterMaxHeightPct', typeof value === 'number' ? value : 100))}
                        min={50}
                        max={100}
                        step={5}
                      />
                    </>
                  )}

                  <NumberInput
                    label="Adapter Item Gap (px)"
                    description="Applies shared item spacing across the currently edited gallery mode surface."
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterItemGap') ?? 16}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterItemGap', typeof value === 'number' ? value : 16))}
                    min={0}
                    max={64}
                    step={4}
                  />

                  <Select
                    label="Adapter Justification"
                    description="Controls how adapter items distribute inside the section for adapters that support justification."
                    data={[
                      { value: 'start', label: 'Start' },
                      { value: 'center', label: 'Center' },
                      { value: 'end', label: 'End' },
                      { value: 'space-between', label: 'Space Between' },
                      { value: 'space-evenly', label: 'Space Evenly' },
                      { value: 'stretch', label: 'Stretch' },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterJustifyContent') ?? 'center'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterJustifyContent', value ?? 'center'))}
                    allowDeselect={false}
                  />
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="shared-gallery-height">
            <Accordion.Control>Shared Gallery Height</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-gallery-height') ? (
                <Stack gap="md">
                  <Select
                    label="Height Constraint"
                    description="Choose whether classic galleries can overflow, are kept within the visible screen, or use a manual CSS height."
                    data={[
                      { value: 'auto', label: 'No restraint' },
                      { value: 'viewport', label: 'Restrain to view' },
                      { value: 'manual', label: 'Manually control height' },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'gallerySizingMode') ?? 'auto'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'gallerySizingMode', value ?? 'auto'))}
                    allowDeselect={false}
                  />

                  {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'gallerySizingMode') === 'manual' && (
                    <TextInput
                      label="Manual Gallery Height"
                      description="Accepted units: px, em, rem, vh, dvh, vw, %. Example: 75vh or 420px"
                      value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryManualHeight') ?? '420px'}
                      onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryManualHeight', event.currentTarget.value))}
                      placeholder="420px"
                    />
                  )}
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="shared-gallery-presentation">
            <Accordion.Control>Shared Gallery Presentation</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-gallery-presentation') ? (
                <Stack gap="md">
                  <TextInput
                    label="Image Gallery Label"
                    description="Shared heading text for image gallery sections when labels are enabled."
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryImageLabel') ?? 'Images'}
                    onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryImageLabel', event.currentTarget.value))}
                  />

                  <TextInput
                    label="Video Gallery Label"
                    description="Shared heading text for video gallery sections when labels are enabled."
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryVideoLabel') ?? 'Videos'}
                    onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryVideoLabel', event.currentTarget.value))}
                  />

                  <Select
                    label="Gallery Label Justification"
                    description="Controls how gallery section titles align across the currently edited gallery mode surface."
                    data={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryLabelJustification') ?? 'left'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryLabelJustification', value ?? 'left'))}
                    allowDeselect={false}
                  />

                  <Select
                    label="Show Gallery Label Icons"
                    description="Displays the adapter icon beside gallery section titles."
                    data={[
                      { value: 'true', label: 'On' },
                      { value: 'false', label: 'Off' },
                    ]}
                    value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'showGalleryLabelIcon') ?? false)}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'showGalleryLabelIcon', value === 'true'))}
                    allowDeselect={false}
                  />

                  <Select
                    label="Show Gallery Section Labels"
                    description="Controls whether gallery section headings render at all for the currently edited gallery mode surface."
                    data={[
                      { value: 'true', label: 'On' },
                      { value: 'false', label: 'Off' },
                    ]}
                    value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'showCampaignGalleryLabels') ?? true)}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'showCampaignGalleryLabels', value === 'true'))}
                    allowDeselect={false}
                  />
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="viewport-backgrounds">
            <Accordion.Control>Viewport Backgrounds</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('viewport-backgrounds') ? (
                <Stack gap="md">
                  {getEditableScopes(resolvedDraft.mode ?? 'per-type').map((scope) => {
                    const scopeLabel = formatScopeLabel(scope);
                    const defaults = getScopeViewportBackgroundFallbacks(scope);
                    const bgType = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgType') ?? defaults.viewportBgType;
                    const bgColor = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgColor') ?? defaults.viewportBgColor;
                    const bgGradient = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgGradient') ?? defaults.viewportBgGradient;
                    const bgImageUrl = getScopeCommonValue(resolvedDraft, activeBreakpoint, scope, 'viewportBgImageUrl') ?? defaults.viewportBgImageUrl;

                    return (
                      <Stack key={scope} gap="sm">
                        <Text size="sm" fw={600}>{scopeLabel}</Text>

                        <Select
                          label={`${scopeLabel} Background`}
                          description={`Background applied behind the ${scopeLabel.toLowerCase()} viewport.`}
                          data={[
                            { value: 'none', label: 'None' },
                            { value: 'solid', label: 'Solid Color' },
                            { value: 'gradient', label: 'Gradient' },
                            { value: 'image', label: 'Background Image' },
                          ]}
                          value={bgType}
                          onChange={(value) => updateDraft((current) => setCommonSettingForScope(current, activeBreakpoint, scope, 'viewportBgType', value ?? 'none'))}
                          allowDeselect={false}
                        />

                        {bgType === 'solid' && (
                          <ColorInput
                            label={`${scopeLabel} Background Color`}
                            description="Solid background color behind the viewport."
                            value={bgColor}
                            onChange={(value) => updateDraft((current) => setCommonSettingForScope(current, activeBreakpoint, scope, 'viewportBgColor', value))}
                          />
                        )}

                        {bgType === 'gradient' && (
                          <TextInput
                            label={`${scopeLabel} Background Gradient`}
                            description="CSS gradient string used behind the viewport."
                            value={bgGradient}
                            onChange={(event) => updateDraft((current) => setCommonSettingForScope(
                              current,
                              activeBreakpoint,
                              scope,
                              'viewportBgGradient',
                              event.currentTarget.value,
                            ))}
                          />
                        )}

                        {bgType === 'image' && (
                          <TextInput
                            label={`${scopeLabel} Background Image URL`}
                            description="Image shown behind the viewport."
                            value={bgImageUrl}
                            onChange={(event) => updateDraft((current) => setCommonSettingForScope(
                              current,
                              activeBreakpoint,
                              scope,
                              'viewportBgImageUrl',
                              event.currentTarget.value,
                            ))}
                          />
                        )}
                      </Stack>
                    );
                  })}
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="adapter-specific-settings">
            <Accordion.Control>Adapter-Specific Settings</Accordion.Control>
            <Accordion.Panel>
              {activeSettingGroups.length > 0 ? (
                <Accordion variant="separated" multiple defaultValue={activeSettingGroups.map((group) => group.group)} chevronPosition="left">
                  {activeSettingGroups.map((group) => (
                    <Accordion.Item key={group.group} value={group.group}>
                      <Accordion.Control>{formatSettingGroupLabel(group.group)}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          {group.fields.filter((field) => shouldRenderAdapterSettingField(resolvedDraft, activeBreakpoint, group, field)).map((field) => {
                            const representativeValue = getRepresentativeAdapterSettingValue(resolvedDraft, activeBreakpoint, group, field);

                            if (field.control === 'number') {
                              return (
                                <NumberInput
                                  key={String(field.key)}
                                  label={field.label}
                                  description={field.description}
                                  value={typeof representativeValue === 'number' ? representativeValue : field.fallback}
                                  onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                    current,
                                    activeBreakpoint,
                                    group,
                                    field,
                                    typeof value === 'number' ? value : field.fallback,
                                  ))}
                                  min={field.min}
                                  max={field.max}
                                  step={field.step}
                                />
                              );
                            }

                            if (field.control === 'dimension') {
                              const unitValue = getRepresentativeAdapterSettingValue(resolvedDraft, activeBreakpoint, group, { ...field, key: field.unitKey, control: 'select' as const, options: [], fallback: 'px' } as AdapterSettingFieldDefinition);
                              return (
                                <DimensionInput
                                  key={String(field.key)}
                                  label={field.label}
                                  description={field.description}
                                  value={typeof representativeValue === 'number' ? representativeValue : field.fallback}
                                  unit={typeof unitValue === 'string' ? unitValue : 'px'}
                                  onValueChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                    current,
                                    activeBreakpoint,
                                    group,
                                    field,
                                    typeof value === 'number' ? value : field.fallback,
                                  ))}
                                  onUnitChange={(unit) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                    current,
                                    activeBreakpoint,
                                    group,
                                    { ...field, key: field.unitKey } as unknown as AdapterSettingFieldDefinition,
                                    unit,
                                  ))}
                                  allowedUnits={field.allowedUnits}
                                  max={field.max}
                                  step={field.step}
                                />
                              );
                            }

                            if (field.control === 'boolean') {
                              return (
                                <Select
                                  key={String(field.key)}
                                  label={field.label}
                                  description={field.description}
                                  data={[
                                    { value: 'true', label: 'On' },
                                    { value: 'false', label: 'Off' },
                                  ]}
                                  value={String(typeof representativeValue === 'boolean' ? representativeValue : field.fallback)}
                                  onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                    current,
                                    activeBreakpoint,
                                    group,
                                    field,
                                    value === 'true',
                                  ))}
                                  allowDeselect={false}
                                />
                              );
                            }

                            if (field.control === 'text') {
                              return (
                                <TextInput
                                  key={String(field.key)}
                                  label={field.label}
                                  description={field.description}
                                  value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                                  placeholder={field.placeholder}
                                  onChange={(event) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                    current,
                                    activeBreakpoint,
                                    group,
                                    field,
                                    event.currentTarget.value,
                                  ))}
                                />
                              );
                            }

                            if (field.control === 'color') {
                              return (
                                <ColorInput
                                  key={String(field.key)}
                                  label={field.label}
                                  description={field.description}
                                  value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                                  onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                    current,
                                    activeBreakpoint,
                                    group,
                                    field,
                                    value,
                                  ))}
                                />
                              );
                            }

                            return (
                              <Select
                                key={String(field.key)}
                                label={field.label}
                                description={field.description}
                                data={field.options}
                                value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                                onChange={(value) => updateDraft((current) => setAdapterSettingForMatchingScopes(
                                  current,
                                  activeBreakpoint,
                                  group,
                                  field,
                                  value ?? field.fallback,
                                ))}
                                allowDeselect={false}
                              />
                            );
                          })}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              ) : (
                <Text size="sm" c="dimmed">
                  This breakpoint is currently inheriting its adapter choice. Pick an explicit adapter above to expose adapter-specific settings here.
                </Text>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

      </Stack>
    </Drawer>
  );
}

GalleryConfigEditorModal.displayName = 'GalleryConfigEditorModal';