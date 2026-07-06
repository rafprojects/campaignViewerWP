import { Accordion, Button, Drawer, Group, Menu, NumberInput, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { tFieldLabel, tFieldDescription, tFieldPlaceholder, tFieldOptions } from '@/utils/adapterSchemaI18n';
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
import { useLazyAccordion } from '@wp-super-gallery/shared-utils';
import { cloneGalleryConfig } from '@/utils/galleryConfig';

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

/** Localised breakpoint label (reuses the shared admin_bp_* keys). */
const tBreakpointLabel = (bp: GalleryConfigBreakpoint): string =>
  i18n.t(`admin_bp_${bp}`, bp.charAt(0).toUpperCase() + bp.slice(1), { ns: 'wpsg' });

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
      {i18n.t('set_ad_gce_intro', 'This shared editor owns the nested gallery selection model. Inline selectors remain available for quick scanning and small edits.', { ns: 'wpsg' })}
    </Text>

    {contextSummary && (
      <Text size="sm" fw={500} c="blue">
        {contextSummary}
      </Text>
    )}

    <Select
      label={i18n.t('set_ad_gce_mode_label', 'Gallery Mode', { ns: 'wpsg' })}
      description={i18n.t('set_ad_gce_mode_desc', 'Choose whether this config resolves a unified gallery or separate image and video galleries.', { ns: 'wpsg' })}
      data={[
        { value: 'unified', label: i18n.t('set_ad_gce_mode_unified', 'Unified', { ns: 'wpsg' }) },
        { value: 'per-type', label: i18n.t('set_ad_gce_mode_pertype', 'Per-Type', { ns: 'wpsg' }) },
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
          {i18n.t('set_ad_gce_unified_inherit_note', 'Unified mode selection is supported here, but campaign-level unified adapter overrides still inherit the global unified adapter in this slice.', { ns: 'wpsg' })}
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
    <Accordion.Control>{i18n.t('set_ad_gce_bp_adapters', 'Breakpoint Adapters', { ns: 'wpsg' })}</Accordion.Control>
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
                {tBreakpointLabel(breakpoint)}
              </Tabs.Tab>
            ))}
          </Tabs.List>

          {GALLERY_BREAKPOINTS.map((breakpoint) => {
            if (resolvedDraft.mode === 'unified') {
              return (
                <Tabs.Panel key={breakpoint} value={breakpoint} pt="md">
                  <Stack gap="md">
                    <Text size="sm" c="dimmed">
                      {i18n.t('set_ad_gce_bp_editing_unified', 'Editing breakpoint-specific unified settings for the {{bp}} layout.', { bp: tBreakpointLabel(breakpoint), ns: 'wpsg' })}
                    </Text>
                    {unifiedAdapterEnabled ? (
                      <Select
                        label={i18n.t('set_ad_gce_unified_adapter_label', 'Unified Gallery Adapter', { ns: 'wpsg' })}
                        description={i18n.t('set_ad_gce_unified_adapter_desc', 'Unified gallery adapter for the {{bp}} breakpoint.', { bp: tBreakpointLabel(breakpoint), ns: 'wpsg' })}
                        data={getAdapterSelectOptions({ context: 'unified-gallery', breakpoint })}
                        value={getScopeAdapterId(resolvedDraft, breakpoint, 'unified') || null}
                        onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'unified', adapterId ?? ''))}
                        clearable
                        placeholder={i18n.t('set_ad_gce_default_adapter', 'Default adapter', { ns: 'wpsg' })}
                      />
                    ) : (
                      <Text size="sm" c="dimmed">
                        {i18n.t('set_ad_gce_unified_overrides_inherited', 'Unified adapter overrides remain inherited in this slice.', { ns: 'wpsg' })}
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
                    label={i18n.t('set_ad_gce_image_adapter_label', 'Image Adapter', { ns: 'wpsg' })}
                    description={i18n.t('set_ad_gce_image_adapter_desc', 'Image gallery adapter for the {{bp}} breakpoint.', { bp: tBreakpointLabel(breakpoint), ns: 'wpsg' })}
                    data={adapterOptions}
                    value={getScopeAdapterId(resolvedDraft, breakpoint, 'image') || null}
                    onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'image', adapterId ?? ''))}
                    clearable
                    placeholder={i18n.t('set_ad_gce_default_adapter', 'Default adapter', { ns: 'wpsg' })}
                  />
                  <Select
                    label={i18n.t('set_ad_gce_video_adapter_label', 'Video Adapter', { ns: 'wpsg' })}
                    description={i18n.t('set_ad_gce_video_adapter_desc', 'Video gallery adapter for the {{bp}} breakpoint.', { bp: tBreakpointLabel(breakpoint), ns: 'wpsg' })}
                    data={adapterOptions}
                    value={getScopeAdapterId(resolvedDraft, breakpoint, 'video') || null}
                    onChange={(adapterId) => updateDraft((current) => setScopeAdapterId(current, breakpoint, 'video', adapterId ?? ''))}
                    clearable
                    placeholder={i18n.t('set_ad_gce_default_adapter', 'Default adapter', { ns: 'wpsg' })}
                  />
                </Stack>
              </Tabs.Panel>
            );
          })}
        </Tabs>

        <Text size="xs" c="dimmed">
          {resolvedDraft.mode === 'unified'
            ? i18n.t('set_ad_gce_settings_apply_unified', 'Settings below apply to the {{bp}} breakpoint for the unified gallery surface.', { bp: tBreakpointLabel(activeBreakpoint), ns: 'wpsg' })
            : i18n.t('set_ad_gce_settings_apply_pertype', 'Settings below apply to the {{bp}} breakpoint for the current per-type gallery surface.', { bp: tBreakpointLabel(activeBreakpoint), ns: 'wpsg' })}
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
  saveLabel,
  clearLabel,
  clearMode = 'external',
  unifiedAdapterEnabled = true,
  unifiedAdapterDescription,
  zIndex,
  blurEnabled,
}: GalleryConfigEditorModalProps) {
  const { t } = useTranslation('wpsg');
  const resolvedSaveLabel = saveLabel ?? t('set_ad_gce_save', 'Apply Gallery Config');
  const resolvedClearLabel = clearLabel ?? t('set_ad_gce_clear', 'Clear Overrides');
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
  const unifiedAdapterHelpText = `${unifiedAdapterDescription ?? t('set_ad_gce_unified_help_default', 'Adapter applied when images and videos render together.')} ${t('set_ad_gce_unified_help_suffix', 'Each breakpoint tab controls its own unified adapter and responsive settings.')}`;
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

  const activeBreakpointLabel = tBreakpointLabel(activeBreakpoint);

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
                  {t('set_ad_gce_reset', 'Reset')}
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => updateDraft((c) => resetBreakpointToBaseline(c, resolvedBaseline, activeBreakpoint))}>
                  {t('set_ad_gce_reset_target', 'Reset {{label}}', { label: activeBreakpointLabel })}
                </Menu.Item>
                {getEditableScopes(resolvedDraft.mode ?? 'per-type').map((scope) => (
                  <Menu.Item key={scope} onClick={() => updateDraft((c) => resetScopeToBaseline(c, resolvedBaseline, scope))}>
                    {t('set_ad_gce_reset_target', 'Reset {{label}}', { label: formatScopeLabel(scope) })}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item color="red" onClick={handleResetAllChanges}>
                  {t('set_ad_gce_reset_all', 'Reset All Changes')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Button variant="default" size="sm" onClick={onClose}>{t('common_cancel', 'Cancel')}</Button>
            <Button size="sm" onClick={handleSaveDraft}>{resolvedSaveLabel}</Button>
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
          clearLabel={resolvedClearLabel}
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
            <Accordion.Control>{t('set_ad_gce_sec_sizing', 'Shared Section Sizing')}</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-section-sizing') ? (
                <Stack gap="md">
                  <NumberInput
                    label={t('set_ad_gce_sec_max_width', 'Gallery Section Max Width (px)')}
                    description={t('set_ad_gce_sec_max_width_desc', 'Maximum width for each gallery section. 0 keeps the section fully responsive.')}
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMaxWidth') ?? 0}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMaxWidth', typeof value === 'number' ? value : 0))}
                    min={0}
                    max={2000}
                    step={50}
                  />

                  <NumberInput
                    label={t('set_ad_gce_sec_min_width', 'Gallery Section Min Width (px)')}
                    description={t('set_ad_gce_sec_min_width_desc', 'Minimum width floor for each gallery section.')}
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMinWidth') ?? 300}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMinWidth', typeof value === 'number' ? value : 300))}
                    min={200}
                    max={600}
                    step={50}
                  />

                  <Select
                    label={t('set_ad_gce_sec_height_mode', 'Section Height Mode')}
                    description={t('set_ad_gce_sec_height_mode_desc', 'How section height is determined. Auto is content-driven and remains the safest default for masonry and justified layouts.')}
                    data={[
                      { value: 'auto', label: t('set_ad_gce_sec_height_auto', 'Auto (content-driven)') },
                      { value: 'manual', label: t('set_ad_gce_sec_height_manual', 'Manual (fixed max height)') },
                      { value: 'viewport', label: t('set_ad_gce_sec_height_viewport', 'Viewport (% of screen)') },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'sectionHeightMode') ?? 'auto'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionHeightMode', value ?? 'auto'))}
                    allowDeselect={false}
                  />

                  {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'sectionHeightMode') === 'manual' && (
                    <NumberInput
                      label={t('set_ad_gce_sec_max_height', 'Gallery Section Max Height (px)')}
                      description={t('set_ad_gce_sec_max_height_desc', 'Maximum height used when section height mode is manual.')}
                      value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMaxHeight') ?? 0}
                      onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMaxHeight', typeof value === 'number' ? value : 0))}
                      min={0}
                      max={2000}
                      step={50}
                    />
                  )}

                  <NumberInput
                    label={t('set_ad_gce_sec_min_height', 'Gallery Section Min Height (px)')}
                    description={t('set_ad_gce_sec_min_height_desc', 'Minimum height floor for each gallery section.')}
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionMinHeight') ?? 150}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionMinHeight', typeof value === 'number' ? value : 150))}
                    min={100}
                    max={400}
                    step={50}
                  />

                  <Select
                    label={t('set_ad_gce_sec_equal_height', 'Equal Height Sections (Per-Type)')}
                    description={t('set_ad_gce_sec_equal_height_desc', 'Controls whether image and video sections align to equal height in per-type layouts on wider viewports.')}
                    data={[
                      { value: 'false', label: t('set_ad_off', 'Off') },
                      { value: 'true', label: t('set_ad_on', 'On') },
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
            <Accordion.Control>{t('set_ad_gce_sec_spacing', 'Shared Section Spacing')}</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-section-spacing') ? (
                <Stack gap="md">
                  <NumberInput
                    label={t('set_ad_gce_sec_padding', 'Section Padding (px)')}
                    description={t('set_ad_gce_sec_padding_desc', 'Applies the same inner section padding across the currently edited gallery mode surface.')}
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'sectionPadding') ?? 16}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'sectionPadding', typeof value === 'number' ? value : 16))}
                    min={0}
                    max={32}
                    step={4}
                  />

                  <NumberInput
                    label={t('set_ad_gce_adapter_content_padding', 'Adapter Content Padding (px)')}
                    description={t('set_ad_gce_adapter_content_padding_desc', 'Applies the same inner adapter padding across the currently edited gallery mode surface.')}
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
            <Accordion.Control>{t('set_ad_gce_adapter_sizing', 'Shared Adapter Sizing')}</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-adapter-sizing') ? (
                <Stack gap="md">
                  <Select
                    label={t('set_ad_gce_adapter_sizing_mode', 'Adapter Sizing Mode')}
                    description={t('set_ad_gce_adapter_sizing_mode_desc', 'How adapters fill their gallery section. Fill uses the full section; Manual lets you cap width and height percentages.')}
                    data={[
                      { value: 'fill', label: t('set_ad_gce_adapter_sizing_fill', 'Fill (100%)') },
                      { value: 'manual', label: t('set_ad_gce_adapter_sizing_manual', 'Manual (custom %)') },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterSizingMode') ?? 'fill'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterSizingMode', value ?? 'fill'))}
                    allowDeselect={false}
                  />

                  {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'adapterSizingMode') === 'manual' && (
                    <>
                      <NumberInput
                        label={t('set_ad_gce_adapter_max_width', 'Adapter Max Width (%)')}
                        description={t('set_ad_gce_adapter_max_width_desc', 'Maximum adapter width as a percentage of its gallery section.')}
                        value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterMaxWidthPct') ?? 100}
                        onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterMaxWidthPct', typeof value === 'number' ? value : 100))}
                        min={50}
                        max={100}
                        step={5}
                      />

                      <NumberInput
                        label={t('set_ad_gce_adapter_max_height', 'Adapter Max Height (%)')}
                        description={t('set_ad_gce_adapter_max_height_desc', 'Maximum adapter height as a percentage of its gallery section.')}
                        value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterMaxHeightPct') ?? 100}
                        onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterMaxHeightPct', typeof value === 'number' ? value : 100))}
                        min={50}
                        max={100}
                        step={5}
                      />
                    </>
                  )}

                  <NumberInput
                    label={t('set_ad_gce_adapter_gap', 'Adapter Item Gap (px)')}
                    description={t('set_ad_gce_adapter_gap_desc', 'Applies shared item spacing across the currently edited gallery mode surface.')}
                    value={getRepresentativeNumberCommonValue(resolvedDraft, activeBreakpoint, 'adapterItemGap') ?? 16}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'adapterItemGap', typeof value === 'number' ? value : 16))}
                    min={0}
                    max={64}
                    step={4}
                  />

                  <Select
                    label={t('set_ad_gce_adapter_justify', 'Adapter Justification')}
                    description={t('set_ad_gce_adapter_justify_desc', 'Controls how adapter items distribute inside the section for adapters that support justification.')}
                    data={[
                      { value: 'start', label: t('set_ad_gce_justify_start', 'Start') },
                      { value: 'center', label: t('set_ad_gce_justify_center', 'Center') },
                      { value: 'end', label: t('set_ad_gce_justify_end', 'End') },
                      { value: 'space-between', label: t('set_ad_gce_justify_between', 'Space Between') },
                      { value: 'space-evenly', label: t('set_ad_gce_justify_evenly', 'Space Evenly') },
                      { value: 'stretch', label: t('set_ad_gce_justify_stretch', 'Stretch') },
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
            <Accordion.Control>{t('set_ad_gce_gallery_height', 'Shared Gallery Height')}</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-gallery-height') ? (
                <Stack gap="md">
                  <Select
                    label={t('set_ad_gce_height_constraint', 'Height Constraint')}
                    description={t('set_ad_gce_height_constraint_desc', 'Choose whether classic galleries can overflow, are kept within the visible screen, or use a manual CSS height.')}
                    data={[
                      { value: 'auto', label: t('set_ad_gce_height_none', 'No restraint') },
                      { value: 'viewport', label: t('set_ad_gce_height_viewport', 'Restrain to view') },
                      { value: 'manual', label: t('set_ad_gce_height_manual', 'Manually control height') },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'gallerySizingMode') ?? 'auto'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'gallerySizingMode', value ?? 'auto'))}
                    allowDeselect={false}
                  />

                  {getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'gallerySizingMode') === 'manual' && (
                    <TextInput
                      label={t('set_ad_gce_manual_height', 'Manual Gallery Height')}
                      description={t('set_ad_gce_manual_height_desc', 'Accepted units: px, em, rem, vh, dvh, vw, %. Example: 75vh or 420px')}
                      value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryManualHeight') ?? '420px'}
                      onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryManualHeight', event.currentTarget.value))}
                      placeholder={t('set_ad_gce_manual_height_ph', '420px')}
                    />
                  )}
                </Stack>
              ) : null}
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="shared-gallery-presentation">
            <Accordion.Control>{t('set_ad_gce_gallery_presentation', 'Shared Gallery Presentation')}</Accordion.Control>
            <Accordion.Panel>
              {mountedAccordionSections.has('shared-gallery-presentation') ? (
                <Stack gap="md">
                  <TextInput
                    label={t('set_ad_gce_img_label', 'Image Gallery Label')}
                    description={t('set_ad_gce_img_label_desc', 'Shared heading text for image gallery sections when labels are enabled.')}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryImageLabel') ?? 'Images'}
                    onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryImageLabel', event.currentTarget.value))}
                  />

                  <TextInput
                    label={t('set_ad_gce_vid_label', 'Video Gallery Label')}
                    description={t('set_ad_gce_vid_label_desc', 'Shared heading text for video gallery sections when labels are enabled.')}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryVideoLabel') ?? 'Videos'}
                    onChange={(event) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryVideoLabel', event.currentTarget.value))}
                  />

                  <Select
                    label={t('set_ad_gce_label_justify', 'Gallery Label Justification')}
                    description={t('set_ad_gce_label_justify_desc', 'Controls how gallery section titles align across the currently edited gallery mode surface.')}
                    data={[
                      { value: 'left', label: t('set_ad_gce_justify_left', 'Left') },
                      { value: 'center', label: t('set_ad_gce_justify_center', 'Center') },
                      { value: 'right', label: t('set_ad_gce_justify_right', 'Right') },
                    ]}
                    value={getRepresentativeStringCommonValue(resolvedDraft, activeBreakpoint, 'galleryLabelJustification') ?? 'left'}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'galleryLabelJustification', value ?? 'left'))}
                    allowDeselect={false}
                  />

                  <Select
                    label={t('set_ad_gce_show_label_icons', 'Show Gallery Label Icons')}
                    description={t('set_ad_gce_show_label_icons_desc', 'Displays the adapter icon beside gallery section titles.')}
                    data={[
                      { value: 'true', label: t('set_ad_on', 'On') },
                      { value: 'false', label: t('set_ad_off', 'Off') },
                    ]}
                    value={String(getRepresentativeBooleanCommonValue(resolvedDraft, activeBreakpoint, 'showGalleryLabelIcon') ?? false)}
                    onChange={(value) => updateDraft((current) => setCommonSettingForEditableScopes(current, activeBreakpoint, 'showGalleryLabelIcon', value === 'true'))}
                    allowDeselect={false}
                  />

                  <Select
                    label={t('set_ad_gce_show_section_labels', 'Show Gallery Section Labels')}
                    description={t('set_ad_gce_show_section_labels_desc', 'Controls whether gallery section headings render at all for the currently edited gallery mode surface.')}
                    data={[
                      { value: 'true', label: t('set_ad_on', 'On') },
                      { value: 'false', label: t('set_ad_off', 'Off') },
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
            <Accordion.Control>{t('set_ad_gce_viewport_bg', 'Viewport Backgrounds')}</Accordion.Control>
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
                          label={t('set_ad_gce_scope_bg', '{{scope}} Background', { scope: scopeLabel })}
                          description={t('set_ad_gce_scope_bg_desc', 'Background applied behind the {{scope}} viewport.', { scope: scopeLabel.toLowerCase() })}
                          data={[
                            { value: 'none', label: t('set_ad_gce_bg_none', 'None') },
                            { value: 'solid', label: t('set_ad_gce_bg_solid', 'Solid Color') },
                            { value: 'gradient', label: t('set_ad_gce_bg_gradient', 'Gradient') },
                            { value: 'image', label: t('set_ad_gce_bg_image', 'Background Image') },
                          ]}
                          value={bgType}
                          onChange={(value) => updateDraft((current) => setCommonSettingForScope(current, activeBreakpoint, scope, 'viewportBgType', value ?? 'none'))}
                          allowDeselect={false}
                        />

                        {bgType === 'solid' && (
                          <ColorInput
                            label={t('set_ad_gce_scope_bg_color', '{{scope}} Background Color', { scope: scopeLabel })}
                            description={t('set_ad_gce_scope_bg_color_desc', 'Solid background color behind the viewport.')}
                            value={bgColor}
                            onChange={(value) => updateDraft((current) => setCommonSettingForScope(current, activeBreakpoint, scope, 'viewportBgColor', value))}
                          />
                        )}

                        {bgType === 'gradient' && (
                          <TextInput
                            label={t('set_ad_gce_scope_bg_gradient', '{{scope}} Background Gradient', { scope: scopeLabel })}
                            description={t('set_ad_gce_scope_bg_gradient_desc', 'CSS gradient string used behind the viewport.')}
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
                            label={t('set_ad_gce_scope_bg_image', '{{scope}} Background Image URL', { scope: scopeLabel })}
                            description={t('set_ad_gce_scope_bg_image_desc', 'Image shown behind the viewport.')}
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
            <Accordion.Control>{t('set_ad_gce_adapter_specific', 'Adapter-Specific Settings')}</Accordion.Control>
            <Accordion.Panel>
              {activeSettingGroups.length > 0 ? (
                <Accordion variant="separated" multiple defaultValue={activeSettingGroups.map((group) => group.group)} chevronPosition="left">
                  {activeSettingGroups.map((group) => (
                    <Accordion.Item key={group.group} value={group.group}>
                      <Accordion.Control>{formatSettingGroupLabel(group.group)}</Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          {group.note && (
                            <Text size="xs" c="dimmed">{i18n.t(`set_sg_note_${group.group}`, group.note, { ns: 'wpsg' })}</Text>
                          )}
                          {group.fields.filter((field) => shouldRenderAdapterSettingField(resolvedDraft, activeBreakpoint, group, field)).map((field) => {
                            const representativeValue = getRepresentativeAdapterSettingValue(resolvedDraft, activeBreakpoint, group, field);

                            if (field.control === 'number') {
                              return (
                                <NumberInput
                                  key={String(field.key)}
                                  label={tFieldLabel(group.group, field)}
                                  description={tFieldDescription(group.group, field)}
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
                                  label={tFieldLabel(group.group, field)}
                                  description={tFieldDescription(group.group, field)}
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
                                  label={tFieldLabel(group.group, field)}
                                  description={tFieldDescription(group.group, field)}
                                  data={[
                                    { value: 'true', label: t('set_ad_on', 'On') },
                                    { value: 'false', label: t('set_ad_off', 'Off') },
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
                                  label={tFieldLabel(group.group, field)}
                                  description={tFieldDescription(group.group, field)}
                                  value={typeof representativeValue === 'string' ? representativeValue : field.fallback}
                                  placeholder={tFieldPlaceholder(group.group, field)}
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
                                  label={tFieldLabel(group.group, field)}
                                  description={tFieldDescription(group.group, field)}
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
                                label={tFieldLabel(group.group, field)}
                                description={tFieldDescription(group.group, field)}
                                data={tFieldOptions(group.group, field)}
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
                  {t('set_ad_gce_inheriting_note', 'This breakpoint is currently inheriting its adapter choice. Pick an explicit adapter above to expose adapter-specific settings here.')}
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